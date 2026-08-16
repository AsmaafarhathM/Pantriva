import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { getPantryItems, getPantryExpiryStatus } from "../services/pantry";
import { getMealPlansApi, getMealPlanDetailApi } from "../services/meals";
import { getGroceryItemsApi } from "../services/grocery";
import { getBudgetSummaryApi } from "../services/budget";
import type { PantryItem, PantryExpiryItem } from "../types/pantry";
import type { MealPlanSummary, MealPlanDetail } from "../types/meals";
import type { GroceryItem } from "../types/grocery";
import type { BudgetStatusSummary } from "../types/budget";

function Dashboard() {
  // State
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [expiryItems, setExpiryItems] = useState<PantryExpiryItem[]>([]);
  const [latestPlanSummary, setLatestPlanSummary] = useState<MealPlanSummary | null>(null);
  const [latestPlanDetail, setLatestPlanDetail] = useState<MealPlanDetail | null>(null);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [budgetSummary, setBudgetSummary] = useState<BudgetStatusSummary | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError("");

      try {
        const [
          pantryRes,
          expiryRes,
          plansRes,
          groceryRes,
          budgetRes
        ] = await Promise.allSettled([
          getPantryItems(),
          getPantryExpiryStatus(),
          getMealPlansApi(),
          getGroceryItemsApi(),
          getBudgetSummaryApi()
        ]);

        // Pantry
        if (pantryRes.status === "fulfilled") {
          setPantryItems(pantryRes.value);
        }
        if (expiryRes.status === "fulfilled") {
          setExpiryItems(expiryRes.value);
        }

        // Meal Plans
        if (plansRes.status === "fulfilled" && plansRes.value.length > 0) {
          const latest = plansRes.value[0];
          setLatestPlanSummary(latest);

          // Fetch details for latest plan
          try {
            const detail = await getMealPlanDetailApi(latest.id);
            setLatestPlanDetail(detail);
          } catch {
            // Non-blocking
          }
        }

        // Groceries
        if (groceryRes.status === "fulfilled") {
          setGroceryItems(groceryRes.value);
        }

        // Budget
        if (budgetRes.status === "fulfilled") {
          setBudgetSummary(budgetRes.value);
        }
      } catch {
        setError("Unable to load some dashboard information.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Urgent Pantry Expiry Alerts (Expired + Expiring within 3 days)
  const urgentExpiryItems = useMemo(() => {
    return expiryItems.filter(
      (item) => item.status === "EXPIRED" || item.status === "EXPIRING_SOON"
    );
  }, [expiryItems]);

  // Grocery Metrics
  const groceryMetrics = useMemo(() => {
    const total = groceryItems.length;
    const purchased = groceryItems.filter((g) => g.is_purchased).length;
    const pending = total - purchased;
    const percentPurchased = total > 0 ? Math.round((purchased / total) * 100) : 0;

    let estimatedTotalCost = 0;
    groceryItems.forEach((g) => {
      if (g.estimated_price !== null && g.estimated_price !== undefined) {
        estimatedTotalCost += g.estimated_price;
      }
    });

    return {
      total,
      purchased,
      pending,
      percentPurchased,
      estimatedTotalCost
    };
  }, [groceryItems]);

  // Budget Progress Percentage
  const budgetProgressPercent = useMemo(() => {
    if (!budgetSummary || budgetSummary.budget <= 0) return 0;
    const ratio = (budgetSummary.estimated_cost / budgetSummary.budget) * 100;
    if (isNaN(ratio) || !isFinite(ratio)) return 0;
    return Math.min(Math.max(Math.round(ratio), 0), 100);
  }, [budgetSummary]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Welcome to Pantriva 👋
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Plan your meals, manage your pantry inventory, and control your grocery budget.
          </p>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/pantry"
            className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors"
          >
            + Add Pantry Item
          </Link>
          <Link
            to="/meal-planner"
            className="rounded-lg bg-black px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors"
          >
            ✨ Plan Meals
          </Link>
          <Link
            to="/grocery"
            className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors"
          >
            🛒 Grocery List
          </Link>
          <Link
            to="/budget"
            className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors"
          >
            💰 Budget
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-amber-50 p-4 border border-amber-200 text-sm text-amber-800">
          ⚠️ {error}
        </div>
      )}

      {/* Loading Skeletons */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="h-28 rounded-xl border border-gray-200 bg-white p-5 animate-pulse">
                <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
                <div className="mt-4 h-6 w-3/4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="h-64 rounded-2xl border border-gray-200 bg-white p-6 animate-pulse"></div>
            <div className="h-64 rounded-2xl border border-gray-200 bg-white p-6 animate-pulse"></div>
          </div>
        </div>
      ) : (
        <>
          {/* Section 2: KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {/* Pantry Items */}
            <Link
              to="/pantry"
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-md"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Pantry Stock</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{pantryItems.length}</p>
              <p className="mt-1 text-[11px] text-gray-400">Total ingredients</p>
            </Link>

            {/* Meal Plan */}
            <Link
              to="/meals"
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-md"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Active Plan</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {latestPlanSummary ? `${latestPlanSummary.number_of_days} Days` : "None"}
              </p>
              <p className="mt-1 text-[11px] text-gray-400">
                {latestPlanSummary ? `${latestPlanSummary.diet}` : "No plan created"}
              </p>
            </Link>

            {/* Grocery To Buy */}
            <Link
              to="/grocery"
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-md"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-amber-700">To Purchase</p>
              <p className="mt-2 text-2xl font-bold text-amber-800">
                {groceryMetrics.pending} <span className="text-xs font-normal text-gray-500">/ {groceryMetrics.total}</span>
              </p>
              <p className="mt-1 text-[11px] text-gray-400">Missing ingredients</p>
            </Link>

            {/* Grocery Cost */}
            <Link
              to="/grocery"
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-md"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Grocery Cost</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                ₹{budgetSummary ? budgetSummary.estimated_cost.toFixed(2) : groceryMetrics.estimatedTotalCost.toFixed(2)}
              </p>
              <p className="mt-1 text-[11px] text-gray-400">CEDA Mandi rate</p>
            </Link>

            {/* Budget Remaining */}
            <Link
              to="/budget"
              className={`rounded-2xl border p-5 shadow-xs transition-shadow hover:shadow-md ${
                budgetSummary && budgetSummary.remaining < 0
                  ? "border-red-200 bg-red-50/30"
                  : "border-gray-200 bg-white"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                {budgetSummary && budgetSummary.remaining < 0 ? "Over Budget" : "Budget Left"}
              </p>
              <p className={`mt-2 text-2xl font-bold ${
                budgetSummary && budgetSummary.remaining < 0 ? "text-red-700" : "text-emerald-700"
              }`}>
                {budgetSummary
                  ? budgetSummary.remaining < 0
                    ? `₹${Math.abs(budgetSummary.remaining).toFixed(2)}`
                    : `₹${budgetSummary.remaining.toFixed(2)}`
                  : "Not Set"}
              </p>
              <p className="mt-1 text-[11px] text-gray-400">
                {budgetSummary
                  ? budgetSummary.remaining < 0
                    ? "Deficit amount"
                    : "Available balance"
                  : "Set target in Budget"}
              </p>
            </Link>
          </div>

          {/* Section 3: Pantry Expiry Alerts Banner if any */}
          {urgentExpiryItems.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-amber-200/60">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <h3 className="text-sm font-bold text-amber-900">
                    Pantry Expiry Alert ({urgentExpiryItems.length} {urgentExpiryItems.length === 1 ? "item" : "items"} require attention)
                  </h3>
                </div>
                <Link
                  to="/pantry"
                  className="text-xs font-bold text-amber-900 underline hover:text-amber-700"
                >
                  View Pantry →
                </Link>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {urgentExpiryItems.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg bg-white p-2.5 border border-amber-200/80 text-xs"
                  >
                    <span className="font-semibold text-gray-900 truncate pr-2">
                      {item.item_name} ({item.quantity} {item.unit})
                    </span>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      item.status === "EXPIRED"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {item.status === "EXPIRED"
                        ? `Expired ${item.days_remaining !== undefined && item.days_remaining !== null ? `(${Math.abs(item.days_remaining)}d ago)` : ""}`
                        : `Expires in ${item.days_remaining}d`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main 2-Column Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Section 4: Current Meal Plan */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      Current Meal Schedule
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {latestPlanSummary
                        ? `${latestPlanSummary.number_of_days} Days · ${latestPlanSummary.diet} · ${latestPlanSummary.number_of_people} People`
                        : "No active meal plan"}
                    </p>
                  </div>

                  {latestPlanSummary ? (
                    <Link
                      to={`/meals?planId=${latestPlanSummary.id}`}
                      className="text-xs font-semibold text-black underline hover:text-gray-600"
                    >
                      View All Days →
                    </Link>
                  ) : (
                    <Link
                      to="/meal-planner"
                      className="rounded-lg bg-black px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
                    >
                      + Plan Meals
                    </Link>
                  )}
                </div>

                {latestPlanDetail && latestPlanDetail.meals && latestPlanDetail.meals.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Day 1 Preview
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {latestPlanDetail.meals
                        .filter((m) => m.day === "day_1")
                        .map((meal) => (
                          <div
                            key={meal.id}
                            className="rounded-xl p-3 bg-gray-50 border border-gray-100"
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                              {meal.meal_type}
                            </span>
                            <p className="text-sm font-semibold text-gray-900 mt-1 truncate">
                              {meal.meal_name}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {meal.ingredients.length} ingredients
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500 text-sm">
                    No meal plan generated yet. Generate your personalized meal plan using AI.
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {latestPlanSummary ? `Budget allocated: ₹${latestPlanSummary.budget}` : "Uses pantry to save money"}
                </span>
                <Link
                  to="/meal-planner"
                  className="text-xs font-semibold text-gray-900 hover:underline"
                >
                  Generate New Plan →
                </Link>
              </div>
            </div>

            {/* Section 5: Grocery Shopping Progress */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      Grocery Shopping Progress
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {groceryMetrics.purchased} of {groceryMetrics.total} items purchased ({groceryMetrics.percentPurchased}%)
                    </p>
                  </div>

                  <Link
                    to="/grocery"
                    className="text-xs font-semibold text-black underline hover:text-gray-600"
                  >
                    Open List →
                  </Link>
                </div>

                {groceryItems.length > 0 ? (
                  <div className="mt-4 space-y-4">
                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                        <span>Shopping Completion</span>
                        <span>{groceryMetrics.percentPurchased}%</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-black rounded-full transition-all duration-500"
                          style={{ width: `${groceryMetrics.percentPurchased}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Pending Items List */}
                    <div className="space-y-2 pt-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        Items Remaining ({groceryMetrics.pending})
                      </p>
                      <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                        {groceryItems
                          .filter((g) => !g.is_purchased)
                          .slice(0, 3)
                          .map((item) => (
                            <div key={item.id} className="p-2.5 bg-white flex items-center justify-between text-xs">
                              <div>
                                <span className="font-semibold text-gray-900">{item.item_name}</span>
                                <span className="text-gray-500 ml-1.5">({item.quantity} {item.unit})</span>
                              </div>
                              <span className="font-semibold text-gray-800">
                                {item.estimated_price !== null && item.estimated_price !== undefined
                                  ? `₹${item.estimated_price.toFixed(2)}`
                                  : "Price unavailable"}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500 text-sm">
                    No grocery items yet. Generate from your meal plan to discover what you need to buy.
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {groceryMetrics.pending > 0 ? `${groceryMetrics.pending} items left to buy` : "All items purchased"}
                </span>
                <Link
                  to="/grocery"
                  className="text-xs font-semibold text-gray-900 hover:underline"
                >
                  Manage Groceries →
                </Link>
              </div>
            </div>
          </div>

          {/* Section 6: Budget & Financial Health */}
          {budgetSummary && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-gray-100 gap-2">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Budget Health & Spending Summary
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Live calculation against unpurchased grocery items using CEDA market rates.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                    budgetSummary.status === "OVER_BUDGET"
                      ? "bg-red-100 text-red-800"
                      : budgetSummary.status === "NEAR_LIMIT"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}>
                    {budgetSummary.status.replace("_", " ")}
                  </span>
                  <Link
                    to="/budget"
                    className="text-xs font-semibold text-black underline hover:text-gray-600"
                  >
                    View Details →
                  </Link>
                </div>
              </div>

              {/* Over Budget Notice */}
              {budgetSummary.status === "OVER_BUDGET" && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>
                    You are <strong>₹{Math.abs(budgetSummary.remaining).toFixed(2)}</strong> over your allocated budget limit.
                  </span>
                </div>
              )}

              {/* Progress Utilization */}
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                  <span>
                    ₹{budgetSummary.estimated_cost.toFixed(2)} spent / estimated of ₹{budgetSummary.budget.toFixed(2)}
                  </span>
                  <span>{budgetProgressPercent}% Used</span>
                </div>

                <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      budgetSummary.status === "OVER_BUDGET"
                        ? "bg-red-500"
                        : budgetSummary.status === "NEAR_LIMIT"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${budgetProgressPercent}%` }}
                  ></div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Allocated</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">₹{budgetSummary.budget.toFixed(2)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Estimated Cost</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">₹{budgetSummary.estimated_cost.toFixed(2)}</p>
                </div>
                <div className={`rounded-xl p-4 border ${
                  budgetSummary.remaining < 0
                    ? "border-red-200 bg-red-50/50"
                    : "border-emerald-200 bg-emerald-50/50"
                }`}>
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    {budgetSummary.remaining < 0 ? "Deficit" : "Remaining"}
                  </p>
                  <p className={`text-lg font-bold mt-1 ${
                    budgetSummary.remaining < 0 ? "text-red-700" : "text-emerald-700"
                  }`}>
                    ₹{Math.abs(budgetSummary.remaining).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Dashboard;