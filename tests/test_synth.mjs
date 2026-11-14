// The synthetic fields: reproducible, valid contract documents, and the reused detector recovers every injected mover and nothing else.
// Tolerances (stated, not tuned per field): position within 0.5 px at the reference date, each velocity component within 0.6 px/yr.

import { check, done } from "./_t.mjs";
import { FIELD_SPECS, buildSequence, floatBytes, frameStats, generatePixels, mjdToISO, sha256Hex, summarise } from "../frontend/js/shared/synthField.js";
import { validateSequence, validateSummary, validateCandidateSet } from "../frontend/js/shared/contract.js";
import { candidateAt, matchTruth, pixelToSky, runDetector, scoreGuess, stackImages, stretchAsinh, differenceImage } from "../frontend/js/shared/analysis.js";

check("mjdToISO: MJD 51544.5 is J2000.0 noon", mjdToISO(51544.5) === "2000-01-01T12:00:00Z", mjdToISO(51544.5));
check("three bundle fields", FIELD_SPECS.length === 3);

for (const spec of FIELD_SPECS) {
  const a = generatePixels(spec), b = generatePixels(spec);
  check(`${spec.fieldId}: the same seed gives the same pixels`, a.arrays.every((img, k) => img.every((v, i) => v === b.arrays[k][i])));
  check(`${spec.fieldId}: 12 images in 4 passes on a 49 px grid`, a.arrays.length === 12 && a.n === 49 && a.arrays[0].length === 49 * 49);
  const st = frameStats(a.arrays[0]);
  check(`${spec.fieldId}: noise sigma of an image is about 1`, st.noiseSigma > 0.8 && st.noiseSigma < 1.3 && st.validFraction === 1, JSON.stringify(st));

  const { sequence, arrays, masks } = await buildSequence(spec);
  const problems = validateSequence(sequence);
  check(`${spec.fieldId}: the sequence follows the contract`, problems.length === 0, problems.join("; "));
  check(`${spec.fieldId}: its summary follows the contract`, validateSummary(summarise(sequence)).length === 0 && summarise(sequence).passCount === 4);
  check(`${spec.fieldId}: labelled synthetic, with a generator and a seed`, sequence.dataKind === "synthetic" && sequence.frames.every((f) => f.dataKind === "synthetic" && f.provenance.generator.seed === spec.seed && f.unit === null));
  check(`${spec.fieldId}: sha256Pixels is the hash of the served bytes`, sequence.frames[3].sha256Pixels === await sha256Hex(floatBytes(arrays[3])));
  check(`${spec.fieldId}: masks are all zero`, masks.every((m) => m.length === 49 * 49 && m.every((v) => v === 0)));

  const set = runDetector(sequence, arrays, masks, { ranAt: "2026-11-14T00:00:00Z" });
  const cp = validateCandidateSet(set);
  check(`${spec.fieldId}: the candidate set follows the contract`, cp.length === 0, cp.join("; "));
  const m = matchTruth(set, sequence.truth, { tolPx: 0.5, tolV: 0.6 });
  check(`${spec.fieldId}: every injected mover is recovered`, m.missed.length === 0, `missed ${JSON.stringify(m.missed)}; candidates ${JSON.stringify(set.candidates.map((c) => [c.x.toFixed(2), c.y.toFixed(2), c.vx.toFixed(2), c.vy.toFixed(2)]))}; reason ${set.reason}`);
  check(`${spec.fieldId}: no candidate that is not an injected mover`, m.extra.length === 0, JSON.stringify(m.extra));
  for (const hit of m.matches) {
    const c = set.candidates.find((k) => k.candidateId === hit.candidateId), t = sequence.truth.movers[hit.truthIndex];
    check(`${spec.fieldId}: mover ${hit.truthIndex} velocity within 0.6 px/yr per axis`, Math.abs(c.vx - t.vxPxPerYr) < 0.6 && Math.abs(c.vy - t.vyPxPerYr) < 0.6, `${c.vx.toFixed(2)},${c.vy.toFixed(2)} against ${t.vxPxPerYr},${t.vyPxPerYr}`);
    check(`${spec.fieldId}: mover ${hit.truthIndex} sky motion has the right signs (east = -x, north = -y)`, Math.sign(c.pmEastArcsecPerYr) === -Math.sign(t.vxPxPerYr) && Math.sign(c.pmNorthArcsecPerYr) === -Math.sign(t.vyPxPerYr));
    check(`${spec.fieldId}: mover ${hit.truthIndex} is in all 12 images, chance lines far below 1`, c.nDet >= 10 && c.falseAlarm < 1e-3, `nDet ${c.nDet}, chance ${c.falseAlarm}`);
  }
  if (spec.transients) {
    const t = spec.transients[0];
    check(`${spec.fieldId}: the one-image flash is not a candidate`, !set.candidates.some((c) => { const p = candidateAt(c, sequence.frames[t.frame].mjd); return Math.hypot(p.x - t.x, p.y - t.y) < 2; }));
  }
}

// geometry, display and game helpers on field A
const { sequence, arrays } = await buildSequence(FIELD_SPECS[0]);
const centre = pixelToSky(24.5, 24.5, sequence);
check("the centre pixel maps to the field centre", Math.abs(centre.raDeg - 136.5) < 1e-9 && Math.abs(centre.decDeg - 16.6) < 1e-9);
const east = pixelToSky(14.5, 24.5, sequence);
check("10 px to the left is 61.4 arcsec east", Math.abs(east.eastArcsec - 61.4) < 1e-6 && east.raDeg > 136.5);
const grey = stretchAsinh(arrays[0], 1);
check("the stretch gives 0..255 with a dark ground", grey.length === arrays[0].length && Math.max(...grey) > 150 && [...grey].sort((a, b) => a - b)[Math.floor(grey.length / 2)] < 90);
check("a NaN pixel is drawn black", stretchAsinh(new Float32Array([NaN, 0]), 1)[0] === 0);
check("difference of an image with itself is zero", differenceImage(arrays[0], arrays[0]).every((v) => v === 0));
check("a stack is quieter than one image", frameStats(stackImages(arrays)).noiseSigma < 0.5 * frameStats(arrays[0]).noiseSigma);
const truth = sequence.truth, mjd = sequence.frames[0].mjd, yr = (mjd - truth.mjdRef) / 365.25, at = { x: truth.movers[0].x + truth.movers[0].vxPxPerYr * yr, y: truth.movers[0].y + truth.movers[0].vyPxPerYr * yr };
check("a guess on the mover scores 100", scoreGuess(at, truth, mjd).points === 100 && scoreGuess(at, truth, mjd).hit);
check("a guess 2 px off is a hit with fewer points", scoreGuess({ x: at.x + 2, y: at.y }, truth, mjd).hit && scoreGuess({ x: at.x + 2, y: at.y }, truth, mjd).points < 100);
check("a guess 6 px off is a miss with 0 points", !scoreGuess({ x: at.x + 6, y: at.y }, truth, mjd).hit && scoreGuess({ x: at.x + 6, y: at.y }, truth, mjd).points === 0);
check("earlier misses cost points but a hit keeps at least 10", scoreGuess(at, truth, mjd, { misses: 2 }).points === 70 && scoreGuess({ x: at.x + 2.4, y: at.y }, truth, mjd, { misses: 9 }).points === 10);

done();
