import { CALENDLY_LINK } from "../config/constants.js";

type Section = {
  heading?: string;
  content: string | string[];
};

type FormatOptions = {
  includeCalendly?: boolean;
};

/* ================= FORMAT RESPONSE ================= */
export function formatResponse(
  _title: string | null,
  sections: Section[],
  options: FormatOptions = {}
) {
  let output = "";

  for (const section of sections) {
    if (!section?.content) continue;

    /* ===== HEADING ===== */
    if (section.heading) {
      output += `${section.heading}\n`;
    }

    /* ===== CONTENT ===== */
    if (Array.isArray(section.content)) {
      for (const item of section.content) {
        if (item && item.trim()) {
          output += `- ${item.trim()}\n`;
        }
      }
    } else {
      output += `${section.content.trim()}\n`;
    }

    output += "\n";
  }

  /* ===== OPTIONAL CTA ===== */
  if (options.includeCalendly) {
    output += `If you’d like, you can book a short strategy call here:\n${CALENDLY_LINK}\n`;
  }

  return output.trim();
}
