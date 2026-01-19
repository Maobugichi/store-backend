import { Router } from "express";
import {
  getInventoryOverview,
} from "../services/inventory.service.js";
import { getProfitByProduct , getTodayProfit } from "../services/profit.service.js";
import { restockItem } from "../services/restock.service.js";

const router = Router();

router.get("/", async (_, res) => {
  res.json(await getInventoryOverview());
});

router.get("/profit/today", async (_, res) => {
  res.json(await getTodayProfit());
});

router.get("/profit/products", async (_, res) => {
  res.json(await getProfitByProduct());
});

router.post("/restock", async (req, res) => {
  try {
    const result = await restockItem(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
