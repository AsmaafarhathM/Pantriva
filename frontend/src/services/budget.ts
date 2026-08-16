import api from "./api";
import type {
  BudgetRecord,
  BudgetCreate,
  BudgetStatusSummary
} from "../types/budget";

export const getBudgetApi = async (): Promise<BudgetRecord> => {
  const response = await api.get<BudgetRecord>("/api/budget/");
  return response.data;
};

export const setBudgetApi = async (data: BudgetCreate): Promise<BudgetRecord> => {
  const response = await api.post<BudgetRecord>("/api/budget/", data);
  return response.data;
};

export const getBudgetSummaryApi = async (): Promise<BudgetStatusSummary> => {
  const response = await api.get<BudgetStatusSummary>("/api/budget/summary");
  return response.data;
};
