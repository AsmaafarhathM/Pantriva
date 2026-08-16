import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { generateMealPlanApi } from "../services/meals";
import { generateGroceryListApi } from "../services/grocery";
import { getPantryItems } from "../services/pantry";
import type {
  MealPlanStructure,
  GeneratedDayPlan
} from "../types/meals";
import type { GroceryItem, BudgetSummary } from "../types/grocery";
import type { PantryItem } from "../types/pantry";

const DIET_OPTIONS = [
  "Vegetarian",
  "Non-Vegetarian",
  "Vegan",
  "Eggetarian",
  "Jain",
  "South Indian",
  "North Indian",
  "High Protein"
];

function MealPlanner() {
  // Configuration Inputs
  const [people, setPeople] = useState<number>(2);
  const [days, setDays] = useState<number>(3);
  const [diet, setDiet] = useState<string>("Vegetarian");
  const [budget, setBudget] = useState<number>(1200);
  const [avoidInput, setAvoidInput] = useState<string>("");
  const [avoidList, setAvoidList] = useState<string[]>([]);

  // Pantry state
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);

  // Generation status
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Result state
  const [generatedPlan, setGeneratedPlan] = useState<MealPlanStructure | null>(null);
  const [mealPlanId, setMealPlanId] = useState<number | null>(null);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [activeTab, setActiveTab] = useState<"plan" | "grocery" | "budget">("plan");

  // Load user's pantry summary on mount
  useEffect(() => {
    getPantryItems()
      .then((items) => setPantryItems(items))
      .catch(() => setPantryItems([]));
  }, []);

  const handleAddAvoid = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && avoidInput.trim()) {
      e.preventDefault();
      const val = avoidInput.trim();
      if (!avoidList.includes(val)) {
        setAvoidList([...avoidList, val]);
      }
      setAvoidInput("");
    }
  };

  const handleRemoveAvoid = (tag: string) => {
    setAvoidList(avoidList.filter((t) => t !== tag));
  };

  const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (people < 1) {
      setError("Number of people must be at least 1.");
      return;
    }
    if (days < 1 || days > 14) {
      setError("Number of days must be between 1 and 14.");
      return;
    }
    if (budget <= 0) {
      setError("Please enter a valid positive budget amount.");
      return;
    }

    setError("");
    setGenerating(true);
    setGeneratedPlan(null);
    setGroceryItems([]);
    setBudgetSummary(null);

    try {
      // 1. Call AI meal generation backend
      const mealResponse = await generateMealPlanApi({
        people,
        days,
        budget,
        diet,
        avoid: avoidList
      });

      setGeneratedPlan(mealResponse.meal_plan);
      setMealPlanId(mealResponse.meal_plan_id);

      // 2. Automatically generate the synchronized grocery list & CEDA budget estimate
      try {
        const groceryResponse = await generateGroceryListApi();
        setGroceryItems(groceryResponse.items);
        setBudgetSummary(groceryResponse.budget_summary);
      } catch {
        // Non-blocking if grocery generation has separate step
      }

      setSuccessMsg("Your personalized AI meal plan has been generated and saved!");
      setActiveTab("plan");
    } catch (err: unknown) {
      const errorObj = err as { response?: { status?: number; data?: { detail?: string } } };
      const status = errorObj.response?.status;
      if (status === 422) {
        setError("AI output validation failed. Please retry generation.");
      } else if (status === 502) {
        setError("AI generation service is temporarily unavailable. Please try again in a moment.");
      } else {
        setError(errorObj.response?.data?.detail || "Unable to generate your meal plan. Please try again.");
      }
    } finally {
      setGenerating(false);
    }
  };

  // Helper to check if an ingredient is available in user's pantry
  const isIngredientInPantry = (name: string): boolean => {
    const cleanName = name.toLowerCase().trim();
    return pantryItems.some((p) => {
      const pName = p.item_name.toLowerCase().trim();
      return pName.includes(cleanName) || cleanName.includes(pName);
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            AI Meal Planner
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Generate customized weekly meal plans optimized for your pantry inventory, dietary preferences, and budget.
          </p>
        </div>
        {pantryItems.length > 0 && (
          <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 border border-emerald-200 text-xs font-medium text-emerald-800">
            <span>✓ {pantryItems.length} pantry items ready to be utilized</span>
          </div>
        )}
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="mt-4 rounded-lg bg-emerald-50 p-4 border border-emerald-200 text-sm text-emerald-800 flex items-center justify-between">
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-600 hover:text-emerald-800 font-bold">✕</button>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-800 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError("")} className="text-red-600 hover:text-red-800 font-bold">✕</button>
        </div>
      )}

      {/* Generator Configuration Form */}
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Plan Parameters
        </h2>

        <form onSubmit={handleGenerate} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Number of People */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Number of People <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={people}
                onChange={(e) => setPeople(parseInt(e.target.value) || 1)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-black focus:ring-1 focus:ring-black"
                required
              />
            </div>

            {/* Number of Days */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Number of Days <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="14"
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value) || 1)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-black focus:ring-1 focus:ring-black"
                required
              />
            </div>

            {/* Diet Preference */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Diet Preference <span className="text-red-500">*</span>
              </label>
              <select
                value={diet}
                onChange={(e) => setDiet(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-black focus:ring-1 focus:ring-black"
              >
                {DIET_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Budget (INR) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Budget (INR ₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="100"
                step="50"
                value={budget}
                onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-black focus:ring-1 focus:ring-black"
                required
              />
            </div>
          </div>

          {/* Foods to Avoid */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Foods / Allergens to Avoid (Optional)
            </label>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-300 p-2 bg-gray-50/50">
              {avoidList.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-gray-800 border border-gray-200 shadow-2xs"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveAvoid(tag)}
                    className="text-gray-400 hover:text-red-500 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder="Type ingredient and press Enter (e.g. Mushroom, Peanut)"
                value={avoidInput}
                onChange={(e) => setAvoidInput(e.target.value)}
                onKeyDown={handleAddAvoid}
                className="flex-1 min-w-[200px] border-none bg-transparent p-1 text-sm text-gray-900 focus:outline-none placeholder-gray-400"
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              💡 Pantriva compares required meal ingredients against your pantry and estimates market prices using CEDA Agmarknet wholesale data.
            </p>

            <button
              type="submit"
              disabled={generating}
              className="w-full sm:w-auto min-w-[220px] rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Creating your meal plan...</span>
                </>
              ) : (
                <span>✨ Generate Meal Plan</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Generated Result Section */}
      {generatedPlan && (
        <div className="mt-10 space-y-6">
          {/* Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-gray-200">
            <div className="flex space-x-4 sm:space-x-8 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveTab("plan")}
                className={`pb-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === "plan"
                    ? "border-black text-black"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                🍽️ Daily Meal Plan ({generatedPlan.meal_plan.length} Days)
              </button>
              <button
                onClick={() => setActiveTab("grocery")}
                className={`pb-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === "grocery"
                    ? "border-black text-black"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                🛒 Shopping List ({groceryItems.length} Items)
              </button>
              <button
                onClick={() => setActiveTab("budget")}
                className={`pb-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === "budget"
                    ? "border-black text-black"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                💰 Budget & Cost Breakdown
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-3 pb-3">
              <Link
                to="/meals"
                className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
              >
                View Saved Meals →
              </Link>
              <Link
                to="/grocery"
                className="rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
              >
                Open Grocery List →
              </Link>
            </div>
          </div>

          {/* TAB 1: Daily Meal Plan */}
          {activeTab === "plan" && (
            <div className="space-y-6">
              {generatedPlan.meal_plan.map((dayPlan: GeneratedDayPlan) => (
                <div
                  key={dayPlan.day}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                      Day {dayPlan.day}
                    </h3>
                    <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                      {diet} • {people} People
                    </span>
                  </div>

                  <div className="grid gap-6 md:grid-cols-3">
                    {/* Breakfast */}
                    <div className="rounded-xl bg-orange-50/40 p-4 border border-orange-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-orange-700">
                          🍳 Breakfast
                        </span>
                      </div>
                      <h4 className="mt-2 text-base font-semibold text-gray-900">
                        {dayPlan.breakfast.meal_name}
                      </h4>
                      <ul className="mt-3 space-y-1.5 text-xs text-gray-600 border-t border-orange-100/60 pt-2">
                        {dayPlan.breakfast.ingredients.map((ing, i) => {
                          const inPantry = isIngredientInPantry(ing.ingredient_name);
                          return (
                            <li key={i} className="flex items-center justify-between">
                              <span>• {ing.ingredient_name} ({ing.quantity} {ing.unit})</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                inPantry ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                              }`}>
                                {inPantry ? "In Pantry" : "To Buy"}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* Lunch */}
                    <div className="rounded-xl bg-emerald-50/40 p-4 border border-emerald-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                          🥗 Lunch
                        </span>
                      </div>
                      <h4 className="mt-2 text-base font-semibold text-gray-900">
                        {dayPlan.lunch.meal_name}
                      </h4>
                      <ul className="mt-3 space-y-1.5 text-xs text-gray-600 border-t border-emerald-100/60 pt-2">
                        {dayPlan.lunch.ingredients.map((ing, i) => {
                          const inPantry = isIngredientInPantry(ing.ingredient_name);
                          return (
                            <li key={i} className="flex items-center justify-between">
                              <span>• {ing.ingredient_name} ({ing.quantity} {ing.unit})</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                inPantry ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                              }`}>
                                {inPantry ? "In Pantry" : "To Buy"}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* Dinner */}
                    <div className="rounded-xl bg-indigo-50/40 p-4 border border-indigo-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                          🍲 Dinner
                        </span>
                      </div>
                      <h4 className="mt-2 text-base font-semibold text-gray-900">
                        {dayPlan.dinner.meal_name}
                      </h4>
                      <ul className="mt-3 space-y-1.5 text-xs text-gray-600 border-t border-indigo-100/60 pt-2">
                        {dayPlan.dinner.ingredients.map((ing, i) => {
                          const inPantry = isIngredientInPantry(ing.ingredient_name);
                          return (
                            <li key={i} className="flex items-center justify-between">
                              <span>• {ing.ingredient_name} ({ing.quantity} {ing.unit})</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                inPantry ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                              }`}>
                                {inPantry ? "In Pantry" : "To Buy"}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: Shopping List */}
          {activeTab === "grocery" && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Calculated Grocery Requirements
                  </h3>
                  <p className="text-xs text-gray-500">
                    Missing ingredients aggregated across all planned meals minus current pantry stock.
                  </p>
                </div>
                <Link
                  to="/grocery"
                  className="rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                >
                  Manage in Grocery Page →
                </Link>
              </div>

              {groceryItems.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  🎉 Great news! All required meal ingredients are already available in your pantry inventory.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {groceryItems.map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{item.item_name}</p>
                        <p className="text-xs text-gray-500">
                          {item.quantity} {item.unit} • {item.category}
                        </p>
                      </div>
                      <div className="text-right">
                        {item.estimated_price !== null && item.estimated_price !== undefined ? (
                          <>
                            <p className="text-sm font-bold text-gray-900">
                              ₹{item.estimated_price.toFixed(2)}
                            </p>
                            <p className="text-[10px] text-gray-500">CEDA Mandi rate</p>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 italic">
                            Price unavailable
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Budget & Cost Breakdown */}
          {activeTab === "budget" && budgetSummary && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs">
              <h3 className="text-lg font-bold text-gray-900 mb-6">
                Financial & Budget Summary
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Allocated Budget</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">₹{budgetSummary.budget.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Estimated Grocery Cost</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">₹{budgetSummary.total_estimated_cost.toFixed(2)}</p>
                </div>
                <div className={`rounded-xl border p-5 ${
                  budgetSummary.remaining_budget >= 0 ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"
                }`}>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Remaining Balance</p>
                  <p className={`mt-2 text-2xl font-bold ${
                    budgetSummary.remaining_budget >= 0 ? "text-emerald-700" : "text-red-700"
                  }`}>
                    ₹{budgetSummary.remaining_budget.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Status Badge & Notes */}
              <div className="rounded-xl bg-gray-50 p-4 border border-gray-200 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">Budget Status:</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                    budgetSummary.status === "within_budget"
                      ? "bg-emerald-100 text-emerald-800"
                      : budgetSummary.status === "partially_estimated"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-red-100 text-red-800"
                  }`}>
                    {budgetSummary.status.replace("_", " ")}
                  </span>
                </div>
                {budgetSummary.items_without_price.length > 0 && (
                  <p className="text-xs text-amber-800">
                    ℹ️ Market rates for ({budgetSummary.items_without_price.join(", ")}) could not be fetched from CEDA and are excluded from the total.
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  Prices are based on live CEDA Agmarknet mandi wholesale data and converted to metric units.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MealPlanner;
