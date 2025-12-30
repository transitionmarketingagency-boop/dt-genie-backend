import { generateWithOllama } from "./services/ollamaClient";

async function test() {
  const response = await generateWithOllama(
    "Say hello as DT-Genie in one sentence."
  );

  console.log("\nOLLAMA RESPONSE:\n");
  console.log(response);
}

test().catch(console.error);
