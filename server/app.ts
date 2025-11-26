import type { Express } from "express";
import { type Server } from "node:http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { registerRoutes } from "./routes";

dotenv.config();

export const app = express();

// Core middleware
app.use(cors());
app.set("trust proxy", 1);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

export default async function runApp(
  setupFn?: (app: Express, server: Server) => Promise<void>
): Promise<Server> {
  const PORT = parseInt(process.env.PORT || "5000", 10);
  
  // Register all API routes
  const httpServer = await registerRoutes(app);

  // Setup Vite if provided (development mode)
  if (setupFn) {
    await setupFn(app, httpServer);
  }

  return new Promise(resolve => {
    httpServer.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      resolve(httpServer);
    });
  });
}
