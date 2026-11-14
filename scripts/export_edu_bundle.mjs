// Make the static edu bundle: SYNTHETIC fields with known movers, as the documents of docs/DATA_CONTRACT.md section 10.
//
//   node scripts/export_edu_bundle.mjs            write frontend/data/edu/ (health.json, sequences.json, sequences/<id>/...)
//   node scripts/export_edu_bundle.mjs --check    write nothing; exit 1 if the committed bundle differs from what the code makes now
//
// Seeded and dated with a fixed date, so two runs give the same bytes (tests/test_bundle.mjs checks it). The candidates are made by the
// reused 3.0 detector (movers-2) on the float pixels, exactly as the Science view does in the browser. real_examples.json is not made
// here: it is a hand-written table of numbers quoted from 3.0's validation.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BUNDLE_MADE, FIELD_SPECS, buildSequence, floatBytes, staticHealth, summarise } from "../frontend/js/shared/synthField.js";
import { runDetector } from "../frontend/js/shared/analysis.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "frontend", "data", "edu");
const text = (doc) => JSON.stringify(doc, null, 1) + "\n";

/** Every file of the bundle as { "relative/path": Uint8Array }. */
export async function makeBundle() {
  const files = {}, summaries = [];
  for (const spec of FIELD_SPECS) {
    const { sequence, arrays, masks } = await buildSequence(spec);
    const candidates = runDetector(sequence, arrays, masks, { ranAt: BUNDLE_MADE });
    sequence.processing.steps.push(`detect and link: ${candidates.algorithm} (reused from SPHEREx Blink 3.0), stored in candidates.json`);
    const base = `sequences/${sequence.sequenceId}/`;
    files[base + "sequence.json"] = Buffer.from(text(sequence));
    files[base + "candidates.json"] = Buffer.from(text(candidates));
    sequence.frames.forEach((f, k) => { files[base + f.dataUrl] = floatBytes(arrays[k]); files[base + f.maskUrl] = masks[k]; });
    summaries.push(summarise(sequence));
  }
  files["sequences.json"] = Buffer.from(text({ sequences: summaries, total: summaries.length, limit: summaries.length, offset: 0 }));
  files["health.json"] = Buffer.from(text(staticHealth(summaries.length)));
  return files;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const files = await makeBundle(), check = process.argv.includes("--check");
  let differ = 0, bytes = 0;
  for (const [rel, data] of Object.entries(files)) {
    const path = resolve(ROOT, rel);
    bytes += data.length;
    if (check) { if (!existsSync(path) || Buffer.compare(readFileSync(path), Buffer.from(data)) !== 0) { differ++; console.log("DIFFERS " + rel); } }
    else { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); }
  }
  console.log(check ? (differ ? `bundle check: FAIL (${differ} file(s) differ)` : `bundle check: PASS (${Object.keys(files).length} files)`)
    : `wrote ${Object.keys(files).length} files, ${(bytes / 1024).toFixed(0)} KB, to ${ROOT}`);
  process.exit(differ ? 1 : 0);
}
