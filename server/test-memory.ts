import { generateHybridResponse } from "./services/hybridClient";

async function test() {
  const sessionId = "session-test";
  const userId = "user-test";

  console.log("➡️ Sending first prompt...");
  let resp = await generateHybridResponse(
    userId,
    "Hello, tell me about your services."
  );
  console.log("Response:", resp);

  console.log("➡️ Sending second prompt...");
  resp = await generateHybridResponse(
    userId,
    "Create a 6-month growth marketing plan."
  );
  console.log("Response:", resp);
}

test();
