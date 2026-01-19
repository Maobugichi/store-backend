import pool from "../config/db.js";
import type { RestockInput } from "../types/restock.js";

export async function restockItem(input: RestockInput) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.packsAdded) {
      updates.push(`packs_in_stock = packs_in_stock + $${idx++}`);
      values.push(input.packsAdded);
    }

    if (input.piecesAdded) {
      updates.push(`pieces_in_stock = pieces_in_stock + $${idx++}`);
      values.push(input.piecesAdded);
    }

    if (input.purchasePricePack) {
      updates.push(`purchase_price_pack = $${idx++}`);
      values.push(input.purchasePricePack);
    }

    if (input.sellingPricePack) {
      updates.push(`selling_price_pack = $${idx++}`);
      values.push(input.sellingPricePack);
    }

    if (updates.length === 0) {
      throw new Error("No restock data provided");
    }

    values.push(input.inventoryId);

    const query = `
      UPDATE drinks_inventory
      SET ${updates.join(", ")}
      WHERE id = $${idx}
      RETURNING *;
    `;

    const { rows } = await client.query(query, values);

    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
