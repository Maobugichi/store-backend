import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;


const pool = new Pool({
    connectionString: process.env.CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
});


pool.on('connect', (client) => {
     client.query("SET TIME ZONE 'Africa/Lagos'");
});


pool.on('error', (err) => {
    console.error('Database connection error:', err);
});

export default pool;