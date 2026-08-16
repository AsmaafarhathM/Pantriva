export interface GroceryItem {
  id: number;
  user_id?: number;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  estimated_price?: number | null;
  is_purchased: boolean;
  created_at?: string;
}

export interface GroceryItemCreate {
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  estimated_price?: number | null;
}

export interface BudgetSummary {
  budget: number;
  total_estimated_cost: number;
  remaining_budget: number;
  status: "within_budget" | "over_budget" | "partially_estimated" | string;
  items_without_price: string[];
}

export interface GroceryGenerateResponse {
  message: string;
  items: GroceryItem[];
  budget_summary: BudgetSummary;
}
