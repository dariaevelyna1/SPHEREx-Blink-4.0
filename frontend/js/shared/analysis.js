// analysis.js: what both interfaces do with the float pixels of a sequence. Pure: no DOM, no network.
//
//   display   stretchAsinh, differenceImage, stackImages      a PICTURE derived from the numbers (labelled as derived on screen)
//   detect    runDetector                                     the reused 3.0 detector (movers-2) -> a contract CandidateSet
//   compare   matchTruth, scoreGuess                          synthetic fields only: against the known answer

import { findMoversInImages, passIndices, VERSION as MOVERS_VERSION } from "../core/features/movers.js";
import { canvasToSky } from "../core/geometry.js";

export { passIndices, MOVERS_VERSION };

export const STRETCH = { name: "asinh", soft: 3, lo: -2, hi: 120 };    // in units of the image's noise sigma

/** Grey levels 0..255 of an image for display: asinh((v - lo*sigma) / (soft*sigma)), normalised between lo and hi. NaN (no data) -> 0. */
export function stretchAsinh(img, sigma = 1, { soft = STRETCH.soft, lo = STRETCH.lo, hi = STRETCH.hi } = {}) {
  const out = new Uint8ClampedArray(img.length), s = sigma > 0 ? sigma : 1, top = Math.asinh((hi - lo) / soft);
  for (let i = 0; i < img.length; i++) {
    const v = img[i];
    out[i] = Number.isFinite(v) ? Math.round(255 * Math.max(0, Math.min(1, Math.asinh((v / s - lo) / soft) / top))) : 0;
  }
  return out;
}

/** image minus reference, pixel by pixel (NaN where either has no data). */
export function differenceImage(img, ref) {
  const out = new Float32Array(img.length);
  for (let i = 0; i < img.length; i++) out[i] = img[i] - ref[i];
  return out;
}

/** The mean ("stack") or the maximum ("trail") of several images, ignoring pixels with no data. */
export function stackImages(arrays, how = "mean") {
  const len = arrays[0].length, out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let sum = 0, count = 0, max = -Infinity;
    for (const a of arrays) { const v = a[i]; if (Number.isFinite(v)) { sum += v; count++; if (v > max) max = v; } }
    out[i] = count ? (how === "max" ? max : sum / count) : NaN;
  }
  return out;
}

/** The geometry object geometry.js wants, from a sequence. */
export const geoOf = (sequence) => ({ ra: sequence.center.raDeg, dec: sequence.center.decDeg, n: sequence.grid.n, scaleArcsec: sequence.grid.pixelScaleArcsec });

/** Pixel (edge coordinates) -> sky, with the flat-sky mapping of geometry.js (its accuracy: docs/SCIENTIFIC_LIMITATIONS.md). */
export function pixelToSky(x, y, sequence) {
  const g = geoOf(sequence), p = canvasToSky(x / g.n, y / g.n, g);
  return { raDeg: p.ra, decDeg: p.dec, eastArcsec: p.eastArcsec, northArcsec: p.northArcsec };
}

export const DETECTOR_SETTINGS = { sigmaFloor: 1e-9 };       // float pixels: no 8-bit noise floor (as 3.0 does on real float data)

/**
 * Run the mover search on the float pixels of a sequence and return a contract CandidateSet.
 * arrays: Float32Array per frame, in the order of sequence.frames; masks: Uint8Array per frame, or null.
 */
export function runDetector(sequence, arrays, masks = null, { settings = {}, ranAt = new Date().toISOString() } = {}) {
  const used = { ...DETECTOR_SETTINGS, ...settings }, { n, pixelScaleArcsec: scale } = sequence.grid;
  const frames = sequence.frames.map((f, k) => ({ mjd: f.mjd, grey: arrays[k], mask: masks?.[k] ?? null }));
  const result = findMoversInImages(frames, n, used);
  const candidates = result.candidates.map((c, i) => {
    const sky = pixelToSky(c.x, c.y, sequence);
    return {
      candidateId: "c" + String(i + 1).padStart(2, "0"),
      x: c.x, y: c.y, mjdRef: c.mjdRef, vx: c.vx, vy: c.vy, speedPx: c.speedPx, motionPx: c.motionPx,
      nDet: c.nDet, nFrames: c.nFrames, rms: c.rms, significance: c.significance, snr: c.snr,
      vErrPx: c.vErrPx, posErrPx: c.posErrPx, falseAlarm: c.falseAlarm,
      raDeg: sky.raDeg, decDeg: sky.decDeg,
      pmEastArcsecPerYr: -c.vx * scale, pmNorthArcsecPerYr: -c.vy * scale, pmErrArcsecPerYr: c.vErrPx * scale,
      speedArcsecPerYr: c.speedPx * scale,
      points: c.points.map((p) => ({ frame: p.frame, x: p.x + (c.shifts?.[p.frame]?.dx ?? 0), y: p.y + (c.shifts?.[p.frame]?.dy ?? 0) })),
    };
  });
  const st = result.stats ?? {};
  return {
    sequenceId: sequence.sequenceId, dataKind: sequence.dataKind,
    algorithm: MOVERS_VERSION, settings: used, ranAt,
    stats: { frames: st.frames ?? frames.length, passes: st.passes ?? 0, stillDots: st.stillDots ?? 0, dotsPerFrame: st.dotsPerFrame ?? [] },
    reason: result.reason ?? null, candidates,
    note: "A candidate is a lead with its evidence, never a discovery.",
  };
}

/** Where a candidate is on a date (px), from its line. */
export const candidateAt = (c, mjd) => ({ x: c.x + c.vx * (mjd - c.mjdRef) / 365.25, y: c.y + c.vy * (mjd - c.mjdRef) / 365.25 });

/**
 * Synthetic fields only: which truth mover does each candidate correspond to?
 * A match = position at the truth's reference date within tolPx and velocity within tolV (px/yr). Returns
 * { matches: [{ truthIndex, candidateId, dPx, dV }], missed: [truthIndex], extra: [candidateId] }.
 */
export function matchTruth(candidateSet, truth, { tolPx = 1.0, tolV = 1.0 } = {}) {
  const matches = [], taken = new Set();
  truth.movers.forEach((m, truthIndex) => {
    let best = null;
    for (const c of candidateSet.candidates) {
      if (taken.has(c.candidateId)) continue;
      const p = candidateAt(c, truth.mjdRef), dPx = Math.hypot(p.x - m.x, p.y - m.y), dV = Math.hypot(c.vx - m.vxPxPerYr, c.vy - m.vyPxPerYr);
      if (dPx <= tolPx && dV <= tolV && (!best || dPx < best.dPx)) best = { truthIndex, candidateId: c.candidateId, dPx, dV };
    }
    if (best) { matches.push(best); taken.add(best.candidateId); }
  });
  return { matches, missed: truth.movers.map((_, i) => i).filter((i) => !matches.some((m) => m.truthIndex === i)),
    extra: candidateSet.candidates.map((c) => c.candidateId).filter((id) => !taken.has(id)) };
}

/**
 * The game: how good is a guess? guess = { x, y } in px on the image of date `mjd`. The distance to the nearest truth mover on that date;
 * a hit is within hitPx. Points: 100 for a bull's-eye, falling to 40 at the edge of a hit, minus 15 per earlier miss, never below 10 for a hit.
 */
export function scoreGuess(guess, truth, mjd, { hitPx = 2.5, misses = 0 } = {}) {
  let best = { distancePx: Infinity, moverIndex: -1 };
  truth.movers.forEach((m, moverIndex) => {
    const yr = (mjd - truth.mjdRef) / 365.25, d = Math.hypot(guess.x - (m.x + m.vxPxPerYr * yr), guess.y - (m.y + m.vyPxPerYr * yr));
    if (d < best.distancePx) best = { distancePx: d, moverIndex };
  });
  const hit = best.distancePx <= hitPx;
  const points = hit ? Math.max(10, Math.round(100 - 60 * (best.distancePx / hitPx)) - 15 * misses) : 0;
  return { ...best, hit, points };
}
