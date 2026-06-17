

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


export function resolveHalfPackPricing(input: Pick<PricingInput, "sellingPricePack" | "purchasePricePack">) {
  const { sellingPricePack, purchasePricePack } = input;

  if (!sellingPricePack || !purchasePricePack) {
    throw new Error("Pack pricing not configured — cannot derive half-pack price");
  }

  return {
    sellingPriceHalfPack: sellingPricePack / 2,
    purchasePriceHalfPack: purchasePricePack / 2,
  };
}