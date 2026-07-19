import pool from "../config/db.js";
import type { SaleInput } from "../types/sale.js";
import { resolvePricing, resolveHalfPackPricing } from "../utils/pricing.js";

const VALID_SALE_TYPES = ["pack", "piece", "half_pack"] as const;
const SALE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const processSale = async (input: SaleInput) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // saleType is validated again here (not just in the route) because
    // this service can be called from other places later — never trust
    // that the only caller is the HTTP route.
    if (!VALID_SALE_TYPES.includes(input.saleType)) {
      throw new Error(`Invalid sale type: ${input.saleType}`);
    }

    if (input.saleDate) {
      if (!SALE_DATE_REGEX.test(input.saleDate)) {
        throw new Error("saleDate must be in YYYY-MM-DD format");
      }

      // Future-date check is done in Postgres, judged against Africa/Lagos
      // "today" — NOT JS Date math. JS Date comparisons here would silently
      // break near midnight depending on server timezone; Postgres with an
      // explicit AT TIME ZONE conversion does not have that ambiguity.
      const {
        rows: [{ is_valid }],
      } = await client.query(
        `SELECT $1::date <= (NOW() AT TIME ZONE 'Africa/Lagos')::date AS is_valid`,
        [input.saleDate]
      );

      if (!is_valid) {
        throw new Error("Sale date cannot be in the future");
      }
    }

    if (input.overrideSellingPrice != null && input.overrideSellingPrice <= 0) {
      throw new Error("Override selling price must be positive");
    }

    const inventoryRes = await client.query(
      `SELECT * FROM drinks_inventory WHERE id = $1 FOR UPDATE`,
      [input.inventoryId]
    );

    if (inventoryRes.rowCount === 0) throw new Error("Item not found");

    const item = inventoryRes.rows[0];

    let sellingPrice: number;
    let purchasePrice: number;

    if (input.saleType === "pack") {
      if (item.packs_in_stock < input.quantity) {
        throw new Error("Not enough packs in stock");
      }
      if (!item.selling_price_pack || !item.purchase_price_pack) {
        throw new Error("Pack pricing not configured");
      }

      sellingPrice = item.selling_price_pack;
      purchasePrice = item.purchase_price_pack;

      await client.query(
        `UPDATE drinks_inventory SET packs_in_stock = packs_in_stock - $1 WHERE id = $2`,
        [input.quantity, input.inventoryId]
      );
    } else if (input.saleType === "half_pack") {
      if (item.packs_in_stock < input.quantity) {
        throw new Error("Not enough packs in stock to sell half packs");
      }
      if (!item.selling_price_pack || !item.purchase_price_pack) {
        throw new Error("Pack pricing not configured");
      }

      sellingPrice = item.selling_price_pack / 2;
      purchasePrice = item.purchase_price_pack / 2;

      // Each half-pack sold: consume 1 full pack, return the other half as loose pieces
      await client.query(
        `UPDATE drinks_inventory
         SET packs_in_stock  = packs_in_stock  - $1,
             pieces_in_stock = pieces_in_stock + ($1 * ($2 / 2))
         WHERE id = $3`,
        [input.quantity, item.pack_size, input.inventoryId]
      );
    } else {
      if (item.pieces_in_stock < input.quantity) {
        throw new Error("Not enough pieces in stock");
      }

      const pricing = resolvePricing({
        packSize: item.pack_size,
        sellingPricePack: item.selling_price_pack,
        sellingPricePiece: item.selling_price_piece,
        purchasePricePack: item.purchase_price_pack,
        purchasePricePiece: item.purchase_price_piece,
      });

      sellingPrice = pricing.sellingPricePiece;
      purchasePrice = pricing.purchasePricePiece;

      await client.query(
        `UPDATE drinks_inventory SET pieces_in_stock = pieces_in_stock - $1 WHERE id = $2`,
        [input.quantity, input.inventoryId]
      );
    }

    if (input.overrideSellingPrice != null) {
      sellingPrice = input.overrideSellingPrice;
    }

    const profit = (sellingPrice - purchasePrice) * input.quantity;

    await client.query(
      `INSERT INTO daily_sales
        (inventory_id, sale_type, quantity, selling_price, purchase_price, profit, sale_date)
       VALUES ($1, $2, $3, $4, $5, $6,
         CASE
           -- Manual entry: take the chosen calendar date, stamp it with
           -- "right now" in Lagos time. Real-time sale (no saleDate): NOW().
           WHEN $7::date IS NOT NULL
             THEN ($7::date + (NOW() AT TIME ZONE 'Africa/Lagos')::time) AT TIME ZONE 'Africa/Lagos'
           ELSE NOW()
         END
       )`,
      [
        input.inventoryId,
        input.saleType,
        input.quantity,
        sellingPrice,
        purchasePrice,
        profit,
        input.saleDate ?? null,
      ]
    );

    await client.query("COMMIT");

    return { success: true, profit, message: "Sale processed successfully" };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};