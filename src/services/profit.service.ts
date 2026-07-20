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
  // FIX (round 2): `s.sale_date::date` had two problems:
  //  1. It returns a DATE type, which pg parses as midnight UTC — once
  //     displayed in Africa/Lagos on the frontend, every row showed
  //     "1:00 AM" regardless of the actual sale time (a day aggregate
  //     showing a specific time never made sense anyway — see ProfitTable fix).
  //  2. `::date` resolves the calendar day using Postgres's session
  //     timezone, not explicitly Africa/Lagos — inconsistent with the
  //     rest of this feature, and could misfile a late-evening Lagos
  //     sale under the wrong day if the session tz isn't Lagos.
  // Returning a plain "YYYY-MM-DD" text string, explicitly computed in
  // Africa/Lagos, avoids both.
  const { rows } = await pool.query(`
    SELECT
      d.name,
      to_char(s.sale_date AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD') AS sale_date,
      SUM(s.profit) AS total_profit,
      SUM(s.quantity) AS total_units_sold
    FROM daily_sales s
    JOIN drinks_inventory d ON d.id = s.inventory_id
    GROUP BY d.name, to_char(s.sale_date AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD')
    ORDER BY to_char(s.sale_date AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD') DESC, total_profit DESC
  `);

  return rows;
}

export async function getProfitByWeek(startDate: string, endDate: string) {
  const { rows } = await pool.query(
    `
    SELECT
      date_trunc('week', s.sale_date)::date AS week_start,
      (date_trunc('week', s.sale_date) + interval '6 days')::date AS week_end,
      d.name,
      SUM(s.profit) AS total_profit,
      SUM(s.quantity) AS total_units_sold
    FROM daily_sales s
    JOIN drinks_inventory d ON d.id = s.inventory_id
    WHERE s.sale_date::date BETWEEN $1 AND $2
    GROUP BY week_start, week_end, d.name
    ORDER BY week_start DESC, total_profit DESC
    `,
    [startDate, endDate]
  );

  return rows;
}

export async function getDamagesByWeek(startDate: string, endDate: string) {
  const { rows } = await pool.query(
    `
    SELECT
      date_trunc('week', dm.damage_date)::date AS week_start,
      (date_trunc('week', dm.damage_date) + interval '6 days')::date AS week_end,
      d.name,
      SUM(dm.loss_value) AS total_loss,
      SUM(dm.quantity) AS total_units_damaged
    FROM drinks_damages dm
    JOIN drinks_inventory d ON d.id = dm.inventory_id
    WHERE dm.damage_date::date BETWEEN $1 AND $2
    GROUP BY week_start, week_end, d.name
    ORDER BY week_start DESC, total_loss DESC
    `,
    [startDate, endDate]
  );

  return rows;
}

export async function getProfitSummary(startDate: string, endDate: string) {
  const { rows } = await pool.query(
    `
    SELECT
      COALESCE(sales.total_profit, 0) AS total_sales_profit,
      COALESCE(damages.total_loss, 0) AS total_damage_loss,
      COALESCE(sales.total_profit, 0) - COALESCE(damages.total_loss, 0) AS net_profit
    FROM
      (SELECT SUM(profit) AS total_profit
       FROM daily_sales
       WHERE sale_date::date BETWEEN $1 AND $2) sales,
      (SELECT SUM(loss_value) AS total_loss
       FROM drinks_damages
       WHERE damage_date::date BETWEEN $1 AND $2) damages
    `,
    [startDate, endDate]
  );

  return rows[0];
}

export async function getMergedWeekly(startDate: string, endDate: string) {
  const { rows } = await pool.query(
    `
    WITH sales AS (
      SELECT
        date_trunc('week', s.sale_date)::date AS week_start,
        (date_trunc('week', s.sale_date) + interval '6 days')::date AS week_end,
        d.name,
        SUM(s.profit) AS total_profit,
        SUM(s.quantity) AS total_units_sold
      FROM daily_sales s
      JOIN drinks_inventory d ON d.id = s.inventory_id
      WHERE s.sale_date::date BETWEEN $1 AND $2
      GROUP BY week_start, week_end, d.name
    ),
    damages AS (
      SELECT
        date_trunc('week', dm.damage_date)::date AS week_start,
        (date_trunc('week', dm.damage_date) + interval '6 days')::date AS week_end,
        d.name,
        SUM(dm.loss_value) AS total_loss,
        SUM(dm.quantity) AS total_units_damaged
      FROM drinks_damages dm
      JOIN drinks_inventory d ON d.id = dm.inventory_id
      WHERE dm.damage_date::date BETWEEN $1 AND $2
      GROUP BY week_start, week_end, d.name
    )
    SELECT
      COALESCE(sales.week_start, damages.week_start) AS week_start,
      COALESCE(sales.week_end, damages.week_end) AS week_end,
      COALESCE(sales.name, damages.name) AS name,
      COALESCE(sales.total_profit, 0) AS total_profit,
      COALESCE(sales.total_units_sold, 0) AS total_units_sold,
      COALESCE(damages.total_loss, 0) AS total_loss,
      COALESCE(damages.total_units_damaged, 0) AS total_units_damaged,
      COALESCE(sales.total_profit, 0) - COALESCE(damages.total_loss, 0) AS net_profit
    FROM sales
    FULL OUTER JOIN damages
      ON sales.week_start = damages.week_start AND sales.name = damages.name
    ORDER BY week_start DESC, net_profit DESC
    `,
    [startDate, endDate]
  );

  return rows;
}