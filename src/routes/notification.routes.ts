import { Router, type Request, type Response } from 'express';
import { Pool } from 'pg';
import { calculateTotalStock, checkLowStockAndNotify } from '../services/email.service.js';
import pool from '../config/db.js';

const router = Router();

interface InventoryItem {
  id: number;
  name: string;
  pack_size: number;
  packs_in_stock: number;
  pieces_in_stock: number;
  low_stock_threshold: number;
  low_stock_notified: boolean;
}
  

  router.post('/check-stock', async (req: Request, res: Response) => {
    try {
      await checkLowStockAndNotify();
      res.json({ success: true, message: 'Stock check completed' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to check stock' });
    }
  });


  router.post('/reset-notification/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    
    try {
      await pool.query(
        'UPDATE drinks_inventory SET low_stock_notified = false WHERE id = $1',
        [id]
      );
      res.json({ success: true, message: 'Notification flag reset' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to reset flag' });
    }
  });

 
  router.get('/low-stock', async (req: Request, res: Response) => {
    try {
      const result = await pool.query<InventoryItem>(`
        SELECT * FROM drinks_inventory 
        WHERE low_stock_threshold IS NOT NULL
      `);

      const lowStockItems = result.rows.filter(item => {
        const totalStock = calculateTotalStock(item);
        return totalStock < item.low_stock_threshold;
      });

      res.json({ success: true, items: lowStockItems });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch low stock items' });
    }
  });

  export default router;
