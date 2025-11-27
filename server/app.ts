const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const start = async () => {
  const { registerRoutes } = await import('./routes.ts');
  const { setupVite } = await import('./index-dev.ts');

  const app = express();
  
  app.use(cors());
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  const PORT = parseInt(process.env.PORT || "5000", 10);
  
  const httpServer = await registerRoutes(app);
  await setupVite(app, httpServer);

  httpServer.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
};

start().catch(err => {
  console.error("Server startup failed:", err);
  process.exit(1);
});
