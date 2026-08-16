import api from "./api";
import type {
  MealGenerateRequest,
  MealGenerateResponse,
  MealPlanSummary,
  MealPlanDetail,
  MealItem
} from "../types/meals";

export const generateMealPlanApi = async (
  data: MealGenerateRequest
): Promise<MealGenerateResponse> => {
  const response = await api.post<MealGenerateResponse>("/api/meals/generate", data);
  return response.data;
};

export const getMealPlansApi = async (): Promise<MealPlanSummary[]> => {
  const response = await api.get<MealPlanSummary[]>("/api/meals/plans");
  return response.data;
};

export const getMealPlanDetailApi = async (planId: number): Promise<MealPlanDetail> => {
  const response = await api.get<MealPlanDetail>(`/api/meals/plans/${planId}`);
  return response.data;
};

export const getMealsApi = async (): Promise<MealItem[]> => {
  const response = await api.get<MealItem[]>("/api/meals/");
  return response.data;
};

export const getMealByIdApi = async (mealId: number): Promise<MealItem> => {
  const response = await api.get<MealItem>(`/api/meals/${mealId}`);
  return response.data;
};
