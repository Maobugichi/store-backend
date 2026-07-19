import { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.middleware.js";

export const requireRole = (...allowed: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.role || !allowed.includes(req.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
};