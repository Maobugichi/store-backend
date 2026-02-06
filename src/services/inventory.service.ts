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