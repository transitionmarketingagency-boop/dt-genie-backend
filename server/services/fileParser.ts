import fs from "node:fs";
import path from "node:path";
import * as pdftParse from "pdf-parse";
import { extractRawText } from "docx";

export async function parseFile(filePath: string, mimeType: string): Promise<string> {
  try {
    if (mimeType === "application/pdf") {
      return await parsePdf(filePath);
    } else if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return await parseDocx(filePath);
    } else if (mimeType === "text/plain") {
      return fs.readFileSync(filePath, "utf-8");
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    throw new Error(
      `Failed to parse file: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

async function parsePdf(filePath: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  const data = await pdftParse(fileBuffer);
  return data.text;
}

async function parseDocx(filePath: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  const result = await extractRawText({ buffer: fileBuffer });
  return result;
}
