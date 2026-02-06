import { Router } from "express";
import { restockItem } from "../services/restock.service";

const router = Router();

router.post("/restock", async (req, res) => {
  try {
    const result = await restockItem(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;