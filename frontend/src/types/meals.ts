export interface GeneratedIngredient {
  ingredient_name: string;
  quantity: number;
  unit: string;
}

export interface GeneratedMeal {
  meal_name: string;
  ingredients: GeneratedIngredient[];
}

export interface GeneratedDayPlan {
  day: number;
  breakfast: GeneratedMeal;
  lunch: GeneratedMeal;
  dinner: GeneratedMeal;
}

export interface MealPlanStructure {
  meal_plan: GeneratedDayPlan[];
}

export interface MealGenerateRequest {
  people: number;
  days: number;
  budget: number;
  diet: string;
  avoid?: string[];
}

export interface MealGenerateResponse {
  message: string;
  meal_plan: MealPlanStructure;
  saved_meals: number;
  meal_plan_id: number;
}

export interface MealIngredientItem {
  id: number;
  meal_id: number;
  ingredient_name: string;
  quantity: number;
  unit: string;
}

export interface MealItem {
  id: number;
  user_id: number;
  meal_plan_id?: number | null;
  day: string;
  meal_type: string;
  meal_name: string;
  created_at?: string;
  ingredients: MealIngredientItem[];
}

export interface MealPlanSummary {
  id: number;
  user_id: number;
  number_of_people: number;
  number_of_days: number;
  budget: number;
  diet: string;
  created_at: string;
}

export interface MealPlanDetail extends MealPlanSummary {
  meals: MealItem[];
}
