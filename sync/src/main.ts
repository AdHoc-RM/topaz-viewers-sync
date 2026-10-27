import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { loadConfig } from "./config.ts";
import { generateLive } from "./live.ts";

const outputPath = process.argv[2];
if (!outputPath) {
  throw new Error("Usage: node src/main.ts <output path>");
}

const live = await generateLive(loadConfig(process.env));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(live)}\n`);
