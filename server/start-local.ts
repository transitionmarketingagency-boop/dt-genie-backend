// server/start-local.ts
import runApp from "./app.js";
import { setupApp } from "./app.js";

const PORT = 10000;

(async () => {
  const server = await runApp(setupApp);
  server.listen(PORT, () => {
    console.log(`🚀 Server running locally at http://localhost:${PORT}`);
  });
})();
