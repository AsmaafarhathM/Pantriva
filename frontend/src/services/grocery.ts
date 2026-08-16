import api from "./api";
import type {
  GroceryItem,
  GroceryItemCreate,
  GroceryGenerateResponse
} from "../types/grocery";

export const generateGroceryListApi = async (): Promise<GroceryGenerateResponse> => {
  const response = await api.post<GroceryGenerateResponse>("/api/grocery/generate");
  return response.data;
};

export const getGroceryItemsApi = async (): Promise<GroceryItem[]> => {
  const response = await api.get<GroceryItem[]>("/api/grocery/");
  return response.data;
};

export const getGroceryItemByIdApi = async (itemId: number): Promise<GroceryItem> => {
  const response = await api.get<GroceryItem>(`/api/grocery/${itemId}`);
  return response.data;
};

export const createGroceryItemApi = async (data: GroceryItemCreate): Promise<GroceryItem> => {
  const response = await api.post<GroceryItem>("/api/grocery/", data);
  return response.data;
};

export const updateGroceryItemApi = async (
  itemId: number,
  data: GroceryItemCreate
): Promise<GroceryItem> => {
  const response = await api.put<GroceryItem>(`/api/grocery/${itemId}`, data);
  return response.data;
};

export const deleteGroceryItemApi = async (itemId: number): Promise<{ message: string }> => {
  const response = await api.delete<{ message: string }>(`/api/grocery/${itemId}`);
  return response.data;
};

export const toggleGroceryPurchaseApi = async (itemId: number): Promise<GroceryItem> => {
  const response = await api.patch<GroceryItem>(`/api/grocery/${itemId}/purchase`);
  return response.data;
};
