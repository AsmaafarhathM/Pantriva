import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { getBudgetSummaryApi, setBudgetApi, getBudgetApi } from "../services/budget";
import { getGroceryItemsApi } from "../services/grocery";
import { getMealPlansApi } from "../services/meals";
import type { BudgetStatusSummary } from "../types/budget";
import type { GroceryItem } from "../types/grocery";

function Budget() {
  const [budgetSummary, setBudgetSummary] = useState<BudgetStatusSummary | null>(null);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);

  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [savingBudget, setSavingBudget] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Edit budget modal
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [newBudgetAmount, setNewBudgetAmount] = useState<string>("");

  const fetchBudgetData = async () => {
    setLoading(true);
    setError("");

    try {
      // 1. Fetch groceries first
      const groceries = await getGroceryItemsApi().catch(() => []);
      setGroceryItems(groceries);

      // 2. Try fetching live budget summary from backend
      try {
        const summary = await getBudgetSummaryApi();
        setBudgetSummary(summary);
        setNewBudgetAmount(String(summary.budget));
      } catch (err: unknown) {
        const errorObj = err as { response?: { status?: number } };
        // If budget not set (404), check if user has a recent meal plan budget to initialize from
        if (errorObj.response?.status === 404) {
          const mealPlans = await getMealPlansApi().catch(() => []);
          if (mealPlans.length > 0 && mealPlans[0].budget > 0) {
            // Initialize budget with latest meal plan budget
            const createdBudget = await setBudgetApi({ amount: mealPlans[0].budget }).catch(() => null);
            if (createdBudget) {
              const summary = await getBudgetSummaryApi().catch(() => null);
              if (summary) {
                setBudgetSummary(summary);
                setNewBudgetAmount(String(summary.budget));
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      setError(errorObj.response?.data?.detail || "Failed to load financial overview.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgetData();
  }, []);

  const handleSaveBudget = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsedAmount = parseFloat(newBudgetAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid positive budget amount.");
      return;
    }

    setSavingBudget(true);
    setError("");

    try {
      await setBudgetApi({ amount: parsedAmount });
      const updatedSummary = await getBudgetSummaryApi();
      setBudgetSummary(updatedSummary);
      setIsEditModalOpen(false);
      setSuccessMsg("Target budget updated successfully.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      setError(errorObj.response?.data?.detail || "Failed to update budget.");
    } finally {
      setSavingBudget(false);
    }
  };

  // Safe budget percentage calculation for visual progress bar
  const budgetUsagePercent = useMemo(() => {
    if (!budgetSummary || budgetSummary.budget <= 0) return 0;
    const ratio = (budgetSummary.estimated_cost / budgetSummary.budget) * 100;
    if (isNaN(ratio) || !isFinite(ratio)) return 0;
    return Math.min(Math.max(ratio, 0), 100);
  }, [budgetSummary]);

  // Actual total used ratio (can exceed 100% for over budget)
  const actualRatioPercent = useMemo(() => {
    if (!budgetSummary || budgetSummary.budget <= 0) return 0;
    const ratio = (budgetSummary.estimated_cost / budgetSummary.budget) * 100;
    if (isNaN(ratio) || !isFinite(ratio)) return 0;
    return Math.round(ratio * 10) / 10;
  }, [budgetSummary]);

  // Category-level breakdown for visual distribution
  const categoryExpenses = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    let totalAll = 0;

    groceryItems.forEach((item) => {
      if (item.estimated_price !== null && item.estimated_price !== undefined && item.estimated_price > 0) {
        const cat = item.category || "General";
        if (!map[cat]) {
          map[cat] = { total: 0, count: 0 };
        }
        map[cat].total += item.estimated_price;
        map[cat].count += 1;
        totalAll += item.estimated_price;
      }
    });

    return Object.entries(map).map(([category, data]) => ({
      category,
      total: data.total,
      count: data.count,
      percent: totalAll > 0 ? Math.round((data.total / totalAll) * 100) : 0
    })).sort((a, b) => b.total - a.total);
  }, [groceryItems]);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "OVER_BUDGET":
        return (
          <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800 uppercase tracking-wider">
            Over Budget
          </span>
        );
      case "NEAR_LIMIT":
        return (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 uppercase tracking-wider">
            Near Limit
          </span>
        );
      case "WITHIN_BUDGET":
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Within Budget
          </span>
        );
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Financial & Budget Analytics
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Real-time tracking of estimated grocery expenses against your meal planning budget.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setNewBudgetAmount(budgetSummary ? String(budgetSummary.budget) : "1000");
              setIsEditModalOpen(true);
            }}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors"
          >
            ⚙️ {budgetSummary ? "Adjust Budget" : "Set Target Budget"}
          </button>
          <Link
            to="/grocery"
            className="rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors"
          >
            Manage Grocery List →
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="mt-4 rounded-lg bg-emerald-50 p-4 border border-emerald-200 text-sm text-emerald-800 flex items-center justify-between">
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-600 hover:text-emerald-800 font-bold">✕</button>
        </div>
      )}

      {error && !isEditModalOpen && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-800 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError("")} className="text-red-600 hover:text-red-800 font-bold">✕</button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="mt-8 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="h-28 rounded-xl border border-gray-200 bg-white p-5 animate-pulse">
                <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
                <div className="mt-4 h-6 w-3/4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
          <div className="h-64 rounded-2xl border border-gray-200 bg-white p-6 animate-pulse"></div>
        </div>
      ) : !budgetSummary && groceryItems.length === 0 ? (
        <div className="mt-10 rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-2xl">
            💰
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900">
            No budget or grocery expenses yet
          </h3>
          <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
            Set your target budget or generate a meal plan to start tracking your estimated grocery costs.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setNewBudgetAmount("1000");
                setIsEditModalOpen(true);
              }}
              className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Set Budget
            </button>
            <Link
              to="/meal-planner"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Create Meal Plan →
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {/* Over-Budget Alert Banner if exceeded */}
          {budgetSummary && budgetSummary.status === "OVER_BUDGET" && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 flex items-start gap-4 shadow-xs">
              <div className="text-2xl">⚠️</div>
              <div>
                <h3 className="text-base font-bold text-red-900">
                  Budget Exceeded by ₹{Math.abs(budgetSummary.remaining).toFixed(2)}
                </h3>
                <p className="mt-1 text-xs text-red-700">
                  Your estimated grocery cost (₹{budgetSummary.estimated_cost.toFixed(2)}) exceeds your target budget (₹{budgetSummary.budget.toFixed(2)}). Consider adjusting your meal plan or utilizing more ingredients already in your pantry.
                </p>
              </div>
            </div>
          )}

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Budget */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Allocated Budget</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                ₹{budgetSummary ? budgetSummary.budget.toFixed(2) : "0.00"}
              </p>
              <p className="mt-1 text-[11px] text-gray-400">Target spending ceiling</p>
            </div>

            {/* Estimated Grocery Cost */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Estimated Expense</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                ₹{budgetSummary ? budgetSummary.estimated_cost.toFixed(2) : "0.00"}
              </p>
              <p className="mt-1 text-[11px] text-gray-400">Calculated from CEDA Mandi rates</p>
            </div>

            {/* Remaining Balance */}
            <div className={`rounded-2xl border p-6 shadow-xs ${
              budgetSummary && budgetSummary.remaining < 0
                ? "border-red-200 bg-red-50/40"
                : "border-emerald-200 bg-emerald-50/40"
            }`}>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                {budgetSummary && budgetSummary.remaining < 0 ? "Over Budget Amount" : "Remaining Balance"}
              </p>
              <p className={`mt-2 text-3xl font-bold ${
                budgetSummary && budgetSummary.remaining < 0 ? "text-red-700" : "text-emerald-700"
              }`}>
                {budgetSummary && budgetSummary.remaining < 0
                  ? `₹${Math.abs(budgetSummary.remaining).toFixed(2)} over`
                  : `₹${budgetSummary ? budgetSummary.remaining.toFixed(2) : "0.00"}`}
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                {budgetSummary && budgetSummary.remaining >= 0 ? "Available to spend" : "Deficit amount"}
              </p>
            </div>

            {/* Budget Status */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Current Status</p>
                <div className="mt-3">
                  {getStatusBadge(budgetSummary?.status)}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-gray-400">
                {actualRatioPercent}% of budget allocated
              </p>
            </div>
          </div>

          {/* Visual Budget Progress Bar */}
          {budgetSummary && budgetSummary.budget > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-gray-900">
                  Budget Utilization
                </span>
                <span className="text-sm font-semibold text-gray-700">
                  {actualRatioPercent}% Used (₹{budgetSummary.estimated_cost.toFixed(2)} / ₹{budgetSummary.budget.toFixed(2)})
                </span>
              </div>

              {/* Progress Track */}
              <div className="h-3.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    budgetSummary.status === "OVER_BUDGET"
                      ? "bg-red-500"
                      : budgetSummary.status === "NEAR_LIMIT"
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${budgetUsagePercent}%` }}
                ></div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                <span>₹0.00</span>
                <span>50% (₹{(budgetSummary.budget / 2).toFixed(2)})</span>
                <span>Ceiling: ₹{budgetSummary.budget.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Category-Level Expense Distribution */}
          {categoryExpenses.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Expense Breakdown by Category
              </h3>

              <div className="space-y-4">
                {categoryExpenses.map((cat) => (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-gray-800">
                        {cat.category} ({cat.count} {cat.count === 1 ? "item" : "items"})
                      </span>
                      <span className="font-bold text-gray-900">
                        ₹{cat.total.toFixed(2)} <span className="text-xs text-gray-400 font-normal">({cat.percent}%)</span>
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-gray-800 rounded-full"
                        style={{ width: `${cat.percent}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Itemized Expense Breakdown Table */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-xs overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Itemized Grocery Expense Breakdown
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Detailed price calculation per missing meal ingredient based on live agricultural mandi prices.
                </p>
              </div>
              <Link
                to="/grocery"
                className="text-xs font-semibold text-gray-900 underline hover:text-gray-600"
              >
                Go to Grocery →
              </Link>
            </div>

            {groceryItems.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No grocery items recorded.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-700">
                  <thead className="bg-gray-50/75 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3.5">Item Name</th>
                      <th className="px-6 py-3.5">Category</th>
                      <th className="px-6 py-3.5">Quantity</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Estimated Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groceryItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-gray-900">
                          {item.item_name}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {item.category}
                        </td>
                        <td className="px-6 py-4 text-gray-800">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                            item.is_purchased
                              ? "bg-gray-100 text-gray-700"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}>
                            {item.is_purchased ? "Purchased" : "To Buy"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {item.estimated_price !== null && item.estimated_price !== undefined ? (
                            <span className="font-bold text-gray-900">
                              ₹{item.estimated_price.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">
                              Price unavailable
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {budgetSummary && (
                    <tfoot className="bg-gray-50 font-bold text-gray-900 border-t border-gray-200">
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-right uppercase text-xs tracking-wider">
                          Total Estimated Expense:
                        </td>
                        <td className="px-6 py-4 text-right text-base text-gray-900">
                          ₹{budgetSummary.estimated_cost.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Adjust / Set Budget Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                Set Target Budget
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveBudget} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Budget Amount (INR ₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="50"
                  step="50"
                  placeholder="e.g. 1500"
                  value={newBudgetAmount}
                  onChange={(e) => setNewBudgetAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-black focus:ring-1 focus:ring-black"
                  required
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBudget}
                  className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {savingBudget ? "Saving..." : "Save Budget"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Budget;
