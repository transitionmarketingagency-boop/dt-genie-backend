import assert from "node:assert/strict";
import { isShortCompleteAnswer, validateResponse } from "../server/services/responseCompleteness.js";
import { isValidResponse } from "../server/services/openRouterClient.js";
import { cleanResponse } from "../server/utils/cleanResponse.js";

const shortAnswerCases = [
  "Absolutely!",
  "No.",
  "You're welcome!",
];

for (const text of shortAnswerCases) {
  assert.equal(
    isShortCompleteAnswer(text),
    true,
    `Expected supported short answer: ${text}`,
  );
  assert.equal(
    validateResponse(text).valid,
    true,
    `Expected valid short answer: ${text}`,
  );
  assert.equal(cleanResponse(text), text, `Expected short answer to survive response cleanup: ${text}`);
  assert.equal(isValidResponse(text), true, `Expected model validator to accept complete short answer: ${text}`);
}

for (const text of ["We can help your business with", "undefined", ""]) {
  assert.equal(
    isShortCompleteAnswer(text),
    false,
    `Expected unsupported short answer: ${JSON.stringify(text)}`,
  );
}

const incompleteCases = [
  "We deploy solutions in areas such as.",
  "First, we develop a robust.",
  "Our approach centers on three key areas:",
  "We can help your business with",
  "Our services include SEO, AI automation, and",
  "We provide digital marketing services, which.",
  "The main benefits are:",
  "Our strategy focuses on including.",
];

for (const text of incompleteCases) {
  assert.equal(
    validateResponse(text).valid,
    false,
    `Expected rejection: ${text}`,
  );
}

for (const text of ["We can help your business with", "The main benefits are:", "A clear and useful response without an ending"]) {
  assert.equal(isValidResponse(text), false, `Expected model validator to reject incomplete answer: ${text}`);
}

const completeCases = [
  "We help businesses improve visibility, qualified leads, and conversions.",
  "Start by reviewing your website's conversion path, then test one improvement.",
  "Yes, we can discuss whether our services fit your business.",
  "Absolutely!",
  "No.",
  "Please share your website URL.",
  "Our services include SEO, AI automation, and performance marketing.",
];

for (const text of completeCases) {
  assert.equal(
    validateResponse(text).valid,
    true,
    `Expected acceptance: ${text}`,
  );
}

const invalidInputs: unknown[] = [
  null,
  undefined,
  123,
  "",
  "undefined",
  "The request failed with an error occurred.",
];

for (const input of invalidInputs) {
  assert.equal(
    validateResponse(input).valid,
    false,
    `Expected rejection: ${String(input)}`,
  );
}

console.log("Response completeness regression tests passed.");
