// server/services/testEmbedding.ts
import { getEmbedding } from "./embeddingClient.js";

(async () => {
  try {
    const vec = await getEmbedding("DT-Genie test embedding");
    if (!vec || vec.length === 0) {
      console.warn("⚠️ Received empty embedding vector.");
      return;
    }
    console.log("✅ Embedding length:", vec.length);
    console.log("✅ First 5 values:", vec.slice(0, 5));
  } catch (err) {
    console.error("❌ Embedding test failed:", err);
  }
})();
