import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import salesRoute from "../src/routes/sales.routes.js"
import inventoryRoutes from "../src/routes/inventory.js"
import notifRoutes from "../src/routes/notification.routes.js"
import { startAutoReplenishWorker, stopAutoReplenishWorker } from "./workers/autoReplenishWorker.js"

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

app.use("/api/sales", salesRoute);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/", notifRoutes);


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