export interface SaleInput {
  inventoryId: number;
  saleType: "pack" | "piece";
  quantity: number;
}
