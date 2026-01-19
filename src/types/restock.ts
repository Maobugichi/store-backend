export interface RestockInput {
  inventoryId: number;
  packsAdded?: number;
  piecesAdded?: number;
  purchasePricePack?: number;
  sellingPricePack?: number;
}
