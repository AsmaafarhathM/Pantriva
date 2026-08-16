import { useEffect, useState, useMemo } from "react";
import {
  getPantryItems,
  getPantryExpiryStatus,
  createPantryItem,
  createMultiplePantryItems,
  updatePantryItem,
  deletePantryItem
} from "../services/pantry";
import type { PantryItem, PantryExpiryItem, ExpiryStatusType, PantryItemCreate } from "../types/pantry";

const CATEGORIES = [
  "All",
  "Grains",
  "Vegetables",
  "Pulses & Lentils",
  "Spices",
  "Dairy",
  "Fruits",
  "Oils & Ghee",
  "Other"
];

const COMMON_UNITS = ["kg", "g", "l", "ml", "pieces", "tbsp", "tsp", "packet", "cups"];

interface BulkRow {
  id: string;
  item_name: string;
  category: string;
  quantity: string;
  unit: string;
  expiry_date: string;
}

function Pantry() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [expiryStatusMap, setExpiryStatusMap] = useState<Record<number, PantryExpiryItem>>({});

  // UI state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"single" | "bulk">("single");
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);

  // Single form inputs
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("Grains");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [expiryDate, setExpiryDate] = useState("");

  // Bulk form inputs
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([
    { id: "1", item_name: "", category: "Grains", quantity: "", unit: "kg", expiry_date: "" },
    { id: "2", item_name: "", category: "Vegetables", quantity: "", unit: "kg", expiry_date: "" },
    { id: "3", item_name: "", category: "Pulses & Lentils", quantity: "", unit: "kg", expiry_date: "" }
  ]);

  // Delete modal state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchPantryData = async () => {
    setError("");
    try {
      const [pantryData, expiryData] = await Promise.all([
        getPantryItems(),
        getPantryExpiryStatus().catch(() => [])
      ]);

      setItems(pantryData);

      const statusMap: Record<number, PantryExpiryItem> = {};
      expiryData.forEach((exp) => {
        statusMap[exp.id] = exp;
      });
      setExpiryStatusMap(statusMap);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      setError(errorObj.response?.data?.detail || "Failed to load pantry inventory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPantryData();
  }, []);

  const openAddModal = (mode: "single" | "bulk" = "single") => {
    setEditingItem(null);
    setModalMode(mode);
    setItemName("");
    setCategory("Grains");
    setQuantity("");
    setUnit("kg");
    setExpiryDate("");
    setBulkRows([
      { id: "1", item_name: "", category: "Grains", quantity: "", unit: "kg", expiry_date: "" },
      { id: "2", item_name: "", category: "Vegetables", quantity: "", unit: "kg", expiry_date: "" },
      { id: "3", item_name: "", category: "Pulses & Lentils", quantity: "", unit: "kg", expiry_date: "" }
    ]);
    setError("");
    setIsModalOpen(true);
  };

  const openEditModal = (item: PantryItem) => {
    setEditingItem(item);
    setModalMode("single");
    setItemName(item.item_name);
    setCategory(item.category);
    setQuantity(String(item.quantity));
    setUnit(item.unit);
    setExpiryDate(item.expiry_date || "");
    setError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setError("");
  };

  // Bulk row helpers
  const handleBulkChange = (id: string, field: keyof BulkRow, val: string) => {
    setBulkRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: val } : row))
    );
  };

  const handleAddBulkRow = () => {
    const newId = String(Date.now());
    setBulkRows((prev) => [
      ...prev,
      { id: newId, item_name: "", category: "Vegetables", quantity: "", unit: "kg", expiry_date: "" }
    ]);
  };

  const handleRemoveBulkRow = (id: string) => {
    if (bulkRows.length <= 1) return;
    setBulkRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSaveItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (modalMode === "single") {
      const parsedQty = parseFloat(quantity);
      if (isNaN(parsedQty) || parsedQty <= 0) {
        setError("Please enter a valid positive quantity.");
        return;
      }

      setSubmitting(true);
      setError("");

      try {
        const payload: PantryItemCreate = {
          item_name: itemName.trim(),
          category: category.trim(),
          quantity: parsedQty,
          unit: unit.trim(),
          expiry_date: expiryDate ? expiryDate : null,
        };

        if (editingItem) {
          const updated = await updatePantryItem(editingItem.id, payload);
          setItems((prev) => prev.map((it) => (it.id === editingItem.id ? updated : it)));
          setSuccessMsg(`Updated "${updated.item_name}" successfully.`);
        } else {
          const created = await createPantryItem(payload);
          setItems((prev) => [...prev, created]);
          setSuccessMsg(`Added "${created.item_name}" to pantry.`);
        }

        closeModal();
        // Refresh expiry status in background
        getPantryExpiryStatus().then((expiryData) => {
          const statusMap: Record<number, PantryExpiryItem> = {};
          expiryData.forEach((exp) => {
            statusMap[exp.id] = exp;
          });
          setExpiryStatusMap(statusMap);
        });
        setTimeout(() => setSuccessMsg(""), 4000);
      } catch (err: unknown) {
        const errorObj = err as { response?: { data?: { detail?: string } } };
        setError(errorObj.response?.data?.detail || "Failed to save pantry item. Please check the inputs.");
      } finally {
        setSubmitting(false);
      }
    } else {
      // Bulk Add Mode
      const validPayloads: PantryItemCreate[] = [];

      for (const row of bulkRows) {
        if (row.item_name.trim()) {
          const parsedQty = parseFloat(row.quantity);
          if (isNaN(parsedQty) || parsedQty <= 0) {
            setError(`Please enter a valid positive quantity for "${row.item_name}".`);
            return;
          }
          validPayloads.push({
            item_name: row.item_name.trim(),
            category: row.category.trim(),
            quantity: parsedQty,
            unit: row.unit.trim(),
            expiry_date: row.expiry_date ? row.expiry_date : null
          });
        }
      }

      if (validPayloads.length === 0) {
        setError("Please enter at least one item name and quantity.");
        return;
      }

      setSubmitting(true);
      setError("");

      try {
        const createdItems = await createMultiplePantryItems(validPayloads);
        setItems((prev) => [...prev, ...createdItems]);
        setSuccessMsg(`Successfully added ${createdItems.length} items to your pantry!`);
        closeModal();

        // Refresh expiry status
        getPantryExpiryStatus().then((expiryData) => {
          const statusMap: Record<number, PantryExpiryItem> = {};
          expiryData.forEach((exp) => {
            statusMap[exp.id] = exp;
          });
          setExpiryStatusMap(statusMap);
        });
        setTimeout(() => setSuccessMsg(""), 4000);
      } catch (err: unknown) {
        const errorObj = err as { response?: { data?: { detail?: string } } };
        setError(errorObj.response?.data?.detail || "Failed to add items. Please verify your inputs.");
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePantryItem(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      setDeletingId(null);
      setSuccessMsg("Pantry item removed.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch {
      setError("Failed to delete pantry item.");
    }
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "All" || item.category.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, selectedCategory]);

  // Expiry Statistics
  const stats = useMemo(() => {
    let expiredCount = 0;
    let expiringSoonCount = 0;
    let goodCount = 0;

    Object.values(expiryStatusMap).forEach((exp) => {
      if (exp.status === "EXPIRED") expiredCount++;
      else if (exp.status === "EXPIRING_SOON") expiringSoonCount++;
      else if (exp.status === "GOOD") goodCount++;
    });

    return {
      total: items.length,
      expired: expiredCount,
      expiringSoon: expiringSoonCount,
      good: goodCount
    };
  }, [items, expiryStatusMap]);

  const renderExpiryBadge = (itemId: number, rawDate?: string | null) => {
    const expInfo = expiryStatusMap[itemId];
    const status: ExpiryStatusType = expInfo?.status || (rawDate ? "GOOD" : "NO_EXPIRY_DATE");
    const days = expInfo?.days_remaining;

    switch (status) {
      case "EXPIRED":
        return (
          <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 border border-red-200">
            Expired {days !== undefined && days !== null ? `(${Math.abs(days)}d ago)` : ""}
          </span>
        );
      case "EXPIRING_SOON":
        return (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
            Expires soon {days !== undefined && days !== null ? `(${days}d left)` : ""}
          </span>
        );
      case "GOOD":
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            Fresh {days !== undefined && days !== null ? `(${days}d left)` : ""}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-500 border border-gray-200">
            No Expiry Date
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
            Pantry Inventory
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Keep track of your current ingredients so AI meal planner can use them and reduce grocery costs.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => openAddModal("bulk")}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 transition-colors"
          >
            ⚡ Add Multiple Items
          </button>
          <button
            onClick={() => openAddModal("single")}
            className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-gray-800 transition-colors"
          >
            + Add Single Item
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

      {/* Summary KPI Cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Total Items</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">Fresh / Good</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{stats.good}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-xs">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-700">Expiring in ≤3 Days</p>
          <p className="mt-2 text-2xl font-bold text-amber-800">{stats.expiringSoon}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-5 shadow-xs">
          <p className="text-xs font-medium uppercase tracking-wider text-red-700">Expired Items</p>
          <p className="mt-2 text-2xl font-bold text-red-800">{stats.expired}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-black text-white"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search items or categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-xs focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div key={idx} className="h-44 rounded-xl border border-gray-200 bg-white p-5 animate-pulse">
              <div className="h-6 w-3/4 bg-gray-200 rounded"></div>
              <div className="mt-4 h-4 w-1/2 bg-gray-200 rounded"></div>
              <div className="mt-2 h-4 w-2/3 bg-gray-200 rounded"></div>
              <div className="mt-6 h-8 bg-gray-100 rounded"></div>
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="mt-10 rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-2xl">
            📦
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900">
            {items.length === 0 ? "Your pantry is empty" : "No matching items found"}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {items.length === 0
              ? "Add the staples, spices, and groceries you currently have in your kitchen."
              : "Try adjusting your search query or selecting another category filter."}
          </p>
          {items.length === 0 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => openAddModal("bulk")}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                ⚡ Add Multiple Items
              </button>
              <button
                onClick={() => openAddModal("single")}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                + Add Single Item
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group relative flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-gray-900 capitalize">
                    {item.item_name}
                  </h3>
                  {renderExpiryBadge(item.id, item.expiry_date)}
                </div>

                <div className="mt-3 space-y-1.5 text-sm text-gray-600">
                  <p className="flex items-center justify-between">
                    <span className="text-gray-500">Category:</span>
                    <span className="font-medium text-gray-800">{item.category}</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-gray-500">Quantity:</span>
                    <span className="font-semibold text-gray-900">
                      {item.quantity} {item.unit}
                    </span>
                  </p>
                  {item.expiry_date && (
                    <p className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
                      <span>Expiry Date:</span>
                      <span>{item.expiry_date}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Card Actions */}
              <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                <button
                  onClick={() => openEditModal(item)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeletingId(item.id)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className={`w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl border border-gray-200 ${
            modalMode === "bulk" ? "max-w-3xl" : "max-w-lg"
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingItem
                    ? "Edit Pantry Item"
                    : modalMode === "bulk"
                    ? "Add Multiple Pantry Items"
                    : "Add Pantry Item"}
                </h2>
                {!editingItem && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {modalMode === "bulk"
                      ? "Quickly stock multiple ingredients into your pantry at once."
                      : "Add a single ingredient to your pantry."}
                  </p>
                )}
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Mode Switcher Tabs for Add */}
            {!editingItem && (
              <div className="flex border-b border-gray-200 mt-3">
                <button
                  type="button"
                  onClick={() => setModalMode("single")}
                  className={`pb-2.5 text-xs font-semibold border-b-2 mr-6 transition-colors ${
                    modalMode === "single"
                      ? "border-black text-black"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Single Item
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode("bulk")}
                  className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                    modalMode === "bulk"
                      ? "border-black text-black"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  ⚡ Bulk Add Multiple Items
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveItem} className="mt-4 space-y-4">
              {modalMode === "single" ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Item Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Wheat Flour, Basmati Rice, Red Onions"
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
                        placeholder="e.g. 2, 500, 1.5"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-black focus:ring-1 focus:ring-black"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Expiry Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-black focus:ring-1 focus:ring-black"
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* Bulk Add Rows */
                <div className="space-y-3">
                  <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs font-semibold text-gray-600 px-1">
                    <span className="col-span-4">Item Name *</span>
                    <span className="col-span-3">Category</span>
                    <span className="col-span-2">Qty *</span>
                    <span className="col-span-2">Unit</span>
                    <span className="col-span-1 text-center"></span>
                  </div>

                  <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                    {bulkRows.map((row, idx) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 sm:p-0 rounded-lg border sm:border-0 border-gray-200 bg-gray-50/50 sm:bg-transparent"
                      >
                        <div className="sm:col-span-4">
                          <input
                            type="text"
                            placeholder={`e.g. Item ${idx + 1}`}
                            value={row.item_name}
                            onChange={(e) => handleBulkChange(row.id, "item_name", e.target.value)}
                            className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-black focus:ring-1 focus:ring-black bg-white"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <select
                            value={row.category}
                            onChange={(e) => handleBulkChange(row.id, "category", e.target.value)}
                            className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-black focus:ring-1 focus:ring-black bg-white"
                          >
                            {CATEGORIES.filter((c) => c !== "All").map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            placeholder="Qty"
                            value={row.quantity}
                            onChange={(e) => handleBulkChange(row.id, "quantity", e.target.value)}
                            className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-black focus:ring-1 focus:ring-black bg-white"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <select
                            value={row.unit}
                            onChange={(e) => handleBulkChange(row.id, "unit", e.target.value)}
                            className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-black focus:ring-1 focus:ring-black bg-white"
                          >
                            {COMMON_UNITS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-1 flex items-center justify-end sm:justify-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveBulkRow(row.id)}
                            disabled={bulkRows.length <= 1}
                            className="rounded p-1 text-gray-400 hover:text-red-600 disabled:opacity-30"
                            title="Remove row"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddBulkRow}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-black hover:underline"
                  >
                    + Add Another Item Row
                  </button>
                </div>
              )}

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
                  {submitting
                    ? "Saving..."
                    : editingItem
                    ? "Update Item"
                    : modalMode === "bulk"
                    ? "Save All Items"
                    : "Add to Pantry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Delete Pantry Item?</h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to remove this item from your pantry inventory?
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

export default Pantry;