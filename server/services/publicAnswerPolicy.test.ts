import test from "node:test";
import assert from "node:assert/strict";
import { getApprovedPublicAnswer } from "./publicAnswerPolicy.js";
import { detectBusinessProfile } from "./strategicBrain.js";
import { cleanPrompt } from "./openRouterClient.js";

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

test("budget constraints and channel-selection questions reach context-aware response generation", () => {
  const cases = [
    "We own a plumbing and home cleaning company. We serve residential customers in our local area. We want more qualified enquiries but have a limited marketing budget. What should we focus on first?",
    "Which acquisition channel should we test first for these two services, and why? Give us a practical first test.",
    "Which channel should a dental clinic test first with a small budget?",
    "We have a limited advertising budget. Should we focus on referrals or paid search?",
  ];

  for (const message of cases) {
    assert.equal(
      getApprovedPublicAnswer(message),
      "",
      `Expected context-aware model handling for: ${message}`,
    );
  }
});

test("explicit requests to increase existing marketing spend retain deterministic guidance", () => {
  assert.match(
    getApprovedPublicAnswer("Should we increase our marketing budget?"),
    /Before increasing spend/i,
  );
});

test("specific existing ad-campaign troubleshooting retains deterministic guidance", () => {
  assert.match(
    getApprovedPublicAnswer("Our Google Ads are not converting. How do we fix them?"),
    /First verify tracking/i,
  );
  assert.equal(
    getApprovedPublicAnswer("Which advertising channel should we test first?"),
    "",
  );
});


test("business profile detection preserves multiple named services separately", () => {
  const profile = detectBusinessProfile(
    "We own a plumbing and home cleaning company. We serve residential customers in our local area.",
  );
  assert.ok(profile);
  assert.equal(profile.industry, "home_services");
  assert.deepEqual(profile.servicesDiscussed, ["plumbing", "home cleaning"]);
});

test("business profile detection recognizes stated business types and services", () => {
  const travel = detectBusinessProfile(
    "I am a travel agent in Dubai selling premium private tours.",
  );
  assert.equal(travel?.industry, "premium_travel_experiences");
  assert.deepEqual(travel?.servicesDiscussed, ["private tours"]);

  const ecommerce = detectBusinessProfile(
    "I run an ecommerce brand selling premium skincare.",
  );
  assert.equal(ecommerce?.industry, "ecommerce");
  assert.deepEqual(ecommerce?.servicesDiscussed, ["skincare"]);
});


test("first-person role statements identify an actual business without accepting research statements", () => {
  const travel = detectBusinessProfile("I am a travel agent selling private tours.");
  assert.equal(travel?.industry, "premium_travel_experiences");
  assert.equal(
    detectBusinessProfile("I am researching travel agencies and private tours."),
    null,
  );
  assert.equal(
    detectBusinessProfile("We are researching real estate developers."),
    null,
  );
});

test("hypothetical industry mentions do not overwrite a user's business profile", () => {
  assert.equal(
    detectBusinessProfile("I am researching plumbing and home cleaning businesses."),
    null,
  );
});


test("long model prompts preserve the latest question and final response rules", () => {
  const prompt = [
    "SYSTEM OPENING INSTRUCTIONS",
    "x".repeat(14000),
    "LATEST USER QUESTION: calculate the service booking rates",
    "FINAL RESPONSE RULES: answer the latest question directly",
  ].join("\\n");

  const cleaned = cleanPrompt(prompt);

  assert.ok(cleaned.length <= 12000);
  assert.ok(cleaned.startsWith("SYSTEM OPENING INSTRUCTIONS"));
  assert.ok(cleaned.includes("LATEST USER QUESTION: calculate the service booking rates"));
  assert.ok(cleaned.endsWith("FINAL RESPONSE RULES: answer the latest question directly"));
  assert.ok(cleaned.includes("Middle conversation context omitted"));
});
