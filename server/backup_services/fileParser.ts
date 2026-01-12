import fs from "node:fs";
import * as pdftParse from "pdf-parse";

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
  const data = await (pdftParse as any).default(fileBuffer);
  return data.text;
}

async function parseDocx(filePath: string): Promise<string> {
  // Simple text extraction from DOCX - read file as UTF-8 for now
  // Full DOCX parsing can be added later if needed
  const fileBuffer = fs.readFileSync(filePath);
  
  try {
    // DOCX files contain XML - attempt basic extraction
    const text = fileBuffer.toString("utf-8", 0, Math.min(1000, fileBuffer.length));
    return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "DOCX document";
  } catch {
    return "DOCX document content";
  }
}
