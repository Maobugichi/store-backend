import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  getInventoryOverview,
  createInventoryItem,
} from '../services/inventory.service.js';
import z from 'zod';

const router = Router();



const createItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  pack_size: z.number().int().positive(),
  packs_in_stock: z.number().int().min(0),
  pieces_in_stock: z.number().int().min(0),
  purchase_price_pack: z.number().positive().nullable().optional(),
  purchase_price_piece: z.number().positive().nullable().optional(),
  selling_price_pack: z.number().positive().nullable().optional(),
  selling_price_piece: z.number().positive().nullable().optional(),
  low_stock_threshold: z.number().positive().nullable().optional(),
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const items = await getInventoryOverview();
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const validated = createItemSchema.parse(req.body);

    if (!validated) {
      res.status(400).json({})
    }

    const item = await createInventoryItem(validated);
    res.status(201).json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) {
     res.status(400).json({ error: error.issues[0]?.message ?? 'Validation failed' });
      return;
    }
    res.status(500).json({ error: 'Failed to create inventory item' });
  }
});

export default router;