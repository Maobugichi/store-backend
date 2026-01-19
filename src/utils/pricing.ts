

interface PricingInput {
  packSize: number;
  sellingPricePack?: number | null;
  sellingPricePiece?: number | null;
  purchasePricePack?: number | null;
  purchasePricePiece?: number | null;
}

export function resolvePricing(input: PricingInput) {
  const {
    packSize,
    sellingPricePack,
    sellingPricePiece,
    purchasePricePack,
    purchasePricePiece,
  } = input;

  const resolvedSellingPiece =
    sellingPricePiece ??
    (sellingPricePack ? sellingPricePack / packSize : null);

  const resolvedPurchasePiece =
    purchasePricePiece ??
    (purchasePricePack ? purchasePricePack / packSize : null);

  if (!resolvedSellingPiece || !resolvedPurchasePiece) {
    throw new Error("Unable to resolve per-piece pricing");
  }

  return {
    sellingPricePiece: resolvedSellingPiece,
    purchasePricePiece: resolvedPurchasePiece,
  };
}
