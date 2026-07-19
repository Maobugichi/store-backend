import { Router } from "express";
import { restockItem } from "../services/restock.service.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

router.post("/restock", requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const result = await restockItem(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;