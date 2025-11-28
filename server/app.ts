// CommonJS wrapper to avoid ES module conflict with ts-node-dev
const loader = async () => {
  try {
    // Backend routes
    const { registerRoutes } = await import('./routes.ts');

    // Vite development server
    const { setupVite } = await import('./index-dev.ts');

    // Core dependencies
    const express = (await import('express')).default;
    const cors = (await import('cors')).default;
    const dotenv = await import('dotenv');

    // Services
    const { storage } = await import('./storage.ts');
    const { memoryStore } = await import('./services/memory.ts');
    const { generateEmbedding, chunkText } = await import('./services/embeddings.ts');
    const { crawlWebsite } = await import('./services/crawler.ts');
    const { parseFile } = await import('./services/fileParser.ts');
    const {
      chatRateLimiter,
      trainingRateLimiter,
      memoryRateLimiter
    } = await import('./middleware/rateLimit.ts');
    const { askGemini } = await import('./services/gemini.js'); // JS file

    dotenv.config();

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

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

loader();
