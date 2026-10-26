/**
 * Conservative structural checks for generated responses.
 * These checks catch common unfinished endings, not every semantic defect.
 */

export interface ResponseValidation {
  valid: boolean;
  reason?: string;
}

const SHORT_COMPLETE_ANSWERS = new Set([
  "yes.",
  "yes!",
  "no.",
  "no!",
  "absolutely.",
  "absolutely!",
  "certainly.",
  "certainly!",
  "of course.",
  "of course!",
  "you're welcome.",
  "you're welcome!",
]);

/**
 * Recognize explicitly permitted short answers.
 * This does not establish semantic correctness for longer responses.
 */
export function isShortCompleteAnswer(input: unknown): boolean {
  return (
    typeof input === "string" &&
    SHORT_COMPLETE_ANSWERS.has(input.trim().toLowerCase())
  );
}

const DANGLING_ENDINGS: RegExp[] = [
  /\b(?:such as|including|for example|like|e\.g\.)[.!?]*$/i,
  /\b(?:first|second|third|finally)\s*,?\s*$/i,
  /\b(?:a|an|the|and|or|but|to|for|with|of|in|on|at|by|from|because|which|that|if|when|while)[.!?]*$/i,
  /\b(?:develop|create|build|implement|provide|deliver|optimize)\s+(?:a|an|the)?\s*(?:robust|comprehensive|effective|strategic)?[.!?]*$/i,
  /\b(?:centers on|focuses on|consists of|includes|such as)\s*(?:three key areas)?[.!?]*$/i,
  /[:\-]\s*$/,
];

export function validateResponse(input: unknown): ResponseValidation {
  if (typeof input !== "string") {
    return { valid: false, reason: "not_a_string" };
  }

  const text = input.trim();

  if (!text) {
    return { valid: false, reason: "empty_response" };
  }

  if (/\b(?:undefined|null|traceback|error occurred)\b/i.test(text)) {
    return { valid: false, reason: "error_artifact" };
  }

  // Permit explicitly supported short answers without accepting fragments.
  if (isShortCompleteAnswer(text)) {
    return { valid: true };
  }

  if (text.length < 12) {
    return { valid: false, reason: "too_short" };
  }

  if (DANGLING_ENDINGS.some((pattern) => pattern.test(text))) {
    return { valid: false, reason: "unfinished_ending" };
  }

  if (!/[.!?]["')\]]*$/.test(text)) {
    return { valid: false, reason: "missing_terminal_punctuation" };
  }

  return { valid: true };
}
