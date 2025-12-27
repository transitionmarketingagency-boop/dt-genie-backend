import express from "express";
import cors from "cors";
import hybridRouter from "./server/services/hybridRouter.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api", hybridRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", message: "NeonVision server is running!" });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
