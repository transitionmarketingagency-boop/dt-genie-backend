import { gemmaClient } from "../services/gemmaClient.js";

(async () => {
  console.log("Testing simple prompt...");
  const res = await gemmaClient("Say hello in one sentence.");
  console.log("Response:", res);
})();
