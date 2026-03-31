// server/utils/formatResponse.ts
import { CALENDLY_LINK } from "../config/constants.js";

type Section = {
  heading?: string;
  content: string | string[];
};

type FormatOptions = {
  includeCalendly?: boolean;
};

/* ===== CLEAN AND NORMALIZE TEXT ===== */
export function normalizeText(input: string): string {
  let text = input || "";

  // REMOVE MULTI-LINE CODE BLOCKS
  text = text.replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, ""));

  // REMOVE MARKDOWN HEADERS
  text = text.replace(/^#{1,6}\s*/gm, "");

  // REMOVE BOLD / ITALIC / INLINE CODE (SAFE ORDER)
  text = text
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold first
    .replace(/_{2,}(.*?)_{2,}/g, "$1") // underline / bold alt
    .replace(/\*(.*?)\*/g, "$1") // italic after bold handled
    .replace(/`([^`]*)`/g, "$1"); // inline code

  // REMOVE INTERNAL TOKENS (STRICT)
  text = text
    .replace(/^(assistant|system|user):\s*/gim, "")
    .replace(/<\|im_start\|>|<\|im_end\|>/g, "");

  // FIX WORD MERGING (camelCase spacing)
  text = text.replace(/([a-z]{3,})([A-Z])/g, "$1 $2");

  // REMOVE CONTROL CHARACTERS
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  // NORMALIZE WHITESPACE
  text = text
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  // FIX SENTENCE SPACING
  text = text.replace(/([.!?])([A-Za-z])/g, "$1 $2");

  // REMOVE TRAILING ARTIFACT SYMBOLS
  text = text.replace(/[~`^|<>]+$/g, "");

  // LENGTH SAFETY
  if (text.length > 2500) {
    text = text.slice(0, 2500);
  }

  return text;
}

/* ===== FORMAT RESPONSE FOR USER ===== */
export function formatResponse(
  _title: string | null,
  sections: Section[],
  options: FormatOptions = {}
) {
  let output = "";

  for (const section of sections) {
    if (!section.content) continue;

    // ADD SECTION HEADING
    if (section.heading) {
      output += `${section.heading}\n`;
    }

    // ADD SECTION CONTENT
    if (Array.isArray(section.content)) {
      for (const item of section.content) {
        if (item && item.trim()) {
          output += `- ${item.trim()}\n`;
        }
      }
    } else {
      output += `${section.content.trim()}\n`;
    }

    output += "\n"; // extra line between sections
  }

  // INCLUDE CALENDLY LINK IF REQUESTED
  if (options.includeCalendly) {
    output += `If you’d like, you can book a short strategy call here:\n${CALENDLY_LINK}\n`;
  }

  return output.trim();
}
