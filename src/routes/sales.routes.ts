import { Router } from "express";
import { processSale } from "../services/sales.service.js";
import type { SaleInput } from "../types/sale.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

const VALID_SALE_TYPES = ["pack", "piece", "half_pack"];

router.post("/", requireAuth, requireRole("admin", "seller"), async (req, res) => {
  try {
    const { inventoryId, saleType, quantity, saleDate, overrideTotalPrice } = req.body;

    const parsedInventoryId = Number(inventoryId);
    if (!inventoryId || !Number.isInteger(parsedInventoryId) || parsedInventoryId <= 0) {
      return res.status(400).json({
        success: false,
        message: "inventoryId must be a positive integer",
      });
    }

    // Previously: any value outside pack/piece/half_pack silently fell
    // through to the "piece" branch in the service. Reject it explicitly here.
    if (!VALID_SALE_TYPES.includes(saleType)) {
      return res.status(400).json({
        success: false,
        message: `saleType must be one of: ${VALID_SALE_TYPES.join(", ")}`,
      });
    }

    // Form input arrives as a string ("5"), not a number — coerce and
    // validate explicitly rather than relying on implicit JS coercion.
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "quantity must be a positive integer",
      });
    }

    let parsedOverrideTotal: number | undefined;
    if (overrideTotalPrice != null && overrideTotalPrice !== "") {
      parsedOverrideTotal = Number(overrideTotalPrice);
      if (!Number.isFinite(parsedOverrideTotal) || parsedOverrideTotal <= 0) {
        return res.status(400).json({
          success: false,
          message: "overrideTotalPrice must be a positive number",
        });
      }
    }

    // saleDate is expected as a plain "YYYY-MM-DD" string (e.g. from a
    // native date input, or built client-side from local Date getters).
    // Deeper format validation happens in the service, against the DB.
    // Built this way (rather than assigning `saleDate || undefined` etc.
    // directly) because SaleInput's optional fields are typed `number`,
    // not `number | undefined` — with exactOptionalPropertyTypes on,
    // TS distinguishes "key absent" from "key present with value undefined".
    // Spreading conditionally keeps the key fully absent when there's no value.
    const input: SaleInput = {
      inventoryId: parsedInventoryId,
      saleType,
      quantity: parsedQuantity,
      ...(saleDate ? { saleDate } : {}),
      ...(parsedOverrideTotal !== undefined ? { overrideTotalPrice: parsedOverrideTotal } : {}),
    };

    const result = await processSale(input);

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to process sale",
    });
  }
});

export default router;