// science/model.js: everything the Science workspace shows, as plain rows and numbers. Pure (no DOM), so Node tests can check that
// the numbers on screen are the numbers of the data. The DOM side is science/main.js.

import { candidateAt, differenceImage, matchTruth, passIndices, pixelToSky, stackImages } from "../shared/analysis.js";

export const MODES = [
  { id: "blink", key: "b", label: "Blink", note: "one image at a time" },
  { id: "difference", key: "d", label: "Difference", note: "this image minus the mean of the other passes" },
  { id: "stack", key: "s", label: "Stack", note: "mean of all images (fixed stars add up, a mover smears)" },
  { id: "trail", key: "t", label: "Trail", note: "brightest value of all images (a mover leaves a row of dots)" },
];

const sig = (v, digits = 3) => (Number.isFinite(v) ? Number(v.toPrecision(digits)).toString() : "-");
const fixed = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : "-");
const short = (hash) => (hash ? `${hash.slice(0, 12)}…` : "-");
export const fmtChance = (v) => (!Number.isFinite(v) ? "-" : v === 0 ? "0" : v < 0.001 ? v.toExponential(0) : sig(v, 2));
export const fmtSigned = (v, d = 2) => (Number.isFinite(v) ? (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(d) : "-");

/** Step through frames: dir = +1 / -1, wrapping. */
export const stepFrame = (k, count, dir) => (count ? ((k + dir) % count + count) % count : 0);

/** The image to display for a mode, and the words that say what it is. arrays: Float32Array per frame. */
export function displayImage(mode, arrays, k, mjds) {
  if (mode === "difference") {
    const pass = passIndices(mjds), others = arrays.filter((_, i) => pass[i] !== pass[k]);
    if (!others.length) return { image: arrays[k], caption: "difference needs images from another survey pass: showing the image itself", derivedFrom: 1 };
    return { image: differenceImage(arrays[k], stackImages(others)), caption: `difference: image ${k + 1} minus the mean of the ${others.length} images of the other passes`, derivedFrom: others.length + 1 };
  }
  if (mode === "stack") return { image: stackImages(arrays), caption: `stack: mean of ${arrays.length} images`, derivedFrom: arrays.length };
  if (mode === "trail") return { image: stackImages(arrays, "max"), caption: `trail: brightest value of ${arrays.length} images`, derivedFrom: arrays.length };
  return { image: arrays[k], caption: `image ${k + 1} of ${arrays.length}`, derivedFrom: 1 };
}

/** The timeline: frames grouped by survey pass. [{ pass, dateLabel, frames: [{ index, frameId, title }] }] */
export function timelineModel(frames) {
  const pass = passIndices(frames.map((f) => f.mjd)), groups = [];
  frames.forEach((f, index) => {
    if (!groups[pass[index]]) groups[pass[index]] = { pass: pass[index] + 1, dateLabel: f.dateISO.slice(0, 10), frames: [] };
    groups[pass[index]].frames.push({ index, frameId: f.frameId, title: `Image ${index + 1}: ${f.dateISO.replace("T", " ").replace("Z", " UTC")}, ${fixed(f.wavelengthMinUm, 2)}-${fixed(f.wavelengthMaxUm, 2)} µm` });
  });
  return groups;
}

/** Rows [label, value] about one frame. */
export function frameRows(sequence, k) {
  const f = sequence.frames[k], pass = passIndices(sequence.frames.map((x) => x.mjd));
  return [
    ["Image", `${k + 1} of ${sequence.frames.length} · ${f.frameId} · pass ${pass[k] + 1} of ${pass.at(-1) + 1}`],
    ["Time", `MJD ${fixed(f.mjd, 4)} · ${f.dateISO.replace("T", " ").replace("Z", " UTC")}${f.timeKeyword ? ` (${f.timeKeyword}; time scale not verified)` : ""}`],
    ["Band", `${fixed(f.wavelengthMinUm, 3)}-${fixed(f.wavelengthMaxUm, 3)} µm · ${f.detector} · source: ${f.wavelengthSource ?? "not stated"}`],
    ["Grid", `${sequence.grid.n} × ${sequence.grid.n} px · ${fixed(f.pixelScaleArcsec, 2)}″/px · TAN, north up, east left`],
    ["Unit", f.unit ?? (f.dataKind === "synthetic" ? "none (synthetic: units of the noise)" : "not stated by the file")],
    ["Noise", f.stats ? `σ ${sig(f.stats.noiseSigma)} · range ${sig(f.stats.min)} to ${sig(f.stats.max)} · ${fixed(100 * f.stats.validFraction, 0)} % valid` : "-"],
    ["Bad pixels", f.flags ? `${fixed(100 * f.flags.fractionFlagged, 2)} % flagged` : "no flags in the original"],
  ];
}

/** Rows [label, value] that say where this frame and this sequence come from. */
export function provenanceRows(sequence, k) {
  const f = sequence.frames[k], p = f.provenance, rows = [["Kind", f.dataKind === "synthetic" ? "SYNTHETIC (made by code, not an observation)" : "REAL (processed observation)"]];
  if (p.origin === "generator") rows.push(["Origin", `generator ${p.generator.name} ${p.generator.version}, seed ${p.generator.seed}`]);
  else rows.push(["Origin", `archive file ${p.archive.fileName}`], ["Archive URL", p.archive.sourceUrl ?? "-"], ["OBSID", p.archive.obsId ?? "-"],
    ["Original SHA-256", short(p.archive.sha256)], ["Retrieved", p.archive.retrievedAt ?? "-"]);
  rows.push(["Header check", p.headerCheck], ["Pixels SHA-256", short(f.sha256Pixels)],
    ["Background", f.backgroundSubtracted ? "per-image median subtracted" : "not subtracted"],
    ["Processing", sequence.processing.steps.join(" → ")], ["Code", `${sequence.processing.codeVersion} · ${sequence.processing.processedAt}`]);
  if (sequence.processing.reusedFrom) rows.push(["Reused", sequence.processing.reusedFrom]);
  rows.push(["Terms", sequence.terms]);
  return rows;
}

/** What is under the pointer. x, y: image px (edge coordinates). arrays may be null (pixels not served). */
export function pointerRows(sequence, arrays, k, x, y) {
  const n = sequence.grid.n;
  if (!(x >= 0 && y >= 0 && x < n && y < n)) return [["Pixel", "-"], ["RA, Dec", "-"], ["Offset", "-"], ["Value", "-"]];
  const sky = pixelToSky(x, y, sequence), value = arrays ? arrays[k][Math.floor(y) * n + Math.floor(x)] : NaN, f = sequence.frames[k];
  return [
    ["Pixel", `x ${fixed(x, 1)}  y ${fixed(y, 1)}`],
    ["RA, Dec", `${fixed(sky.raDeg, 5)}°  ${fmtSigned(sky.decDeg, 5)}° (ICRS, flat-sky mapping)`],
    ["Offset", `${fmtSigned(sky.eastArcsec, 1)}″ E  ${fmtSigned(sky.northArcsec, 1)}″ N of the centre`],
    ["Value", Number.isFinite(value) ? `${sig(value, 4)} ${f.unit ?? (f.dataKind === "synthetic" ? "(noise units, synthetic)" : "(no unit)")}` : arrays ? "no data" : "pixels not served"],
  ];
}

/**
 * The candidate table. Returns { head, rows: [{ id, cells, truth }], caption }. Motions in arcsec per year with their error.
 * For a synthetic sequence each row also says whether it is one of the injected movers.
 */
export function candidateTable(set, sequence, source = "stored") {
  const head = ["id", "E ″/yr", "N ″/yr", "± ″/yr", "speed ″/yr", "images", "σ", "chance"];
  if (!set) return { head, rows: [], caption: "No candidate list for this sequence." };
  const truth = sequence.truth ? matchTruth(set, sequence.truth) : null;
  if (truth) head.push("injected?");
  const rows = set.candidates.map((c) => {
    const cells = [c.candidateId, fmtSigned(c.pmEastArcsecPerYr), fmtSigned(c.pmNorthArcsecPerYr), fixed(c.pmErrArcsecPerYr, 2), fixed(c.speedArcsecPerYr, 2),
      `${c.nDet}/${c.nFrames}`, fixed(c.significance, 0), fmtChance(c.falseAlarm)];
    const hit = truth?.matches.find((m) => m.candidateId === c.candidateId) ?? null;
    if (truth) cells.push(hit ? "yes" : "no");
    return { id: c.candidateId, cells, truth: hit };
  });
  const where = source === "browser" ? "run in this browser" : "stored by the processing step";
  const missed = truth?.missed.length ? ` ${truth.missed.length} injected mover(s) were not found.` : "";
  const caption = set.reason ? `The search could not run: ${set.reason}.`
    : `${set.candidates.length} candidate(s) · ${set.algorithm} (reused from SPHEREx Blink 3.0) · ${where} ${set.ranAt} · ${set.stats.passes} passes, ${set.stats.stillDots} still sources.${missed} A candidate is a lead, never a discovery.`;
  return { head, rows, caption };
}

/** Detail rows of one candidate. */
export function candidateRows(c, sequence) {
  const scale = sequence.grid.pixelScaleArcsec;
  return [
    ["Position", `x ${fixed(c.x, 2)}  y ${fixed(c.y, 2)} px ± ${fixed(c.posErrPx, 2)} at MJD ${fixed(c.mjdRef, 2)}`],
    ["RA, Dec", `${fixed(c.raDeg, 5)}°  ${fmtSigned(c.decDeg, 5)}°`],
    ["Motion", `${fixed(c.vx, 2)}, ${fixed(c.vy, 2)} ± ${fixed(c.vErrPx, 2)} px/yr = ${fixed(c.speedPx * scale, 2)} ″/yr`],
    ["Fit", `rms ${fixed(c.rms, 2)} px · ${c.nDet} of ${c.nFrames} images · mean S/N ${fixed(c.snr, 0)}`],
    ["Chance lines", `${fmtChance(c.falseAlarm)} expected in this field (not a probability of being real)`],
  ];
}

/** The marks to draw for the current frame. layers: { candidates, truth }. */
export function marksFor(sequence, set, k, { layers, selectedId = null, mode = "blink" }) {
  const marks = [], mjd = sequence.frames[k].mjd, still = mode === "blink" || mode === "difference";
  if (layers.candidates && set) for (const c of set.candidates) {
    const dates = still ? [mjd] : sequence.frames.map((f) => f.mjd);
    dates.forEach((d, i) => { const p = candidateAt(c, d); marks.push({ x: p.x, y: p.y, kind: "candidate", shape: "ring", strong: c.candidateId === selectedId, label: i === 0 ? c.candidateId : null, radiusPx: still ? 2.6 : 1.4 }); });
  }
  if (layers.truth && sequence.truth) for (const m of sequence.truth.movers) {
    const yr = (mjd - sequence.truth.mjdRef) / 365.25;
    marks.push({ x: m.x + m.vxPxPerYr * yr, y: m.y + m.vyPxPerYr * yr, kind: "truth", shape: "cross", radiusPx: 4 });
  }
  return marks;
}
