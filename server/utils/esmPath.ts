import path from "path";
import { pathToFileURL, fileURLToPath } from "url";

export function filePathToUrl(p: string): string {
  return pathToFileURL(path.resolve(p)).href;
}

export function getESMDir(metaUrl: string): string {
  return path.dirname(fileURLToPath(metaUrl));
}

