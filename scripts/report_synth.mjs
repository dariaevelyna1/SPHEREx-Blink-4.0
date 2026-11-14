// Print the table of docs/VALIDATION.md section 2: what the reused detector recovers from each synthetic field of the bundle.
//
//   node scripts/report_synth.mjs

import { FIELD_SPECS, buildSequence } from "../frontend/js/shared/synthField.js";
import { candidateAt, matchTruth, runDetector } from "../frontend/js/shared/analysis.js";

console.log("| Field | Injected mover (px/yr) | Recovered (px/yr) | Position error (px) | Images | Significance | Chance lines expected | Other candidates |");
console.log("|---|---|---|---|---|---|---|---|");
for (const spec of FIELD_SPECS) {
  const { sequence, arrays, masks } = await buildSequence(spec);
  const set = runDetector(sequence, arrays, masks, { ranAt: "-" }), m = matchTruth(set, sequence.truth, { tolPx: 0.5, tolV: 0.6 });
  sequence.truth.movers.forEach((t, i) => {
    const hit = m.matches.find((h) => h.truthIndex === i), c = hit && set.candidates.find((k) => k.candidateId === hit.candidateId);
    const p = c && candidateAt(c, sequence.truth.mjdRef);
    console.log(`| ${sequence.sequenceId} | (${t.vxPxPerYr}, ${t.vyPxPerYr}) | ${c ? `(${c.vx.toFixed(2)} ± ${c.vErrPx.toFixed(2)}, ${c.vy.toFixed(2)} ± ${c.vErrPx.toFixed(2)})` : "**missed**"} | ${c ? Math.hypot(p.x - t.x, p.y - t.y).toFixed(3) : "-"} | ${c ? `${c.nDet} of ${c.nFrames}` : "-"} | ${c ? c.significance.toFixed(0) + " σ" : "-"} | ${c ? c.falseAlarm.toExponential(0) : "-"} | ${m.extra.length} |`);
  });
}
