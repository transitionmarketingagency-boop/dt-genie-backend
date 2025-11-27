// CommonJS wrapper to avoid ES module conflict with ts-node-dev
const loader = async () => {
  try {
    const { registerRoutes } = await import('./routes.ts');
    const { setupVite } = await import('./index-dev.ts');
    const express = (await import('express')).default;
    const cors = (await import('cors')).default;
    const dotenv = await import('dotenv');

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
