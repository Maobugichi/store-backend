import pool from "../config/db.js";
import type { SaleInput } from "../types/sale.js";
import { resolvePricing } from "../utils/pricing.js";


export const processSale = async  (input:SaleInput) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const inventoryRes = await client.query(
            `SELECT * FROM drinks_inventory WHERE id = $1 FOR UPDATE`,
            [input.inventoryId]
        );

        if (inventoryRes.rowCount === 0) {
            throw new Error("Item not found");
        }

        const item = inventoryRes.rows[0];

        let sellingPrice:number;
        let purchasePrice:number;
        let stockField: string;

        if (input.saleType === "pack") {
            if (item.packs_in_stock < input.quantity) {
                throw new Error("Not enough packs in stock");
            }

            if (!item.selling_price_pack || !item.purchase_price_pack) {
                throw new Error("Pack pricing not configured");
            }

            sellingPrice = item.selling_price_pack;
            purchasePrice = item.purchase_price_pack;
            stockField = "packs_in_stock";
    
        } else {
            if (item.pieces_in_stock < input.quantity) {
                throw new Error("Not enough pieces in stock");
            }

            const pricing = resolvePricing({
                packSize: item.pack_size,
                sellingPricePack: item.selling_price_pack,
                sellingPricePiece: item.selling_price_piece,
                purchasePricePack: item.purchase_price_pack,
                purchasePricePiece: item.purchase_price_piece,
            });
            sellingPrice = pricing.sellingPricePiece;
            purchasePrice = pricing.purchasePricePiece;
            stockField = "pieces_in_stock";   
        }

        const profit = (sellingPrice - purchasePrice) * input.quantity;

       await client.query(
            `INSERT INTO daily_sales 
            (inventory_id, sale_type, quantity, selling_price, purchase_price, profit, sale_date)
            VALUES ($1, $2, $3, $4, $5, $6,NOW())
            `,
            [
                input.inventoryId,
                input.saleType,
                input.quantity,
                sellingPrice,
                purchasePrice,
                profit,
            ]
        );

        await client.query(
            `UPDATE drinks_inventory
            SET ${stockField} = ${stockField} - $1
            WHERE id = $2
            `,
            [input.quantity, input.inventoryId]
        );

        await client.query("COMMIT");

        return{
            success:true,
            profit,
            message:"Sale processed sucessfully"
        }
    } catch(err) {
        await client.query("ROLLBACK");
        throw err
    } finally {
        client.release();
    }
}



/*
  A couple days ago, I shared the inventory system I built for my mum.

 One comment sparked a lot of questions… so here’s a quick demo showing how it actually works.

For my big business owners still counting stock manually, this is your sign.

 Let me build you a tool that saves time, protects your money, and doesn’t drain your budget.

Track your stock in real time, get email alerts when items run low, restock from your phone anywhere, anytime, and see your daily profits update live.

 Less stress. More control. Smarter business. Thanks so much Taiwo Akinsanya for that question
*/