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

dotenv.config()

const app = express();

const port = process.env.PORT;
const origins = ["http://localhost:5173", "https://blessings-store-psi.vercel.app"];

app.use(cors({
    origin: origins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));

app.use(express.json());

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
  workerInterval = startAutoReplenishWorker(5);
});


process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  if (workerInterval) {
    stopAutoReplenishWorker(workerInterval);
  }
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});


process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  
  if (workerInterval) {
    stopAutoReplenishWorker(workerInterval);
  }
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});