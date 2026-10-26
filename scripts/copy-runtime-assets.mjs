import fs from "node:fs";
import path from "node:path";

const [mode, sourceArg, targetArg] = process.argv.slice(2);
if (!mode || !sourceArg || !targetArg) {
  throw new Error("Usage: node scripts/copy-runtime-assets.mjs <tree|json-tree|ts-tree|file> <source> <target>");
}

const source = path.resolve(sourceArg);
const target = path.resolve(targetArg);
if (!fs.existsSync(source) && mode === "optional-tree") {
  fs.mkdirSync(target, { recursive: true });
  process.exit(0);
}
if (!fs.existsSync(source)) throw new Error(`Copy source not found: ${source}`);
const stat = fs.statSync(source);
fs.mkdirSync(stat.isDirectory() ? target : path.dirname(target), { recursive: true });

if (mode === "file") {
  if (!stat.isFile()) throw new Error(`Expected a file source: ${source}`);
  fs.copyFileSync(source, target);
} else {
  if (!stat.isDirectory()) throw new Error(`Expected a directory source: ${source}`);
  const extensions = mode === "json-tree" ? new Set([".json"]) : mode === "ts-tree" ? new Set([".ts"]) : null;
  if (!new Set(["tree", "optional-tree", "json-tree", "ts-tree"]).has(mode)) throw new Error(`Unknown copy mode: ${mode}`);
  fs.cpSync(source, target, {
    recursive: true,
    filter: candidate => {
      const candidateStat = fs.statSync(candidate);
      return candidateStat.isDirectory() || !extensions || extensions.has(path.extname(candidate));
    },
  });
}
