import { Router } from "express";
import {
  getInventoryOverview,
} from "../services/inventory.service.js";
import { requireAuth } from "../middleware/auth.middleware.js";


const router = Router();

router.get("/", requireAuth, async (_, res) => {
  res.json(await getInventoryOverview());
});



export default router;
