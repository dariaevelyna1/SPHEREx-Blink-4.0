// The numbers the Science workspace shows are the numbers of the data: science/model.js against the static edu bundle.
import { readFileSync } from "node:fs";
import { check, done, near } from "./_t.mjs";
import { MODES, candidateRows, candidateTable, displayImage, fmtChance, fmtSigned, frameRows, marksFor, pointerRows, provenanceRows, stepFrame, timelineModel } from "../frontend/js/science/model.js";
import { runDetector } from "../frontend/js/shared/analysis.js";

const base = new URL("../frontend/data/edu/sequences/", import.meta.url);
const load = (id) => {
  const sequence = JSON.parse(readFileSync(new URL(`${id}/sequence.json`, base)));
  const arrays = sequence.frames.map((f) => { const b = readFileSync(new URL(`${id}/${f.dataUrl}`, base)); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); });
  const candidates = JSON.parse(readFileSync(new URL(`${id}/candidates.json`, base)));
  return { sequence, arrays, candidates };
};
const A = load("syn-a-d2");
const n = A.sequence.grid.n, count = A.sequence.frames.length;

check("four modes with distinct keys", MODES.length === 4 && new Set(MODES.map((m) => m.key)).size === 4);
check("stepFrame wraps forward", stepFrame(count - 1, count, 1) === 0);
check("stepFrame wraps backward", stepFrame(0, count, -1) === count - 1);
check("stepFrame with no frames", stepFrame(3, 0, 1) === 0);
check("fmtSigned uses a true minus", fmtSigned(-1.234) === "−1.23" && fmtSigned(2) === "+2.00");
check("fmtChance small values in exponent form", fmtChance(4.2e-13) === "4e-13" && fmtChance(0) === "0" && fmtChance(NaN) === "-");

// the timeline groups the frames by survey pass, and every frame appears exactly once
const tl = timelineModel(A.sequence.frames);
check("timeline has the bundle's pass count", tl.length === 4, `got ${tl.length}`);
check("timeline lists every frame once", tl.flatMap((g) => g.frames.map((f) => f.index)).join() === [...Array(count).keys()].join());

// display images
const blink = displayImage("blink", A.arrays, 3, A.sequence.frames.map((f) => f.mjd));
check("blink shows the frame itself", blink.image === A.arrays[3] && blink.derivedFrom === 1);
const diff = displayImage("difference", A.arrays, 0, A.sequence.frames.map((f) => f.mjd));
check("difference uses the other passes only", diff.derivedFrom === 1 + count - tl[0].frames.length, `derivedFrom ${diff.derivedFrom}`);
const stack = displayImage("stack", A.arrays, 0, A.sequence.frames.map((f) => f.mjd));
let mean0 = 0; for (const a of A.arrays) mean0 += a[0]; mean0 /= count;
check("stack pixel 0 is the mean of the frames", near(stack.image[0], mean0, 1e-4), `${stack.image[0]} vs ${mean0}`);
const trail = displayImage("trail", A.arrays, 0, A.sequence.frames.map((f) => f.mjd));
check("trail pixel 0 is the max of the frames", near(trail.image[0], Math.max(...A.arrays.map((a) => a[0])), 1e-6));
const lone = displayImage("difference", [A.arrays[0]], 0, [A.sequence.frames[0].mjd]);
check("difference with one pass says so and shows the image", lone.image === A.arrays[0] && /needs images from another/.test(lone.caption));

// rows quote the document
const fr = Object.fromEntries(frameRows(A.sequence, 2));
check("frame row: MJD of the frame", fr.Time.includes(A.sequence.frames[2].mjd.toFixed(4)));
check("frame row: synthetic unit is stated as none", /none \(synthetic/.test(fr.Unit));
const pr = Object.fromEntries(provenanceRows(A.sequence, 0));
check("provenance says SYNTHETIC", pr.Kind.startsWith("SYNTHETIC"));
check("provenance names the generator and seed", pr.Origin.includes(String(A.sequence.frames[0].provenance.generator.seed)));
check("provenance shows the pixel hash prefix", pr["Pixels SHA-256"].startsWith(A.sequence.frames[0].sha256Pixels.slice(0, 12)));

// the pointer: pixel value read from the float array
const pt = Object.fromEntries(pointerRows(A.sequence, A.arrays, 0, 10.5, 20.5));
const v = A.arrays[0][20 * n + 10];
check("pointer value is the float pixel", pt.Value.startsWith(String(Number(v.toPrecision(4)))), `${pt.Value} vs ${v}`);
check("pointer at the centre is at the field centre", pointerRows(A.sequence, A.arrays, 0, n / 2, n / 2)[1][1].startsWith(A.sequence.center.raDeg.toFixed(5)));
check("pointer outside the image shows dashes", pointerRows(A.sequence, A.arrays, 0, -1, 5).every(([, val]) => val === "-"));
check("pointer without pixels says so", Object.fromEntries(pointerRows(A.sequence, null, 0, 5, 5)).Value === "pixels not served");

// the candidate table
const t = candidateTable(A.candidates, A.sequence);
check("table has one row per stored candidate", t.rows.length === A.candidates.candidates.length && t.rows.length >= 1);
check("synthetic table has the injected? column", t.head.at(-1) === "injected?");
check("the field-A mover is matched to its injection", t.rows.some((r) => r.cells.at(-1) === "yes"));
check("caption says a candidate is a lead", /lead, never a discovery/.test(t.caption));
const c01 = A.candidates.candidates[0];
check("speed cell is the document's speed", t.rows[0].cells[4] === c01.speedArcsecPerYr.toFixed(2));
check("no candidate list -> explicit message", candidateTable(null, A.sequence).caption.startsWith("No candidate list"));
check("candidate rows mention chance lines are not a probability", /not a probability/.test(Object.fromEntries(candidateRows(c01, A.sequence))["Chance lines"]));

// marks
const marks = marksFor(A.sequence, A.candidates, 0, { layers: { candidates: true, truth: true }, selectedId: c01.candidateId });
check("blink marks: one ring per candidate on this frame", marks.filter((m) => m.kind === "candidate").length === A.candidates.candidates.length);
check("truth cross drawn for each injected mover", marks.filter((m) => m.kind === "truth").length === A.sequence.truth.movers.length);
check("selected candidate drawn strong", marks.some((m) => m.kind === "candidate" && m.strong));
const stackMarks = marksFor(A.sequence, A.candidates, 0, { layers: { candidates: true, truth: false }, mode: "stack" });
check("stack marks: the whole track", stackMarks.length === A.candidates.candidates.length * count);
check("layers off -> no marks", marksFor(A.sequence, A.candidates, 0, { layers: { candidates: false, truth: false } }).length === 0);

// running the search in the browser gives the stored result (same code, same pixels)
const again = runDetector(A.sequence, A.arrays, null, { ranAt: A.candidates.ranAt });
check("browser search reproduces the stored candidate count", again.candidates.length === A.candidates.candidates.length);
check("browser search reproduces the stored motion", near(again.candidates[0].speedArcsecPerYr, c01.speedArcsecPerYr, 1e-6));

done();
