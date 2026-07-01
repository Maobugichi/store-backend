import { Router } from "express";
import {
  getProfitByProduct,
  getTodayProfit,
  getProfitByWeek,
  getDamagesByWeek,
  getProfitSummary,
  getMergedWeekly,
} from "../services/profit.service.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/today", requireAuth, async (_, res) => {
  res.json(await getTodayProfit());
});

router.get("/products", requireAuth, async (_, res) => {
  res.json(await getProfitByProduct());
});

router.get("/weekly", requireAuth, async (req, res) => {
  const { startDate, endDate } = req.query;

  if (typeof startDate !== "string" || typeof endDate !== "string") {
    return res.status(400).json({ error: "startDate and endDate are required" });
  }

  res.json(await getProfitByWeek(startDate, endDate));
});

router.get("/damages-weekly", requireAuth, async (req, res) => {
  const { startDate, endDate } = req.query;

  if (typeof startDate !== "string" || typeof endDate !== "string") {
    return res.status(400).json({ error: "startDate and endDate are required" });
  }

  res.json(await getDamagesByWeek(startDate, endDate));
});

router.get("/summary", requireAuth, async (req, res) => {
  const { startDate, endDate } = req.query;

  if (typeof startDate !== "string" || typeof endDate !== "string") {
    return res.status(400).json({ error: "startDate and endDate are required" });
  }

  res.json(await getProfitSummary(startDate, endDate));
});


router.get("/merged-weekly", requireAuth, async (req, res) => {
  const { startDate, endDate } = req.query;

  if (typeof startDate !== "string" || typeof endDate !== "string") {
    return res.status(400).json({ error: "startDate and endDate are required" });
  }

  res.json(await getMergedWeekly(startDate, endDate));
});

export default router;