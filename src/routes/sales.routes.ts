import { Router } from "express";
import { processSale } from "../services/sales.service.js";
import type { SaleInput } from "../types/sale.js";

const router = Router();


router.post("/", async (req, res) => {
  try {
    const input: SaleInput = req.body;

   
    if (
      !input.inventoryId ||
      !input.saleType ||
      !input.quantity ||
      input.quantity <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale input",
      });
    }

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
