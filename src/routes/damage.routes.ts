import { Router } from "express";
import { processDamage } from "../services/damage.service.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.js";
import type { DamageInput } from "../types/damage.js";

const router = Router();

const VALID_DAMAGE_TYPES = ["piece", "pack_open"];
const VALID_REASONS = ["leakage", "expired", "breakage", "theft", "other"];

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const input: DamageInput = req.body;

    if (
      !input.inventoryId ||
      !input.damageType ||
      !VALID_DAMAGE_TYPES.includes(input.damageType) ||
      !input.quantity ||
      input.quantity <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid damage input",
      });
    }

    if (input.reason && !VALID_REASONS.includes(input.reason)) {
      return res.status(400).json({
        success: false,
        message: "Invalid damage reason",
      });
    }

    const result = await processDamage(input);
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to record damage",
    });
  }
});

export default router;