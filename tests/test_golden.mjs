// Equivalence with 3.0: the reused detector (core/features/movers.js) and the adapted injection helpers (core/inject.js) must give
// exactly the output 3.0 recorded for its golden scenarios (3.0 scratch/benchmark.mjs + scratch/benchmark_baseline.json).
// The scenarios below are 3.0's dotsScenario and moversScenario, statement for statement; `canon` and `digest` are 3.0's too.
// Tolerance: exact after rounding every number to 5 significant digits. The third 3.0 scenario (distant body) is not carried over.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { check, done } from "./_t.mjs";
import { detectSources, findMoversInImages, VERSION } from "../frontend/js/core/features/movers.js";
import { mulberry32, renderStar } from "../frontend/js/core/inject.js";

const golden = JSON.parse(readFileSync(new URL("./fixtures/golden_3_0.json", import.meta.url), "utf8"));

function canon(v) {
  if (typeof v === "number") return Number.isFinite(v) ? Number(v.toPrecision(5)) : String(v);
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().filter((k) => typeof v[k] !== "function").map((k) => [k, canon(v[k])]));
  return v;
}
const digest = (v) => createHash("sha1").update(JSON.stringify(canon(v))).digest("hex").slice(0, 16);

function dotsScenario() {
  const n = 293, rng = mulberry32(101);
  const stars = Array.from({ length: 60 }, () => ({ x: 10 + rng() * (n - 20), y: 10 + rng() * (n - 20), flux: 40 + rng() * 400 }));
  const images = Array.from({ length: 30 }, () => renderStar(n, 0, 0, 0, 0.4, rng, { noise: 1, extra: stars.map((s) => ({ ...s, x: s.x + 0.3 * (rng() - 0.5), y: s.y + 0.3 * (rng() - 0.5) })) }));
  return images.map((img) => detectSources(img, n, { sigmaFloor: 1e-9 }).map((d) => ({ x: d.x, y: d.y, snr: d.snr, sigmaPx: d.sigmaPx })));
}
function moversScenario() {
  const n = 49, rng = mulberry32(202), days = [0, 0.1, 0.2, 0.3, 0.4, 120, 120.1, 120.2, 120.3, 120.4, 250, 250.1, 250.2, 250.3, 250.4, 250.5, 397, 397.1];
  const mjds = days.map((d) => 60908 + d), ref = (mjds[0] + mjds.at(-1)) / 2;
  const fixed = Array.from({ length: 14 }, () => ({ x: 6 + rng() * 37, y: 6 + rng() * 37, flux: 60 + rng() * 300 }));
  const frames = mjds.map((m) => { const yr = (m - ref) / 365.25; return { mjd: m, grey: renderStar(n, 0, 0, 0, 0.4, rng, { noise: 1, extra: [...fixed, { x: 20 + 1.7 * yr, y: 28 - 0.9 * yr, flux: 120 }] }) }; });
  return findMoversInImages(frames, n, { sigmaFloor: 1e-9, register: false });
}

check("the detector is the version 3.0 validated (movers-2)", VERSION === "movers-2", VERSION);
const got = { "detect: the dots of 30 images of 293 x 293 px": digest(dotsScenario()), "movers: 18 images of 49 x 49 px, one mover among 14 stars": null };
const movers = moversScenario();
got["movers: 18 images of 49 x 49 px, one mover among 14 stars"] = digest(movers);
for (const s of golden.scenarios) check(`same output as 3.0: ${s.name}`, got[s.name] === s.digest, `got ${got[s.name]}, 3.0 recorded ${s.digest}`);
check("the golden mover scenario finds its one mover", movers.candidates.length === 1 && Math.abs(movers.candidates[0].vx - 1.7) < 0.3 && Math.abs(movers.candidates[0].vy + 0.9) < 0.3,
  JSON.stringify(movers.candidates.map((c) => [c.vx, c.vy])));

done();
