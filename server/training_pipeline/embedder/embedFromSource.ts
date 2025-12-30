import fs from "fs";
import path from "path";
import { smartChunk } from "../chunker/smartChunker";
import { embedChunk } from "./embedChunk";
import { EmbeddedChunk } from "./embeddingTypes";

export async function embedFromFile(
  filePath: string,
  type: string
): Promise<EmbeddedChunk[]> {
  const text = fs.readFileSync(filePath, "utf8");
  const chunks = smartChunk(text, type as "website" | "persona" | "sales" | "marketing" | "services" | "faqs", path.basename(filePath));

  const embedded: any[] = [];

  for (const chunk of chunks) {
    embedded.push(await embedChunk(chunk));
  }

  return embedded;
}
