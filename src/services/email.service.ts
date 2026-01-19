import cron from 'node-cron';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import pool from '../config/db.js';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_APP_PASSWORD, 
  },
});



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
      SELECT * FROM drinks_inventory 
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
        `UPDATE drinks_inventory SET low_stock_notified = true WHERE id = ANY($1)`,
        [ids]
      );
      
      console.log(`Sent notifications for ${lowStockItems.length} items`);
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
  const itemsHtml = items.map(item => {
    const totalStock = calculateTotalStock(item);
    return `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${totalStock.toFixed(2)} packs</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${item.low_stock_threshold} packs</td>
        <td style="padding: 8px; border: 1px solid #ddd;">
          ${item.packs_in_stock} packs + ${item.pieces_in_stock} pieces
        </td>
      </tr>
    `;
  }).join('');

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.NOTIFICATION_EMAIL, 
    subject: `⚠️ Low Stock Alert - ${items.length} Items Need Restocking`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <h2 style="color: #d9534f;">Low Stock Alert</h2>
        <p>The following items in your inventory are running low and need to be restocked:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Item Name</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Current Stock</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Threshold</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Details</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <p style="color: #666; font-size: 14px;">
          This is an automated notification from your inventory management system.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Low stock email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}


cron.schedule('0 9 * * *', () => {
  console.log('Running scheduled stock check...');
  checkLowStockAndNotify();
});


transporter.verify((error, success) => {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});