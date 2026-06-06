import cron from 'node-cron';
import dotenv from 'dotenv';
import { Resend } from 'resend';
import pool from '../config/db.js';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

interface InventoryItem {
  id: number;
  name: string;
  pack_size: number;
  packs_in_stock: number;
  pieces_in_stock: number;
  low_stock_threshold: number;
  low_stock_notified: boolean;
}

export function calculateTotalStock(item: InventoryItem): number {
  return item.packs_in_stock + (item.pieces_in_stock / item.pack_size);
}

export async function checkLowStockAndNotify() {
  const client = await pool.connect();

  try {
    console.log('Checking for low stock items...');

    const result = await client.query<InventoryItem>(`
      SELECT *
      FROM drinks_inventory
      WHERE low_stock_notified = false
      AND low_stock_threshold IS NOT NULL
    `);

    const lowStockItems: InventoryItem[] = [];

    for (const item of result.rows) {
      const totalStock = calculateTotalStock(item);

      if (totalStock < item.low_stock_threshold) {
        lowStockItems.push(item);
      }
    }

    if (lowStockItems.length > 0) {
      await sendLowStockEmail(lowStockItems);

      const ids = lowStockItems.map(item => item.id);

      await client.query(
        `
        UPDATE drinks_inventory
        SET low_stock_notified = true
        WHERE id = ANY($1)
        `,
        [ids]
      );

      console.log(
        `Sent low stock notifications for ${lowStockItems.length} item(s)`
      );
    } else {
      console.log('No low stock items found');
    }
  } catch (error) {
    console.error('Error checking low stock:', error);
  } finally {
    client.release();
  }
}

async function sendLowStockEmail(items: InventoryItem[]) {
  const itemsHtml = items
    .map(item => {
      const totalStock = calculateTotalStock(item);

      return `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">
            ${item.name}
          </td>

          <td style="padding:8px;border:1px solid #ddd;">
            ${totalStock.toFixed(2)} packs
          </td>

          <td style="padding:8px;border:1px solid #ddd;">
            ${item.low_stock_threshold} packs
          </td>

          <td style="padding:8px;border:1px solid #ddd;">
            ${item.packs_in_stock} packs +
            ${item.pieces_in_stock} pieces
          </td>
        </tr>
      `;
    })
    .join('');

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Blessings Store <onboarding@resend.dev>',
      to: [process.env.NOTIFICATION_EMAIL!],
      subject: `⚠️ Low Stock Alert - ${items.length} Item(s) Need Restocking`,
      html: `
        <div
          style="
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
          "
        >
          <h2 style="color:#d9534f;">
            Low Stock Alert
          </h2>

          <p>
            The following inventory items are below their
            configured stock threshold:
          </p>

          <table
            style="
              width:100%;
              border-collapse:collapse;
              margin:20px 0;
            "
          >
            <thead>
              <tr style="background-color:#f8f9fa;">
                <th style="padding:12px;border:1px solid #ddd;text-align:left;">
                  Item Name
                </th>

                <th style="padding:12px;border:1px solid #ddd;text-align:left;">
                  Current Stock
                </th>

                <th style="padding:12px;border:1px solid #ddd;text-align:left;">
                  Threshold
                </th>

                <th style="padding:12px;border:1px solid #ddd;text-align:left;">
                  Details
                </th>
              </tr>
            </thead>

            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <p
            style="
              color:#666;
              font-size:14px;
            "
          >
            This is an automated notification from your inventory system.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      throw error;
    }

    console.log('Low stock email sent successfully');
    console.log('Resend response:', data);
  } catch (error) {
    console.error('Failed to send low stock email:', error);
    throw error;
  }
}

cron.schedule('0 9 * * *', () => {
  console.log('Running scheduled stock check...');
  checkLowStockAndNotify();
});

if (!process.env.RESEND_API_KEY) {
  console.warn(
    'WARNING: RESEND_API_KEY is not configured. Emails will fail.'
  );
} else {
  console.log('Resend email service initialized');
}