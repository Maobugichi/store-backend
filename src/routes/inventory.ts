import { Router } from "express";
import {
  getInventoryOverview,
} from "../services/inventory.service.js";


const router = Router();

router.get("/", async (_, res) => {
  res.json(await getInventoryOverview());
});



export default router;
