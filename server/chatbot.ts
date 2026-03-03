// server/chatbot.ts
import readline from "readline";
import { generateHybridResponse } from "./services/generateHybridResponse.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(" ~V DT-Genie is ready. Type your message below.\n");

// Simple intent detector (FAST, SAFE)
function isSimpleIntent(text: string) {
  const t = text.toLowerCase().trim();
  return (
    t === "hi" ||
    t === "hello" ||
    t === "hey" ||
    t === "are you there" ||
    t === "who are you" ||
    t.includes("services") ||
    t.includes("what do you do") ||
    t.includes("tell me about")
  );
}

async function ask() {
  rl.question("You: ", async (input) => {
    if (input.toLowerCase() === "exit") {
      console.log("\n ~K Goodbye!");
      rl.close();
      process.exit(0);
    }

    try {
      // ✅ Updated: pass single object to generateHybridResponse
      const response = await generateHybridResponse({
        message: input,
        sessionId: "default-session",
      });

      console.log("\n ~V AI Response:", response, "\n");
    } catch (err) {
      console.error("⚠️ Error:", err);
      console.log("Sorry — something went wrong.\n");
    }

    ask();
  });
}

ask();
