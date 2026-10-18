#!/usr/bin/env node
// Zet een afbeelding (png/jpg) om naar WebP, optioneel verkleind.
// sharp zit al in node_modules (Next.js trekt het binnen), dus geen extra dep.
//
//   node scripts/convert-webp.mjs <in.png> <out.webp> [--width 1400] [--quality 82]
//
// Bronbestanden (grote PNG's) blijven bewust buiten git; alleen de webp wordt gecommit.
import sharp from "sharp";
import { statSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const [input, output] = args.filter((a, i) => !a.startsWith("--") && (i === 0 || !args[i - 1].startsWith("--")));
if (!input || !output) {
  console.error("Gebruik: node scripts/convert-webp.mjs <in> <out.webp> [--width N] [--quality Q]");
  process.exit(1);
}
const width = Number(opt("width", "0"));
const quality = Number(opt("quality", "82"));

let pipeline = sharp(input);
if (width > 0) pipeline = pipeline.resize({ width, withoutEnlargement: true });
const info = await pipeline.webp({ quality }).toFile(output);
const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(`${input} (${kb(statSync(input).size)}) → ${output} (${kb(info.size)}, ${info.width}×${info.height})`);
