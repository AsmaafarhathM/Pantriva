import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  getGroceryItemsApi,
  generateGroceryListApi,
  toggleGroceryPurchaseApi,
  createGroceryItemApi,
  updateGroceryItemApi,
  deleteGroceryItemApi
} from "../services/grocery";
import type { GroceryItem, BudgetSummary } from "../types/grocery";

const CATEGORIES = [
  "All",
  "Meal Ingredients",
  "Grains",
  "Vegetables",
  "Pulses & Lentils",
  "Spices",
  "Dairy",
  "Fruits",
  "Snacks & Beverages",
  "Other"
];

const COMMON_UNITS = ["kg", "g", "l", "ml", "pieces", "packet", "tbsp", "cups"];

function Grocery() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);

  // Loading states
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Alerts & Messages
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Filters
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "purchased">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal for Manual Add / Edit
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<GroceryItem | null>(null);
  const [itemName, setItemName] = useState<string>("");
  const [category, setCategory] = useState<string>("Meal Ingredients");
  const [quantity, setQuantity] = useState<string>("");
  const [unit, setUnit] = useState<string>("kg");
  const [estimatedPrice, setEstimatedPrice] = useState<string>("");

  // Delete modal state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchGroceries = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getGroceryItemsApi();
      setItems(data);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      setError(errorObj.response?.data?.detail || "Failed to load grocery items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroceries();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    setSuccessMsg("");
    try {
      const response = await generateGroceryListApi();
      setItems(response.items);
      setBudgetSummary(response.budget_summary);
      setSuccessMsg(`Generated ${response.items.length} grocery items based on your planned meals.`);
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: unknown) {
      const errorObj = err as { response?: { status?: number; data?: { detail?: string } } };
      if (errorObj.response?.status === 404) {
        setError("No meal plan found. Please generate a meal plan first.");
      } else {
        setError(errorObj.response?.data?.detail || "Unable to generate grocery list. Please try again.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleTogglePurchase = async (item: GroceryItem) => {
    setTogglingId(item.id);
    try {
      const updated = await toggleGroceryPurchaseApi(item.id);
      setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
    } catch {
      setError("Failed to update item status.");
    } finally {
      setTogglingId(null);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setItemName("");
    setCategory("Meal Ingredients");
    setQuantity("");
    setUnit("kg");
    setEstimatedPrice("");
    setError("");
    setIsModalOpen(true);
  };

  const openEditModal = (item: GroceryItem) => {
    setEditingItem(item);
    setItemName(item.item_name);
    setCategory(item.category);
    setQuantity(String(item.quantity));
    setUnit(item.unit);
    setEstimatedPrice(item.estimated_price !== null && item.estimated_price !== undefined ? String(item.estimated_price) : "");
    setError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setError("");
  };

  const handleSaveItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsedQty = parseFloat(quantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setError("Please enter a valid positive quantity.");
      return;
    }

    const parsedPrice = estimatedPrice ? parseFloat(estimatedPrice) : null;
    if (parsedPrice !== null && (isNaN(parsedPrice) || parsedPrice < 0)) {
      setError("Please enter a valid price or leave it blank.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        item_name: itemName.trim(),
        category: category.trim(),
        quantity: parsedQty,
        unit: unit.trim(),
        estimated_price: parsedPrice
      };

      if (editingItem) {
        const updated = await updateGroceryItemApi(editingItem.id, payload);
        setItems((prev) => prev.map((it) => (it.id === editingItem.id ? updated : it)));
        setSuccessMsg(`Updated "${updated.item_name}".`);
      } else {
        const created = await createGroceryItemApi(payload);
        setItems((prev) => [...prev, created]);
        setSuccessMsg(`Added "${created.item_name}" to grocery list.`);
      }

      closeModal();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      setError(errorObj.response?.data?.detail || "Failed to save item.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteGroceryItemApi(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      setDeletingId(null);
      setSuccessMsg("Item removed from grocery list.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch {
      setError("Failed to delete grocery item.");
    }
  };

  // Filtered list
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Status filter
      if (filterStatus === "pending" && item.is_purchased) return false;
      if (filterStatus === "purchased" && !item.is_purchased) return false;

      // Category filter
      if (selectedCategory !== "All" && item.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.item_name.toLowerCase().includes(q);
        const matchCategory = item.category.toLowerCase().includes(q);
        if (!matchName && !matchCategory) return false;
      }

      return true;
    });
  }, [items, filterStatus, selectedCategory, searchQuery]);

  // Metric summaries
  const metrics = useMemo(() => {
    const total = items.length;
    const purchased = items.filter((i) => i.is_purchased).length;
    const pending = total - purchased;

    let totalEstimatedCost = 0;
    let unestimatedCount = 0;

    items.forEach((item) => {
      if (item.estimated_price !== null && item.estimated_price !== undefined) {
        totalEstimatedCost += item.estimated_price;
      } else {
        unestimatedCount++;
      }
    });

    return {
      total,
      purchased,
      pending,
      totalEstimatedCost,
      unestimatedCount
    };
  }, [items]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Grocery Shopping List
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Automatically generated from missing meal plan ingredients with CEDA Agmarknet market price estimates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openAddModal}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs"
          >
            + Add Custom Item
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {generating ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Generating List...</span>
              </>
            ) : (
              <span>⚡ Generate from Meal Plan</span>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="mt-4 rounded-lg bg-emerald-50 p-4 border border-emerald-200 text-sm text-emerald-800 flex items-center justify-between">
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-600 hover:text-emerald-800 font-bold">✕</button>
        </div>
      )}

      {error && !isModalOpen && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-800 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError("")} className="text-red-600 hover:text-red-800 font-bold">✕</button>
        </div>
      )}

      {/* Budget Summary Card if available */}
      {budgetSummary && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Budget Analysis
            </span>
            <p className="text-sm text-emerald-950 font-medium">
              Estimated Total: <span className="font-bold">₹{budgetSummary.total_estimated_cost.toFixed(2)}</span> of allocated <span className="font-bold">₹{budgetSummary.budget.toFixed(2)}</span>
            </p>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs bg-emerald-200/60 text-emerald-900 px-3 py-1 rounded-full font-bold uppercase">
              {budgetSummary.status.replace("_", " ")}
            </span>
            <Link
              to="/budget"
              className="text-xs font-semibold text-emerald-900 underline hover:text-emerald-700"
            >
              View Budget Page →
            </Link>
          </div>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Total Items</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{metrics.total}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-700">To Purchase</p>
          <p className="mt-2 text-2xl font-bold text-amber-800">{metrics.pending}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">Purchased</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{metrics.purchased}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Estimated Total</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            ₹{metrics.totalEstimatedCost.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Pills */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filterStatus === "all"
                ? "bg-black text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            All ({metrics.total})
          </button>
          <button
            onClick={() => setFilterStatus("pending")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filterStatus === "pending"
                ? "bg-black text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            To Buy ({metrics.pending})
          </button>
          <button
            onClick={() => setFilterStatus("purchased")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filterStatus === "purchased"
                ? "bg-black text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            Purchased ({metrics.purchased})
          </button>
        </div>

        {/* Search */}
        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search groceries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-xs focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              selectedCategory === cat
                ? "bg-gray-800 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grocery Items List */}
      {loading ? (
        <div className="mt-6 space-y-3">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} className="h-16 rounded-xl border border-gray-200 bg-white p-4 animate-pulse flex items-center justify-between">
              <div className="h-4 w-1/3 bg-gray-200 rounded"></div>
              <div className="h-4 w-16 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-2xl">
            🛒
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900">
            {items.length === 0 ? "No grocery items yet" : "No matching items found"}
          </h3>
          <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
            {items.length === 0
              ? "Generate your grocery list automatically from your meal plan to discover what ingredients you need to buy."
              : "Try adjusting your search query or switching your status and category filters."}
          </p>

          {items.length === 0 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Generate from Meals
              </button>
              <Link
                to="/meal-planner"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Create Meal Plan →
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white shadow-xs overflow-hidden">
          {filteredItems.map((item) => {
            const isToggling = togglingId === item.id;
            return (
              <div
                key={item.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-6 transition-colors hover:bg-gray-50/70 gap-3 ${
                  item.is_purchased ? "bg-gray-50/40 opacity-75" : ""
                }`}
              >
                {/* Left: Checkbox & Title */}
                <div className="flex items-center gap-3.5">
                  <button
                    type="button"
                    onClick={() => handleTogglePurchase(item)}
                    disabled={isToggling}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                      item.is_purchased
                        ? "bg-black border-black text-white"
                        : "border-gray-300 bg-white hover:border-gray-400"
                    }`}
                  >
                    {item.is_purchased && (
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>

                  <div>
                    <span
                      className={`text-base font-semibold text-gray-900 ${
                        item.is_purchased ? "line-through text-gray-500" : ""
                      }`}
                    >
                      {item.item_name}
                    </span>
                    <p className="text-xs text-gray-500">
                      {item.quantity} {item.unit} • <span className="text-gray-600">{item.category}</span>
                    </p>
                  </div>
                </div>

                {/* Right: Price & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
                  <div className="text-left sm:text-right">
                    {item.estimated_price !== null && item.estimated_price !== undefined ? (
                      <div>
                        <span className="text-sm font-bold text-gray-900">
                          ₹{item.estimated_price.toFixed(2)}
                        </span>
                        <p className="text-[10px] text-gray-400">CEDA Mandi rate</p>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">
                        Price unavailable
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(item)}
                      className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeletingId(item.id)}
                      className="rounded-md px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingItem ? "Edit Grocery Item" : "Add Grocery Item"}
              </h2>
              <button
                onClick={closeModal}
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

            <form onSubmit={handleSaveItem} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tomatoes, Basmati Rice, Sunflower Oil"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-black focus:ring-1 focus:ring-black"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-black focus:ring-1 focus:ring-black"
                  >
                    {CATEGORIES.filter((c) => c !== "All").map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-black focus:ring-1 focus:ring-black"
                  >
                    {COMMON_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="e.g. 1, 500, 2.5"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-black focus:ring-1 focus:ring-black"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Estimated Price (INR ₹ Optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 45"
                    value={estimatedPrice}
                    onChange={(e) => setEstimatedPrice(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-black focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingItem ? "Update Item" : "Add to List"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Remove Item?</h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to remove this item from your grocery shopping list?
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Grocery;
