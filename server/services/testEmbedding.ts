import { getEmbedding } from "./embeddingClient.js";

(async () => {
  const vec = await getEmbedding("DT-Genie test embedding");
  console.log("Embedding length:", vec.length);
  console.log("First 5 values:", vec.slice(0, 5));
})();
