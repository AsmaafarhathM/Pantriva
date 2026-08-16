export interface BudgetRecord {
  id: number;
  user_id: number;
  amount: number;
}

export interface BudgetCreate {
  amount: number;
}

export interface BudgetStatusSummary {
  budget: number;
  estimated_cost: number;
  remaining: number;
  status: "OVER_BUDGET" | "NEAR_LIMIT" | "WITHIN_BUDGET" | string;
}
