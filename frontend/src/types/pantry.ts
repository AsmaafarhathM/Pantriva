export interface PantryItem {
  id: number;
  user_id?: number;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  expiry_date?: string | null;
  created_at?: string | null;
}

export interface PantryItemCreate {
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  expiry_date?: string | null;
}

export type ExpiryStatusType = "EXPIRED" | "EXPIRING_SOON" | "GOOD" | "NO_EXPIRY_DATE";

export interface PantryExpiryItem {
  id: number;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  expiry_date?: string | null;
  days_remaining?: number | null;
  status: ExpiryStatusType;
}
