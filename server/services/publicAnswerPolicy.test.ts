import test from "node:test";
import assert from "node:assert/strict";
import { getApprovedPublicAnswer } from "./publicAnswerPolicy.js";

test("business-specific lead-generation questions reach context-aware response generation", () => {
  const cases = [
    "We own a plumbing and home cleaning company. How can we generate more qualified leads?",
    "I run a dental clinic in Dubai. How can we attract more high-value patients and qualified enquiries?",
    "I am a travel agent in Dubai selling premium private tours. How can I generate more qualified leads?",
    "I run an ecommerce brand selling premium skincare. How should we improve customer acquisition?",
  ];

  for (const message of cases) {
    assert.equal(
      getApprovedPublicAnswer(message),
      "",
      `Expected model handling for: ${message}`,
    );
  }
});

test("generic lead-generation questions are not intercepted by a context-blind canned answer", () => {
  assert.equal(getApprovedPublicAnswer("How can I generate more qualified leads?"), "");
  assert.equal(getApprovedPublicAnswer("What is the best way to improve lead quality?"), "");
});

test("high-risk public claims remain protected by deterministic approved answers", () => {
  assert.match(
    getApprovedPublicAnswer("Do you guarantee leads or ROI?"),
    /does not guarantee leads, bookings, sales, or ROI/i,
  );
});

test("pricing questions remain protected by deterministic approved answers", () => {
  assert.match(
    getApprovedPublicAnswer("What are your prices?"),
    /can’t confirm a fixed price/i,
  );
});
