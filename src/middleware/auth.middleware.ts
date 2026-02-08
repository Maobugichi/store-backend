import { Request , Response , NextFunction } from "express";
import { verifyToken } from "../services/auth.service";
import pool from "../config/db";

export interface AuthRequest extends Request {
    adminId?:number;
}

export const requireAuth = async (
    req:AuthRequest,
    res:Response,
    next:NextFunction
):Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided'});
        return;
    }

    const token = authHeader.substring(7);

    const decoded = verifyToken(token);

    if (!decoded) {
        res.status(401).json({ error:'Invalid or expired token'});
        return;
    }

    const result = await pool.query(`
        SELECT id FROM admins WHERE id = $1`,
        [decoded.adminId]
    );


    if (result.rows.length === 0) {
        res.status(401).json({ error:'Admin not found'});
        return;
    }

    req.adminId = decoded.adminId;
    next();
  } catch(error) {
    console.error('Auth middleware error', error);
    res.status(500).json({ error: 'Authentication failed' })
  }
}