// The committed static bundle (frontend/data/edu/) is exactly what the code makes, holds only synthetic pixels, and is self-consistent.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check, done } from "./_t.mjs";
import { makeBundle } from "../scripts/export_edu_bundle.mjs";
import { validateCandidateSet, validateHealth, validateSequence, validateSequenceList } from "../frontend/js/shared/contract.js";
import { matchTruth } from "../frontend/js/shared/analysis.js";

const ROOT = fileURLToPath(new URL("../frontend/data/edu/", import.meta.url));
const read = (rel) => readFileSync(resolve(ROOT, rel));
const json = (rel) => JSON.parse(read(rel).toString("utf8"));
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));

const made = await makeBundle();
const differing = Object.entries(made).filter(([rel, data]) => !existsSync(resolve(ROOT, rel)) || Buffer.compare(read(rel), Buffer.from(data)) !== 0).map(([rel]) => rel);
check("the committed bundle is byte for byte what the code makes (run scripts/export_edu_bundle.mjs if not)", differing.length === 0, differing.slice(0, 4).join(", "));
const onDisk = walk(ROOT).map((p) => p.slice(ROOT.length).replace(/\\/g, "/")).filter((p) => p !== "real_examples.json");
check("the bundle folder holds nothing the code did not make (apart from real_examples.json)", onDisk.every((p) => p in made), onDisk.filter((p) => !(p in made)).join(", "));

check("health.json is valid", validateHealth(json("health.json")).length === 0);
const list = json("sequences.json");
check("sequences.json is valid", validateSequenceList(list).length === 0 && list.total === list.sequences.length);
let bytes = 0;
for (const s of list.sequences) {
  const base = `sequences/${s.sequenceId}/`, seq = json(base + "sequence.json"), cand = json(base + "candidates.json"), n = seq.grid.n;
  check(`${s.sequenceId}: sequence.json is valid`, validateSequence(seq).length === 0, validateSequence(seq).join("; "));
  check(`${s.sequenceId}: synthetic, with a truth block and the generator's seed`, seq.dataKind === "synthetic" && seq.truth.movers.length >= 1 && seq.frames.every((f) => f.provenance.origin === "generator"));
  check(`${s.sequenceId}: every frame file has the grid's size and the recorded SHA-256`, seq.frames.every((f) => {
    const data = read(base + f.dataUrl), mask = read(base + f.maskUrl); bytes += data.length + mask.length;
    return data.length === 4 * n * n && mask.length === n * n && createHash("sha256").update(data).digest("hex") === f.sha256Pixels;
  }));
  check(`${s.sequenceId}: candidates.json is valid and names its algorithm`, validateCandidateSet(cand).length === 0 && cand.algorithm === "movers-2" && cand.sequenceId === s.sequenceId);
  const m = matchTruth(cand, seq.truth, { tolPx: 0.5, tolV: 0.6 });
  check(`${s.sequenceId}: the stored candidates are exactly the injected movers`, m.missed.length === 0 && m.extra.length === 0, JSON.stringify(m));
  check(`${s.sequenceId}: the summary agrees with the sequence`, s.frameCount === seq.frames.length && s.mjdFirst === seq.frames[0].mjd && s.detector === seq.detector && s.passCount === 4);
}
check("the pixel files of the bundle are small (under 600 KB in all)", bytes < 600_000, `${bytes} bytes`);
const real = json("real_examples.json");
check("real_examples.json is numbers only, with its source and a caution", real.dataKind === "real" && real.pixels === false && real.source.includes("VALIDATION.md") && real.caution.length > 20 && real.examples.every((e) => typeof e.difference === "number"));

done();
