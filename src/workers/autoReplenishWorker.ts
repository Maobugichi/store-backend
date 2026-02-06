import pool from "../config/db.js";

interface ReplenishResult {
  itemId: number;
  itemName: string;
  packsUsed: number;
  piecesAdded: number;
  newPiecesStock: number;
  newPacksStock: number;
}


export const autoReplenishStock = async (): Promise<ReplenishResult[]> => {
  const client = await pool.connect();
  const replenishedItems: ReplenishResult[] = [];

  try {
    await client.query('BEGIN');

   
    const lowStockItems = await client.query(
      `SELECT * FROM drinks_inventory 
       WHERE pieces_in_stock < 5 
       AND packs_in_stock > 0 
       FOR UPDATE`
    );

    for (const item of lowStockItems.rows) {
      
      const packsToOpen = Math.max(1, Math.floor(item.packs_in_stock / 2));
      
      
      const piecesToAdd = packsToOpen * item.pack_size;

     
      const updateResult = await client.query(
        `UPDATE drinks_inventory
         SET packs_in_stock = packs_in_stock - $1,
             pieces_in_stock = pieces_in_stock + $2
         WHERE id = $3
         RETURNING packs_in_stock, pieces_in_stock, name`,
        [packsToOpen, piecesToAdd, item.id]
      );

      const updated = updateResult.rows[0];

      replenishedItems.push({
        itemId: item.id,
        itemName: updated.name,
        packsUsed: packsToOpen,
        piecesAdded: piecesToAdd,
        newPiecesStock: updated.pieces_in_stock,
        newPacksStock: updated.packs_in_stock
      });

      console.log(
        `Replenished ${updated.name}: Opened ${packsToOpen} pack(s), ` +
        `added ${piecesToAdd} pieces. New stock: ${updated.pieces_in_stock} pieces, ` +
        `${updated.packs_in_stock} packs`
      );
    }

    await client.query('COMMIT');
    return replenishedItems;

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Auto-replenish failed:', err);
    throw err;
  } finally {
    client.release();
  }
};


export const startAutoReplenishWorker = (intervalMinutes: number = 5): NodeJS.Timeout => {
  console.log(`Auto-replenish worker started (checking every ${intervalMinutes} minutes)`);

  
  autoReplenishStock().catch(err => {
    console.error('Initial replenish check failed:', err);
  });

  
  const intervalMs = intervalMinutes * 60 * 1000;
  
  return setInterval(async () => {
    try {
      const results = await autoReplenishStock();
      
      if (results.length > 0) {
        console.log(`Replenished ${results.length} item(s)`);
      } else {
        console.log('tock levels OK - no replenishment needed');
      }
    } catch (err) {
      console.error('Scheduled replenish check failed:', err);
    }
  }, intervalMs);
};


export const stopAutoReplenishWorker = (interval: NodeJS.Timeout): void => {
  clearInterval(interval);
  console.log('Auto-replenish worker stopped');
};