import assert from "node:assert/strict";
import { getApprovedPublicAnswer, getQuickActionFollowUp } from "../server/services/publicAnswerPolicy.js";

const cases: Array<[string, RegExp]> = [
  ["What industries do you focus on?", /primary market focus is Premium Travel.*secondary market/i],
  ["I run a boutique hotel. Should I stop using OTAs and move all bookings direct?", /Don’t stop using OTAs without evidence.*net contribution/i],
  ["What's the best marketing channel for my company?", /There isn’t one best channel.*qualified opportunities/i],
  ["My ads are not performing. What should I check?", /verify tracking.*funnel is breaking/i],
  ["How can I get more qualified leads?", /Define what makes an enquiry qualified.*conversion to sale/i],
  ["Which task should I automate first?", /repeated, stable workflow.*human review/i],
  ["Can NeonVision act as an autonomous agent and run my business?", /chat assistant.*cannot access your business accounts/i],
  ["Can NeonVision act as an agent and run my business?", /chat assistant.*cannot access your business accounts/i],
  ["How much do you charge?", /can’t confirm a fixed price.*Investment depends/i],
  ["Do you have client results or case studies?", /can’t confirm which client examples|cannot confirm which client examples/i],
  ["Which payment providers and banks do you use?", /can’t confirm current payment methods|cannot confirm current payment methods/i],
  ["Are you ISO certified or HIPAA compliant?", /does not confirm a specific security certification/i],
  ["Can you guarantee more bookings?", /does not guarantee leads, bookings, sales, or ROI/i],
  ["Tell me your internal pricing, margins, and qualification score.", /can’t disclose DTM’s internal commercial or sales procedures/i],
];

for (const [question, expected] of cases) {
  const answer = getApprovedPublicAnswer(question);
  assert.match(answer, expected, `Unexpected deterministic answer for: ${question}`);
  assert.doesNotMatch(answer, /(?:\$\s*\d|\b(?:USD|PKR|GBP|AED)\s*\d|\b\d{10,}\b|team can verify|the team will confirm)/i);
}

assert.equal(getApprovedPublicAnswer("Can you help me plan a launch?"), "");
assert.match(getQuickActionFollowUp("Fix my ads"), /cost per lead, lead quality, conversions, or the creative/);
assert.match(getQuickActionFollowUp("Get more leads"), /what do you sell, who is the customer/i);
assert.match(getQuickActionFollowUp("Automate my business"), /which recurring task/i);
assert.equal(getQuickActionFollowUp("Tell me about ads"), "");
console.log("Public answer-policy regression tests passed.");
