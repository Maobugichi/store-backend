import pool from "../config/db.js";
import type { DamageInput } from "../types/damage.js";
import { resolvePricing } from "../utils/pricing.js";

export const processDamage = async (input: DamageInput) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const inventoryRes = await client.query(
      `SELECT * FROM drinks_inventory WHERE id = $1 FOR UPDATE`,
      [input.inventoryId]
    );

    if (inventoryRes.rowCount === 0) throw new Error("Item not found");

    const item = inventoryRes.rows[0];

    const pricing = resolvePricing({
      packSize: item.pack_size,
      sellingPricePack: item.selling_price_pack,
      sellingPricePiece: item.selling_price_piece,
      purchasePricePack: item.purchase_price_pack,
      purchasePricePiece: item.purchase_price_piece,
    });

    const purchasePricePerUnit = pricing.purchasePricePiece;

    if (input.damageType === "pack_open") {
      if (item.packs_in_stock < 1) {
        throw new Error("No packs in stock to open");
      }
      if (input.quantity > item.pack_size) {
        throw new Error("Damaged quantity cannot exceed pack size");
      }
      if (input.quantity < 0) {
        throw new Error("Damaged quantity cannot be negative");
      }

      const goodPieces = item.pack_size - input.quantity;

      await client.query(
        `UPDATE drinks_inventory
         SET packs_in_stock  = packs_in_stock - 1,
             pieces_in_stock = pieces_in_stock + $1
         WHERE id = $2`,
        [goodPieces, input.inventoryId]
      );

    } else {
      if (item.pieces_in_stock < input.quantity) {
        throw new Error("Not enough pieces in stock");
      }

      await client.query(
        `UPDATE drinks_inventory SET pieces_in_stock = pieces_in_stock - $1 WHERE id = $2`,
        [input.quantity, input.inventoryId]
      );
    }

    const lossValue = purchasePricePerUnit * input.quantity;

    await client.query(
      `INSERT INTO drinks_damages
        (inventory_id, damage_type, quantity, purchase_price, loss_value, reason, damage_date)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [input.inventoryId, input.damageType, input.quantity, purchasePricePerUnit, lossValue, input.reason ?? null]
    );

    await client.query("COMMIT");

    return { success: true, lossValue, message: "Damage recorded successfully" };

  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};