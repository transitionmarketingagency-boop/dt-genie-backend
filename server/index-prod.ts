import express, { type Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createHttpServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const app: Express = express();
const server: Server = createHttpServer(app);

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- API Routes ----------
import routes from "./routes"; // make sure your routes.ts is backend-ready
app.use("/api", routes);

// ---------- Serve Frontend ----------
const clientBuildPath = path.join(__dirname, "../client"); // Adjust if your build folder is elsewhere
app.use(express.static(clientBuildPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

// ---------- Start Server ----------
server.listen(PORT, () => {
  console.log(`Production server running on port ${PORT}`);
});

export default app;
