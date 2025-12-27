// server/chatbot.ts
import readline from "readline";
import { generateHybridResponse } from "./services/hybridClient";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("🤖 DT-Genie is ready. Type your message below.\n");

function ask() {
  rl.question("You: ", async (input) => {
    if (input.toLowerCase() === "exit") {
      console.log("\n👋 Goodbye!");
      rl.close();
      process.exit(0);
    }

    const response = await generateHybridResponse(input);
    console.log("\n💬 AI Response:", response, "\n");

    ask(); // wait for next input
  });
}

ask();
