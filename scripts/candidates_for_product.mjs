// The candidate step of the processing job (backend/blink/processing/job.py): run the reused detector (movers-2, via analysis.runDetector)
// on a product folder (sequence.json + frames/<id>.f32, <id>.mask.u8) and print the CandidateSet as JSON on stdout.
//
//   node scripts/candidates_for_product.mjs <product folder>
//
// No network. The same function the Science view runs in the browser, so a stored result and an in-browser run agree.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runDetector } from "../frontend/js/shared/analysis.js";

const dir = process.argv[2];
if (!dir) { console.error("usage: node scripts/candidates_for_product.mjs <product folder>"); process.exit(2); }
const sequence = JSON.parse(readFileSync(join(dir, "sequence.json"), "utf8"));
const n = sequence.grid.n;
const read = (p, Type, bytes) => { const b = readFileSync(join(dir, p)); if (b.byteLength !== bytes) throw new Error(`${p}: ${b.byteLength} bytes, expected ${bytes}`); return new Type(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const arrays = sequence.frames.map((f) => read(f.dataUrl, Float32Array, 4 * n * n));
const masks = sequence.frames.map((f) => (f.maskUrl ? read(f.maskUrl, Uint8Array, n * n) : null));
process.stdout.write(JSON.stringify(runDetector(sequence, arrays, masks)));
