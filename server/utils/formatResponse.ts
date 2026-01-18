import { CALENDLY_LINK } from "../config/constants.js";

type Section = {
  heading: string;
  content: string | string[];
};

type FormatOptions = {
  includeCalendly?: boolean;
};

export function formatResponse(
  title: string,
  sections: Section[],
  options: FormatOptions = {}
) {
  let output = "";

  if (title) {
    output += `${title}\n\n`;
  }

  for (const section of sections) {
    output += `## ${section.heading}\n`;

    if (Array.isArray(section.content)) {
      for (const item of section.content) {
        output += `• ${item}\n`;
      }
    } else {
      output += `${section.content}\n`;
    }

    output += "\n";
  }

  if (options.includeCalendly) {
    output += ` ~E **Schedule a strategy call:**\n${CALENDLY_LINK}\n`;
  }

  return output.trim();
}
