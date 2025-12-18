// server/test-env.ts
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, "../.env") });

console.log("✅ ENV CHECK");
console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "LOADED" : "MISSING");
console.log("GEMINI_MODEL:", process.env.GEMINI_MODEL);
