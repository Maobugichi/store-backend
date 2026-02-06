import pool from "../config/db.js";

export async function getTodayProfit() {
  const { rows } = await pool.query(`
    SELECT COALESCE(SUM(profit), 0) AS total_profit
    FROM daily_sales
    WHERE sale_date::date = CURRENT_DATE
  `);

  return rows[0];
}


export async function getProfitByProduct() {
  const { rows } = await pool.query(`
    SELECT
      d.name,
      s.sale_date,
      SUM(s.profit) AS total_profit,
      SUM(s.quantity) AS total_units_sold
    FROM daily_sales s
    JOIN drinks_inventory d ON d.id = s.inventory_id
    GROUP BY d.name, s.sale_date
    ORDER BY s.sale_date DESC, total_profit DESC
  `);

  return rows;
}
