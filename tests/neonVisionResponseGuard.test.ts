import assert from "node:assert/strict";
import { sanitizeFinalOutput } from "../server/services/generateHybridResponse.js";
import { isBookingIntent } from "../server/services/bookingIntentDetector.js";

const customerPerspective =
  "Digital Transition Marketing works with business owners. They can review their customer journey before choosing a channel that fits their goals.";

assert.equal(
  sanitizeFinalOutput(customerPerspective),
  customerPerspective,
  "Output cleanup must preserve the user's pronouns and point of view.",
);
assert.equal(isBookingIntent("Book a strategy call"), true);
assert.equal(isBookingIntent("How do I book more hotel rooms?"), false);

console.log("NeonVision response and booking intent regression tests passed.");
