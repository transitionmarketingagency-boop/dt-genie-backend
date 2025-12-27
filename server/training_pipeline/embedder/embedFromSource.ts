import fs from "fs";
import path from "path";
import { smartChunk } from "../chunker/smartChunker.js";
import { embedChunk } from "./embedChunk.js";

export async function embedFromFile(
  filePath: string,
  type: any
) {
  const text = fs.readFileSync(filePath, "utf8");
  const chunks = smartChunk(text, type, path.basename(filePath));

  const embedded = [];
  for (const chunk of chunks) {
    embedded.push(await embedChunk(chunk));
  }

  return embedded;
}
