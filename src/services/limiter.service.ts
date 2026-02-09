import rateLimit from "express-rate-limit"

export const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '5'),                 
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many attempts. Try again later.",
  },
})
