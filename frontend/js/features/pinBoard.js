// pinBoard.js – the Discovery Pin Board: an observer pins a selected candidate under a typed name, no account (pure: storage and crypto are injectable).
//
// The tag reads "Discovered/Verified by <name>" (the author's wording). Scientifically a pin stays a candidate (AGENTS.md): the board says so,
// and every pin carries whether its data were real or synthetic. Pins live in this browser only (localStorage): nothing is sent anywhere.
// The hash is a real SHA-256 of the pin's canonical text (observer, position, time, data kind): it shows the record was not edited later,
// on this machine. It is not a timestamped proof of priority: nothing outside this browser witnessed it.

export const PIN_VERSION = "pins-1";
const KEY = "spherex-blink-pins";

/** Trim and limit an observer handle; returns "" when nothing usable is left. Letters, digits, space and _ . - only. */
export function cleanObserver(name) {
  return String(name ?? "").normalize("NFKC").replace(/[^\p{L}\p{N} _.\-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40);
}

/** The text that is hashed: fixed field order, fixed decimals. */
export function canonicalPinText(p) {
  return [PIN_VERSION, p.observer, p.ra.toFixed(6), p.dec.toFixed(6), p.foundAt, p.dataKind, p.label ?? "", p.speedArcsecPerYear == null ? "" : p.speedArcsecPerYear.toFixed(3)].join("|");
}

export async function sha256Hex(text, subtle = globalThis.crypto?.subtle) {
  if (!subtle) throw new Error("SHA-256 is not available in this browser (crypto.subtle needs http://localhost or https).");
  const buf = await subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Make a pin from a candidate. candidate: { ra, dec, label?, speedArcsecPerYear?, nDet?, nFrames?, known? }.
 * ctx: { observer, realData: boolean, field?: {ra,dec,fov,det}, now?: Date, subtle? }.
 */
export async function makePin(candidate, ctx) {
  const observer = cleanObserver(ctx.observer);
  if (!observer) throw new Error("Enter an observer name.");
  if (!Number.isFinite(candidate?.ra) || !Number.isFinite(candidate?.dec)) throw new Error("This candidate has no sky position to pin.");
  const pin = {
    version: PIN_VERSION,
    observer,
    ra: candidate.ra, dec: candidate.dec,
    label: candidate.label ?? null,
    speedArcsecPerYear: Number.isFinite(candidate.speedArcsecPerYear) ? candidate.speedArcsecPerYear : null,
    checks: { detections: candidate.nDet ?? null, images: candidate.nFrames ?? null, knownObject: candidate.known ?? null },
    field: ctx.field ?? null,
    dataKind: ctx.realData ? "real" : "synthetic",
    foundAt: (ctx.now ?? new Date()).toISOString(),
  };
  pin.hash = await sha256Hex(canonicalPinText(pin), ctx.subtle);
  pin.id = pin.hash.slice(0, 12);
  return pin;
}

export function pinTag(pin) {
  return `Discovered/Verified by ${pin.observer}` + (pin.dataKind === "synthetic" ? " (synthetic demo data)" : "");
}

/** Check a stored pin against its hash (false if any hashed field was changed). */
export async function verifyPin(pin, subtle) {
  try { return (await sha256Hex(canonicalPinText(pin), subtle)) === pin.hash; } catch { return false; }
}

export function loadPins(storage) {
  try {
    const arr = JSON.parse(storage?.getItem(KEY) || "[]");
    return Array.isArray(arr) ? arr.filter((p) => p && Number.isFinite(p.ra) && Number.isFinite(p.dec) && typeof p.hash === "string") : [];
  } catch { return []; }
}

export function savePins(storage, pins) {
  try { storage?.setItem(KEY, JSON.stringify(pins)); return true; } catch { return false; }
}

/** Add a pin unless one with the same hash is there; newest first. */
export function addPin(pins, pin) {
  return pins.some((p) => p.hash === pin.hash) ? pins : [pin, ...pins];
}

export function removePin(pins, id) {
  return pins.filter((p) => p.id !== id);
}

/** Equirectangular all-sky position in [0,1]² for the board map: RA increases to the left (as on the sky), Dec +90 at top. */
export function skyToMap(ra, dec) {
  return { x: 1 - (((ra % 360) + 360) % 360) / 360, y: (90 - Math.max(-90, Math.min(90, dec))) / 180 };
}

// ---------------------------------------------------------------- drawing helpers for the board (pure)

/** The ecliptic (where the Sun, the planets and most asteroids travel) as [ra, dec] degrees; obliquity 23.44° (textbook value). */
export function eclipticPoints(step = 5) {
  const e = 23.44 * Math.PI / 180, out = [];
  for (let l = 0; l <= 360; l += step) {
    const L = l * Math.PI / 180;
    const ra = ((Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L)) * 180 / Math.PI) + 360) % 360;
    out.push([ra, Math.asin(Math.sin(e) * Math.sin(L)) * 180 / Math.PI]);
  }
  return out;
}

/** Offset of a position from a field centre, in arcminutes: east (+) and north (+). Small-field approximation. */
export function fieldOffsetArcmin(ra, dec, ra0, dec0) {
  let dra = ra - ra0;
  if (dra > 180) dra -= 360;
  if (dra < -180) dra += 360;
  return { east: dra * Math.cos(dec0 * Math.PI / 180) * 60, north: (dec - dec0) * 60 };
}

export function initials(name) {
  const parts = String(name).split(/[\s_.\-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}

export function timeAgo(iso, now = Date.now()) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/** Deterministic decorative star field: [x, y, r, opacity] in [0,1]² (not real stars; the board says so). */
export function decorativeStars(n = 260, seed = 7) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return Array.from({ length: n }, () => [rnd(), rnd(), 0.4 + rnd() ** 4 * 1.6, 0.25 + rnd() * 0.6]);
}
