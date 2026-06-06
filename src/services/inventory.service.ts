import pool from "../config/db.js";

export const getInventoryOverview = async() => {
    const query = `
      SELECT 
        d.id,
        d.name,
        d.pack_size,
        d.packs_in_stock,
        d.pieces_in_stock,

        d.selling_price_pack,
        d.purchase_price_pack,
        
       
        COALESCE(
          d.selling_price_piece, 
          d.selling_price_pack / NULLIF(d.pack_size, 0),
          0
        ) AS selling_price_piece,
        
       
        COALESCE(
          d.purchase_price_piece, 
          d.purchase_price_pack / NULLIF(d.pack_size, 0),
          0
        ) AS purchase_price_piece,

        
        (d.packs_in_stock * d.pack_size + d.pieces_in_stock) AS total_pieces,

       
        (
          (d.packs_in_stock * d.pack_size + d.pieces_in_stock) * 
          COALESCE(
            d.selling_price_piece, 
            d.selling_price_pack / NULLIF(d.pack_size, 0),
            0
          )
        ) AS stock_value,

        -- Stock cost at purchase price (money invested)
        (
          (d.packs_in_stock * d.pack_size + d.pieces_in_stock) * 
          COALESCE(
            d.purchase_price_piece, 
            d.purchase_price_pack / NULLIF(d.pack_size, 0),
            0
          )
        ) AS stock_cost,

        -- Potential profit
        (
          (d.packs_in_stock * d.pack_size + d.pieces_in_stock) * 
          COALESCE(
            d.selling_price_piece, 
            d.selling_price_pack / NULLIF(d.pack_size, 0),
            0
          )
        ) - (
          (d.packs_in_stock * d.pack_size + d.pieces_in_stock) * 
          COALESCE(
            d.purchase_price_piece, 
            d.purchase_price_pack / NULLIF(d.pack_size, 0),
            0
          )
        ) AS potential_profit

      FROM drinks_inventory d
      ORDER BY d.name
    `;

    const { rows } = await pool.query(query);
    return rows;
}

export interface CreateInventoryItemInput {
  name: string;
  pack_size: number;
  packs_in_stock: number;
  pieces_in_stock: number;
  purchase_price_pack?: number | null | undefined;
  purchase_price_piece?: number | null | undefined;
  selling_price_pack?: number | null | undefined;
  selling_price_piece?: number | null | undefined;
  low_stock_threshold?: number | null | undefined;
}

export const createInventoryItem = async (data: CreateInventoryItemInput) => {
  const {
    name,
    pack_size,
    packs_in_stock,
    pieces_in_stock,
    purchase_price_pack,
    purchase_price_piece,
    selling_price_pack,
    selling_price_piece,
    low_stock_threshold,
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO drinks_inventory (
      name, pack_size, packs_in_stock, pieces_in_stock,
      purchase_price_pack, purchase_price_piece,
      selling_price_pack, selling_price_piece,
      low_stock_threshold
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *`,
    [
      name,
      pack_size,
      packs_in_stock,
      pieces_in_stock,
      purchase_price_pack ?? null,
      purchase_price_piece ?? null,
      selling_price_pack ?? null,
      selling_price_piece ?? null,
      low_stock_threshold ?? null,
    ]
  );

  return rows[0];
};