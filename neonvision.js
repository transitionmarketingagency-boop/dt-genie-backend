import fs from "fs";
import readline from "readline";
import { pipeline } from "@xenova/transformers";
import { retrieveRelevantChunks } from "./query-embeddings.js";

const EMBEDDINGS_FILE = "embeddings.json";

async function main() {
  console.log("🌐 Loading embeddings...");
  if (!fs.existsSync(EMBEDDINGS_FILE)) {
    console.error("❌ embeddings.json not found! Run generate-embeddings.js first.");
    process.exit(1);
  }

  // Load embeddings
  const embeddings = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE));

  // Load the model for embedding user queries
  console.log("🌐 Loading question embedding model...");
  const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

  // Setup readline for interactive chat
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "You: "
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const question = line.trim();
    if (!question) {
      rl.prompt();
      return;
    }

    // Embed the user question
    const questionEmbedding = await embedder(question, { pooling: "mean" });
    const vector = questionEmbedding.data[0];

    // Retrieve relevant chunks
    const relevantChunks = retrieveRelevantChunks(vector, 3);

    // Build context for answer
    const contextText = relevantChunks.map(c => `From ${c.url}: ${c.content}`).join("\n\n");

    // Simple answer (you can improve by integrating a local LLM later)
    const answer = `
NeonVision Bot: Here's information I found relevant to your question:

${contextText}
`;

    console.log(answer);
    rl.prompt();
  });
}

main();
