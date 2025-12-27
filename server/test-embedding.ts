import { embedText } from "./services/embeddingClient";

(async () => {
  const vec = await embedText("Tell me about your AI services");
  console.log("Vector length:", vec.length);
})();
