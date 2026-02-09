import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import salesRoute from "./routes/sales.routes.js"
import inventoryRoutes from "./routes/inventory.js"
import notifRoutes from "./routes/notification.routes.js"
import profitRoutes from "./routes/profit.routes.js"
import restockRoute from "./routes/restock.routes.js"
import authRoute from './routes/auth.routes.js'
import { startAutoReplenishWorker, stopAutoReplenishWorker } from "./workers/autoReplenishWorker.js"
import { requireAuth } from "./middleware/auth.middleware.js"
import helmet from "helmet"
import logger from "./services/logger.service.js"

dotenv.config();

const requiredEnvVars = ['PORT', 'DATABASE_URL', 'JWT_SECRET'];
const missing = requiredEnvVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();

const port = process.env.PORT;


app.use(
  helmet({
    contentSecurityPolicy: false,
  })
)


app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
    ? ["https://blessings-store-psi.vercel.app"]
    : ["http://localhost:5173", "https://blessings-store-psi.vercel.app"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 86400
}));



app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});


app.use('/api/profit', profitRoutes);
app.use('/api',restockRoute)
app.use("/api/", notifRoutes);

app.use('/api/' , authRoute);
app.use("/api/sales", requireAuth, salesRoute);
app.use("/api/inventory", requireAuth, inventoryRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});


app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

let workerInterval: NodeJS.Timeout;


const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  logger.info(`🚀 Server running on port ${port}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info('⚙️  Auto-replenish worker started')
  workerInterval = startAutoReplenishWorker(5);
});


const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully...`);
  
  if (workerInterval) {
    stopAutoReplenishWorker(workerInterval);
    logger.info('Auto-replenish worker stopped');
  }
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));


process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});