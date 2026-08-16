import { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getMealPlansApi, getMealPlanDetailApi } from "../services/meals";
import { getPantryItems } from "../services/pantry";
import type {
  MealPlanSummary,
  MealPlanDetail,
  MealItem
} from "../types/meals";
import type { PantryItem } from "../types/pantry";

function Meals() {
  const [searchParams, setSearchParams] = useSearchParams();
  const planIdFromQuery = searchParams.get("planId");

  const [mealPlans, setMealPlans] = useState<MealPlanSummary[]>([]);
  const [selectedPlanDetail, setSelectedPlanDetail] = useState<MealPlanDetail | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(
    planIdFromQuery ? parseInt(planIdFromQuery) : null
  );

  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Load all plans and pantry items
  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [plans, pantry] = await Promise.all([
        getMealPlansApi(),
        getPantryItems().catch(() => [])
      ]);

      setMealPlans(plans);
      setPantryItems(pantry);

      // If there's a planId in query or if plans exist, load the target or first plan
      const targetId = planIdFromQuery ? parseInt(planIdFromQuery) : (plans.length > 0 ? plans[0].id : null);
      if (targetId) {
        loadPlanDetail(targetId);
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      setError(errorObj.response?.data?.detail || "Failed to load meal plans.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const loadPlanDetail = async (planId: number) => {
    setSelectedPlanId(planId);
    setSearchParams({ planId: String(planId) });
    setLoadingDetail(true);
    try {
      const detail = await getMealPlanDetailApi(planId);
      setSelectedPlanDetail(detail);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      setError(errorObj.response?.data?.detail || `Failed to load details for meal plan #${planId}.`);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Helper to cross-reference ingredient with user's pantry
  const isIngredientInPantry = (name: string): boolean => {
    const cleanName = name.toLowerCase().trim();
    return pantryItems.some((p) => {
      const pName = p.item_name.toLowerCase().trim();
      return pName.includes(cleanName) || cleanName.includes(pName);
    });
  };

  // Group meals by day
  const mealsByDay = useMemo(() => {
    if (!selectedPlanDetail || !selectedPlanDetail.meals) return {};

    const grouped: Record<string, MealItem[]> = {};

    selectedPlanDetail.meals.forEach((meal) => {
      const dayKey = meal.day || "day_1";
      if (!grouped[dayKey]) {
        grouped[dayKey] = [];
      }
      grouped[dayKey].push(meal);
    });

    return grouped;
  }, [selectedPlanDetail]);

  const formatDayTitle = (dayKey: string): string => {
    const match = dayKey.match(/\d+/);
    if (match) {
      return `Day ${match[0]}`;
    }
    return dayKey.replace("_", " ").toUpperCase();
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Saved Meal Plans
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Review historical meal schedules, recipe ingredients, and pantry inventory status.
          </p>
        </div>
        <Link
          to="/meal-planner"
          className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-gray-800 transition-colors"
        >
          + Generate New Plan
        </Link>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-800 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError("")} className="text-red-600 hover:text-red-800 font-bold">✕</button>
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="h-48 rounded-xl border border-gray-200 bg-white p-5 animate-pulse">
              <div className="h-6 w-3/4 bg-gray-200 rounded"></div>
              <div className="mt-4 h-4 w-1/2 bg-gray-200 rounded"></div>
              <div className="mt-2 h-4 w-2/3 bg-gray-200 rounded"></div>
              <div className="mt-6 h-8 bg-gray-100 rounded"></div>
            </div>
          ))}
        </div>
      ) : mealPlans.length === 0 ? (
        <div className="mt-10 rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-2xl">
            🍽️
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900">
            No meal plans yet
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Generate your first meal plan tailored to your budget, diet, and pantry stock.
          </p>
          <Link
            to="/meal-planner"
            className="mt-6 inline-flex items-center rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Create Meal Plan →
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          {/* Left Column: List of Plans */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">
              Your Plans ({mealPlans.length})
            </h2>

            <div className="space-y-3">
              {mealPlans.map((plan) => {
                const isSelected = plan.id === selectedPlanId;
                return (
                  <div
                    key={plan.id}
                    onClick={() => loadPlanDetail(plan.id)}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${
                      isSelected
                        ? "border-black bg-white shadow-md ring-1 ring-black"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-xs"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-base text-gray-900">
                        {plan.number_of_days}-Day {plan.diet} Plan
                      </h3>
                      <span className="text-xs font-semibold text-gray-500">
                        #{plan.id}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-gray-600 space-y-1">
                      <p>👥 Serves: <span className="font-medium text-gray-800">{plan.number_of_people} People</span></p>
                      <p>💰 Budget: <span className="font-medium text-gray-800">₹{plan.budget}</span></p>
                      <p className="text-gray-400 pt-1 text-[11px]">
                        Created: {formatDate(plan.created_at)}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className={`text-xs font-medium ${isSelected ? "text-black font-semibold" : "text-gray-500"}`}>
                        {isSelected ? "● Viewing Plan" : "Click to view"}
                      </span>
                      <span className="text-xs text-gray-400">→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Plan Details */}
          <div className="lg:col-span-8">
            {loadingDetail ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 animate-pulse space-y-4">
                <div className="h-6 w-1/3 bg-gray-200 rounded"></div>
                <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
                <div className="grid gap-4 mt-6 md:grid-cols-3">
                  <div className="h-40 bg-gray-100 rounded-xl"></div>
                  <div className="h-40 bg-gray-100 rounded-xl"></div>
                  <div className="h-40 bg-gray-100 rounded-xl"></div>
                </div>
              </div>
            ) : selectedPlanDetail ? (
              <div className="space-y-6">
                {/* Plan Overview Card */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-gray-100 gap-2">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {selectedPlanDetail.number_of_days}-Day {selectedPlanDetail.diet} Meal Schedule
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Plan #{selectedPlanDetail.id} • Created on {formatDate(selectedPlanDetail.created_at)}
                      </p>
                    </div>
                    <Link
                      to="/grocery"
                      className="inline-flex items-center rounded-lg bg-black px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 transition-colors"
                    >
                      View Shopping List →
                    </Link>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Duration</p>
                      <p className="text-base font-bold text-gray-900 mt-1">{selectedPlanDetail.number_of_days} Days</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">People</p>
                      <p className="text-base font-bold text-gray-900 mt-1">{selectedPlanDetail.number_of_people} Servings</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Budget</p>
                      <p className="text-base font-bold text-gray-900 mt-1">₹{selectedPlanDetail.budget}</p>
                    </div>
                  </div>
                </div>

                {/* Day by Day Meal Breakdown */}
                <div className="space-y-6">
                  {Object.entries(mealsByDay).map(([dayKey, dayMeals]) => (
                    <div
                      key={dayKey}
                      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs"
                    >
                      <h3 className="text-base font-bold text-gray-900 pb-3 border-b border-gray-100 mb-4">
                        {formatDayTitle(dayKey)}
                      </h3>

                      <div className="grid gap-4 md:grid-cols-3">
                        {dayMeals.map((meal) => {
                          const mealTypeLower = meal.meal_type.toLowerCase();
                          const isBreakfast = mealTypeLower.includes("breakfast");
                          const isLunch = mealTypeLower.includes("lunch");

                          const badgeStyle = isBreakfast
                            ? "bg-orange-50 text-orange-700 border-orange-100"
                            : isLunch
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-indigo-50 text-indigo-700 border-indigo-100";

                          return (
                            <div
                              key={meal.id}
                              className={`rounded-xl p-4 border flex flex-col justify-between ${badgeStyle}`}
                            >
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                                  {meal.meal_type}
                                </span>
                                <h4 className="mt-1 text-sm font-bold text-gray-900">
                                  {meal.meal_name}
                                </h4>

                                <div className="mt-3 border-t border-gray-200/50 pt-2">
                                  <p className="text-[11px] font-semibold text-gray-700 mb-1">
                                    Ingredients ({meal.ingredients.length}):
                                  </p>
                                  <ul className="space-y-1.5 text-xs text-gray-600">
                                    {meal.ingredients.map((ing) => {
                                      const inPantry = isIngredientInPantry(ing.ingredient_name);
                                      return (
                                        <li key={ing.id} className="flex items-center justify-between text-[11px]">
                                          <span className="truncate pr-1">• {ing.ingredient_name} ({ing.quantity} {ing.unit})</span>
                                          <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                                            inPantry
                                              ? "bg-emerald-100 text-emerald-800"
                                              : "bg-gray-100 text-gray-600"
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
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-gray-500">
                Select a meal plan from the left to view its daily breakdown.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Meals;
