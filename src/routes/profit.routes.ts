import { Router } from "express";
import { getProfitByProduct, getTodayProfit } from "../services/profit.service.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router()

router.get("/today", requireAuth, async (_, res) => {
  res.json(await getTodayProfit());
});

router.get("/products", requireAuth , async (_, res) => {
  res.json(await getProfitByProduct());
});

export default router;