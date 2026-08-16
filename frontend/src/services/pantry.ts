import api from "./api";
import type { PantryItem, PantryItemCreate, PantryExpiryItem } from "../types/pantry";

export const getPantryItems = async (): Promise<PantryItem[]> => {
  const response = await api.get<PantryItem[]>("/api/pantry/");
  return response.data;
};

export const getPantryExpiryStatus = async (): Promise<PantryExpiryItem[]> => {
  const response = await api.get<PantryExpiryItem[]>("/api/pantry/expiry-status");
  return response.data;
};

export const createPantryItem = async (data: PantryItemCreate): Promise<PantryItem> => {
  const response = await api.post<PantryItem>("/api/pantry/", data);
  return response.data;
};

export const createMultiplePantryItems = async (
  data: PantryItemCreate[]
): Promise<PantryItem[]> => {
  try {
    const response = await api.post<PantryItem[]>("/api/pantry/bulk", data);
    return response.data;
  } catch (err: unknown) {
    const errorObj = err as { response?: { status?: number } };
    // If bulk endpoint is not yet live or returning 405/404, fallback to parallel individual creation
    if (errorObj.response && (errorObj.response.status === 405 || errorObj.response.status === 404)) {
      const results = await Promise.all(data.map((item) => createPantryItem(item)));
      return results;
    }
    throw err;
  }
};

export const updatePantryItem = async (id: number, data: PantryItemCreate): Promise<PantryItem> => {
  const response = await api.put<PantryItem>(`/api/pantry/${id}`, data);
  return response.data;
};

export const deletePantryItem = async (id: number): Promise<{ message: string }> => {
  const response = await api.delete<{ message: string }>(`/api/pantry/${id}`);
  return response.data;
};
