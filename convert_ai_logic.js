// convert_ai_logic.js
import fs from "fs";
import path from "path";

const LEGACY_FOLDER = path.join(process.cwd(), "server", "ai_logic");
const OUTPUT_FOLDER = path.join(process.cwd(), "server", "ai_logic_converted");

if (!fs.existsSync(OUTPUT_FOLDER)) fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });

function getAllJSONFiles(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  for (const f of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, f);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) files = files.concat(getAllJSONFiles(fullPath));
    else if (f.endsWith(".json")) files.push(fullPath);
  }
  return files;
}

function convertFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    let triggers = [];
    let responses = [];

    if (data.triggers && data.responses) {
      triggers = data.triggers;
      responses = data.responses;
    } else if (data.faqs && Array.isArray(data.faqs)) {
      for (const faq of data.faqs) {
        if (faq.question && faq.answer) {
          triggers.push(faq.question);
          responses.push(faq.answer);
        }
      }
    } else if (data.rawContent || data.text) {
      const text = data.rawContent || data.text;
      const paragraphs = text.split(/\n{1,}/).map(p => p.trim()).filter(Boolean);
      triggers = paragraphs.map((p,i) => `trigger_${i+1}`);
      responses = paragraphs;
    } else {
      triggers = ["*"];
      responses = [JSON.stringify(data)];
    }

    if (triggers.length && responses.length) {
      const fileName = path.basename(filePath);
      const outputPath = path.join(OUTPUT_FOLDER, fileName);
      fs.writeFileSync(outputPath, JSON.stringify({ triggers, responses }, null, 2));
      console.log(`✅ Converted: ${fileName}`);
    } else {
      console.warn(`⚠️ Skipped: ${filePath}`);
    }
  } catch (err) {
    console.error(`❌ Failed: ${filePath}`, err);
  }
}

const allFiles = getAllJSONFiles(LEGACY_FOLDER);
console.log(`Found ${allFiles.length} JSON files.`);

allFiles.forEach(convertFile);

console.log(`\n✅ Conversion complete. Files in ${OUTPUT_FOLDER}`);
