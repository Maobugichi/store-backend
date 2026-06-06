
import pool from '../config/db';
import crypto from 'crypto';

const code = crypto.randomBytes(16).toString('hex');
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 7);

await pool.query(
  `INSERT INTO admin_invite_codes (code, expires_at) VALUES ($1, $2)`,
  [code, expiresAt]
);

console.log('First invite code:', code);
await pool.end();