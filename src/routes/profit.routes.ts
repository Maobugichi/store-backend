import { Router } from "express";
import { getProfitByProduct, getTodayProfit } from "../services/profit.service";

const router = Router()

router.get("/today", async (_, res) => {
  res.json(await getTodayProfit());
});

router.get("/products", async (_, res) => {
  res.json(await getProfitByProduct());
});

export default router;