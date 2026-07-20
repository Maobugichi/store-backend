export interface SaleInput {
  inventoryId: number;
  saleType: "pack" | "piece" | "half_pack";
  quantity: number;
  saleDate?: string;
  
  overrideTotalPrice?: number;
}