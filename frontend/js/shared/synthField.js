// synthField.js: SYNTHETIC fields with known movers, as contract documents. Pure (the hash function is injected), seeded, reproducible.
//
// A field is a few fixed stars and one or more movers on white noise, seen in 4 survey passes about six months apart (3 images each).
// Stars are pixel-integrated Gaussians (core/inject.js, reused from 3.0). The pixels are in units of the noise sigma: they have no physical unit.
// These images are made by code. They are not observations, not simulations of a real place, and not AI-generated.
//
// What is simplified (docs/SCIENTIFIC_LIMITATIONS.md): white noise, a Gaussian PSF of one width, the same brightness at every wavelength,
// movers on straight lines at constant speed, no parallax, no bad pixels, every image on a perfect common grid apart from a small jitter.

import { mulberry32, renderStar } from "../core/inject.js";
import { passIndices } from "../core/features/movers.js";
import { CONTRACT_VERSION, summaryOf } from "./contract.js";

export const GENERATOR = { name: "synthField", version: "synth-1" };
export const BUNDLE_VERSION = "edu-1";
export const BUNDLE_MADE = "2026-11-14T00:00:00Z";          // a fixed date, so that the bundle is byte-for-byte reproducible
export const DEFAULT_SCALE_ARCSEC = 6.14;                   // the pixel scale measured on real SPHEREx files in 3.0 (DATA_CHECKLIST), used here only to give the synthetic grid a familiar size
const PASS_DAYS = [0, 183, 366, 549], WITHIN_PASS = [0, 0.1, 0.2];
// The rough band of each detector (3.0 query.py NOMINAL_WAVE_UM, itself an assumption): only used to give synthetic frames a plausible wavelength.
const NOMINAL_WAVE_UM = { D1: [0.75, 1.09], D2: [1.10, 1.62], D3: [1.63, 2.41], D4: [2.42, 3.82], D5: [3.83, 4.41], D6: [4.42, 5.00] };

/** The three fields of the public bundle. Mover positions are px (edge coordinates) at the middle date, velocities px per year (+x = west, +y = south). */
export const FIELD_SPECS = [
  { fieldId: "syn-a", title: "Synthetic field A: one clear mover", detector: "D2", center: { raDeg: 136.5, decDeg: 16.6 }, seed: 4101, stars: 14,
    movers: [{ x: 16, y: 30, vx: 7.5, vy: -4.0, flux: 160 }] },
  { fieldId: "syn-b", title: "Synthetic field B: a slow, faint mover and a one-image flash", detector: "D2", center: { raDeg: 201.3, decDeg: -11.2 }, seed: 4202, stars: 18,
    movers: [{ x: 27, y: 19, vx: -1.9, vy: 1.2, flux: 90 }], transients: [{ frame: 4, x: 12.4, y: 36.6, flux: 140 }] },
  { fieldId: "syn-c", title: "Synthetic field C: two movers at different speeds", detector: "D4", center: { raDeg: 54.8, decDeg: 23.4 }, seed: 4303, stars: 16,
    movers: [{ x: 24, y: 14, vx: 14, vy: 6, flux: 150 }, { x: 33, y: 31, vx: -2.6, vy: -1.4, flux: 130 }] },
];

export const mjdToISO = (mjd) => new Date(Math.round((mjd - 40587) * 86400) * 1000).toISOString().slice(0, 19) + "Z";
const round = (v, digits = 4) => Number(v.toPrecision(digits));
const median = (values) => { const s = Float64Array.from(values).sort(); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/** Derived numbers of an image that do not reveal it: the share of finite pixels, a robust noise (1.4826 x the median absolute deviation), the extremes. */
export function frameStats(img) {
  const finite = Array.from(img).filter(Number.isFinite);
  if (!finite.length) return { validFraction: 0, noiseSigma: null, min: null, max: null };
  const m = median(finite), mad = median(finite.map((v) => Math.abs(v - m)));
  return { validFraction: round(finite.length / img.length), noiseSigma: round(1.4826 * mad), min: round(Math.min(...finite)), max: round(Math.max(...finite)) };
}

/**
 * The pixels of a field. spec: { seed, stars, movers, transients?, n?, psfSigmaPx?, jitterPx?, mjd0? }.
 * Returns { n, mjds, mjdRef, arrays (Float32Array per image, median-subtracted), masks (all zero), stars, truth }.
 */
export function generatePixels(spec) {
  const n = spec.n ?? 49, sigma = spec.psfSigmaPx ?? 0.4, jitter = spec.jitterPx ?? 0.1, rng = mulberry32(spec.seed);
  const mjds = PASS_DAYS.flatMap((d) => WITHIN_PASS.map((w) => (spec.mjd0 ?? 60908) + d + w));
  const mjdRef = (mjds[0] + mjds.at(-1)) / 2;
  // Stars are kept clear of every mover's path (clearPx) and of each other (3 px). A mover that passes within a couple of pixels of a star
  // blends with it and its measured position is pulled off the line by up to 0.6 px: a known limit of the detector (3.0 movers.js header),
  // seen here when the first draft of field A sent its mover through a clump of stars. The bundle's fields avoid that on purpose and say so.
  const clear = spec.clearPx ?? 4, far = (a, b, d) => Math.hypot(a.x - b.x, a.y - b.y) >= d;
  const keepOut = [...spec.movers.flatMap((m) => mjds.map((mjd) => ({ x: m.x + m.vx * (mjd - mjdRef) / 365.25, y: m.y + m.vy * (mjd - mjdRef) / 365.25 }))), ...(spec.transients ?? [])];
  const stars = [];
  for (let tries = 0; stars.length < spec.stars && tries < 5000; tries++) {
    const s = { x: 5 + rng() * (n - 10), y: 5 + rng() * (n - 10), flux: 60 + rng() * 300 };
    if (keepOut.every((p) => far(p, s, clear)) && stars.every((o) => far(o, s, 3))) stars.push(s);
  }
  const arrays = mjds.map((mjd, k) => {
    const yr = (mjd - mjdRef) / 365.25, jx = jitter * (rng() - 0.5), jy = jitter * (rng() - 0.5);
    const sources = [
      ...stars.map((s) => ({ x: s.x + jx, y: s.y + jy, flux: s.flux })),
      ...spec.movers.map((m) => ({ x: m.x + m.vx * yr + jx, y: m.y + m.vy * yr + jy, flux: m.flux })),
      ...(spec.transients ?? []).filter((t) => t.frame === k).map((t) => ({ x: t.x, y: t.y, flux: t.flux })),
    ];
    const img = renderStar(n, 0, 0, 0, sigma, rng, { noise: 1, extra: sources });
    const med = median(img);
    for (let i = 0; i < img.length; i++) img[i] -= med;        // the contract's float pixels are background-subtracted (per-image median)
    return img;
  });
  const truth = { mjdRef, movers: spec.movers.map((m) => ({ x: m.x, y: m.y, vxPxPerYr: m.vx, vyPxPerYr: m.vy, flux: m.flux })),
    transients: (spec.transients ?? []).map((t) => ({ frame: t.frame, x: t.x, y: t.y })) };
  return { n, mjds, mjdRef, arrays, masks: arrays.map(() => new Uint8Array(n * n)), stars, truth };
}

/** Where a truth mover is on a date (px). */
export const truthAt = (mover, mjdRef, mjd) => ({ x: mover.x + mover.vxPxPerYr * (mjd - mjdRef) / 365.25, y: mover.y + mover.vyPxPerYr * (mjd - mjdRef) / 365.25 });

/** SHA-256 of bytes as hex, with the Web Crypto API (browsers and Node 20+). */
export async function sha256Hex(bytes) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The exact bytes of an image as the contract serves them (little-endian float32). */
export function floatBytes(img) {
  const out = new Uint8Array(img.length * 4), view = new DataView(out.buffer);
  for (let i = 0; i < img.length; i++) view.setFloat32(i * 4, img[i], true);
  return out;
}

/**
 * A field as a contract Sequence plus its pixels: { sequence, arrays, masks }. The sequence's dataUrl/maskUrl are relative ("frames/f000.f32").
 * `hash` (bytes -> hex, may be async) is injected so that this stays pure; `processedAt` defaults to the bundle's fixed date.
 */
export async function buildSequence(spec, { hash = sha256Hex, processedAt = BUNDLE_MADE, scaleArcsec = DEFAULT_SCALE_ARCSEC } = {}) {
  const px = generatePixels(spec), { n } = px, s = scaleArcsec / 3600;
  const band = NOMINAL_WAVE_UM[spec.detector] ?? [1, 2], wrng = mulberry32(spec.seed + 1);
  const frames = [];
  for (let k = 0; k < px.arrays.length; k++) {
    const centre = band[0] + 0.02 + wrng() * (band[1] - band[0] - 0.04), id = "f" + String(k).padStart(3, "0");
    frames.push({
      frameId: id, mjd: round(px.mjds[k], 10), dateISO: mjdToISO(px.mjds[k]), timeKeyword: null,
      detector: spec.detector, wavelengthMinUm: round(centre - 0.015), wavelengthMaxUm: round(centre + 0.015), wavelengthSource: "synthetic",
      pixelScaleArcsec: scaleArcsec, unit: null,
      dataKind: "synthetic", backgroundSubtracted: true, pixelsServed: true,
      dataUrl: `frames/${id}.f32`, maskUrl: `frames/${id}.mask.u8`, imageUrl: null, flagsUrl: null,
      sha256Pixels: await hash(floatBytes(px.arrays[k])),
      flags: { anyFlagged: false, fractionFlagged: 0 },
      stats: frameStats(px.arrays[k]),
      provenance: { headerCheck: "synthetic", origin: "generator", generator: { ...GENERATOR, seed: spec.seed }, archive: null },
    });
  }
  const sequence = {
    contractVersion: CONTRACT_VERSION,
    sequenceId: `${spec.fieldId}-${spec.detector.toLowerCase()}`, fieldId: spec.fieldId, title: spec.title,
    dataKind: "synthetic", detector: spec.detector,
    center: { raDeg: spec.center.raDeg, decDeg: spec.center.decDeg, frame: "ICRS" }, fovArcmin: round(n * scaleArcsec / 60),
    grid: { projection: "TAN", orientation: "north up, east left", rowOrder: "row 0 = north", n, pixelScaleArcsec: scaleArcsec,
      crvalDeg: [spec.center.raDeg, spec.center.decDeg], crpix: [(n + 1) / 2, (n + 1) / 2], cdDeg: [[-s, 0], [0, s]] },
    unit: null, pixelsServed: true, frames,
    processing: { steps: [`generate: seeded synthetic field (${GENERATOR.name} ${GENERATOR.version}, seed ${spec.seed})`, "background: per-image median subtracted"],
      codeVersion: `blink-4.0 ${GENERATOR.version}`, processedAt, reusedFrom: "star rendering: SPHEREx-Blink-3.0@06ac378 scratch/lib_inject.mjs" },
    truth: px.truth,
    terms: "Synthetic data made by this project's code (MIT). Not an observation.",
  };
  return { sequence, arrays: px.arrays, masks: px.masks };
}

export const summarise = (sequence) => summaryOf(sequence, passIndices(sequence.frames.map((f) => f.mjd)).at(-1) + 1);

/** The health document of the static bundle. */
export const staticHealth = (sequenceCount) => ({ contractVersion: CONTRACT_VERSION, profile: "edu", dataSource: "STATIC", storeReachable: true,
  manifestVersion: BUNDLE_VERSION, realDataEnabled: false, servePixels: true, sequenceCount, time: BUNDLE_MADE, problem: null });
