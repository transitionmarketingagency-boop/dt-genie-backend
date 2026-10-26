import assert from "node:assert/strict";
import { normalizeResponseText } from "../server/services/responseText.js";

const cases: Array<[string, string]> = [
  ["  Hello   there.  ", "Hello there."],
  ["First sentence. . Second sentence.", "First sentence. Second sentence."],
  ["Our services include SEO, AI automation, and", "Our services include SEO, AI automation, and"],
  ["Absolutely!", "Absolutely!"],
  ["", ""],
];

for (const [input, expected] of cases) {
  assert.equal(
    normalizeResponseText(input),
    expected,
    `Unexpected normalization for: ${JSON.stringify(input)}`,
  );
}

console.log("Response text normalization tests passed.");
