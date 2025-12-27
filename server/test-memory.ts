import { generateHybridResponse } from "./services/hybridClient";

async function test() {
  const sessionId = "session-test";
  const userId = "user-test";

  console.log("➡️ Sending first prompt...");
  let resp = await generateHybridResponse(
    "Hello, tell me about your services.",
    [],
    sessionId,
    userId
  );
  console.log("Response:", resp);

  console.log("➡️ Sending complex prompt...");
  resp = await generateHybridResponse(
    "Create a 6-month growth marketing plan for a travel agency.",
    [],
    sessionId,
    userId
  );
  console.log("Response:", resp);

  console.log("✅ Check sessionMemory.json and userMemory.json for stored conversation");
}

test();
