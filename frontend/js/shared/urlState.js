// urlState.js: the deep-link parameters both views understand, and the remembered view. Pure except for the storage helpers,
// which take the storage object as an argument and never throw.
//
//   ra, dec (degrees, ICRS), fov (arcmin), det (D1..D6 or all)   the place: picks the sequence whose field contains it
//   seq       a sequence id (wins over ra/dec)
//   api       a backend URL (dataClient.parseApiParam)
//   view      science | learn        lang  en | ro        step  a Learn step number        theme  night | paper

export const VIEWS = ["science", "learn"];
export const KEPT_PARAMS = ["ra", "dec", "fov", "det", "api", "seq", "lang", "theme"];
const VIEW_KEY = "blink4.view";

const num = (v, lo, hi) => { const x = v === null || v === "" ? NaN : Number(v); return Number.isFinite(x) && x >= lo && x <= hi ? x : null; };

/** Parse a query string (or URLSearchParams) into a clean state; anything out of range becomes null. */
export function parseQuery(search) {
  const q = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");
  const det = (q.get("det") ?? "").toUpperCase();
  return {
    ra: num(q.get("ra"), 0, 359.9999999), dec: num(q.get("dec"), -90, 90), fov: num(q.get("fov"), 1, 30),
    det: /^D[1-6]$/.test(det) ? det : null,
    seq: /^[a-z0-9][a-z0-9-]{0,63}$/.test(q.get("seq") ?? "") ? q.get("seq") : null,
    api: q.get("api") || null,
    view: VIEWS.includes(q.get("view")) ? q.get("view") : null,
    lang: ["en", "ro"].includes(q.get("lang")) ? q.get("lang") : null,
    step: num(q.get("step"), 1, 99),
    theme: ["night", "paper"].includes(q.get("theme")) ? q.get("theme") : null,
  };
}

/** The query string that carries the deep-link parameters to the other page (and `extra` on top). Empty values are left out. */
export function keepQuery(search, extra = {}) {
  const from = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? ""), out = new URLSearchParams();
  for (const k of KEPT_PARAMS) if (from.get(k)) out.set(k, from.get(k));
  for (const [k, v] of Object.entries(extra)) if (v === null || v === undefined || v === "") out.delete(k); else out.set(k, String(v));
  const s = out.toString();
  return s ? "?" + s : "";
}

/** Angular offsets (arcmin) of a point from a field centre: small-field formula, enough to say "inside this field or not". */
function offsetArcmin(ra, dec, centre) {
  let dRa = ra - centre.raDeg; if (dRa > 180) dRa -= 360; else if (dRa < -180) dRa += 360;
  return { east: dRa * 60 * Math.cos(centre.decDeg * Math.PI / 180), north: (dec - centre.decDeg) * 60 };
}

/**
 * Which sequence do the deep-link parameters ask for? summaries: SequenceSummary[].
 * Returns { sequenceId, why } where why is "seq" | "position" | "default", or { sequenceId: null, problem } when a seq id or a position
 * was asked for and no sequence matches (the view then says so; it does not quietly show another field).
 */
export function pickSequence(summaries, { seq = null, ra = null, dec = null, det = null } = {}) {
  if (!summaries.length) return { sequenceId: null, problem: "This backend has no sequence to show." };
  if (seq) return summaries.some((s) => s.sequenceId === seq) ? { sequenceId: seq, why: "seq" } : { sequenceId: null, problem: `There is no sequence "${seq}" here.` };
  if (ra !== null && dec !== null) {
    const hits = summaries.filter((s) => { const o = offsetArcmin(ra, dec, s.center); return Math.abs(o.east) <= s.fovArcmin / 2 && Math.abs(o.north) <= s.fovArcmin / 2 && (!det || s.detector === det); });
    if (!hits.length) return { sequenceId: null, problem: `No sequence here covers RA ${ra}, Dec ${dec}${det ? ` in ${det}` : ""}.` };
    hits.sort((a, b) => { const p = offsetArcmin(ra, dec, a.center), q = offsetArcmin(ra, dec, b.center); return Math.hypot(p.east, p.north) - Math.hypot(q.east, q.north); });
    return { sequenceId: hits[0].sequenceId, why: "position" };
  }
  const first = det ? summaries.find((s) => s.detector === det) : summaries[0];
  return first ? { sequenceId: first.sequenceId, why: "default" } : { sequenceId: null, problem: `No sequence here is in ${det}.` };
}

/** Which page should index.html open? An explicit ?view= wins, then the remembered choice, then the screen width. */
export function chooseView({ view = null, remembered = null, widthPx = 1200 } = {}) {
  if (VIEWS.includes(view)) return view;
  if (VIEWS.includes(remembered)) return remembered;
  return widthPx < 900 ? "learn" : "science";
}

export function rememberView(storage, view) { try { if (VIEWS.includes(view)) storage.setItem(VIEW_KEY, view); } catch { /* private mode: the choice is simply not remembered */ } }
export function rememberedView(storage) { try { const v = storage.getItem(VIEW_KEY); return VIEWS.includes(v) ? v : null; } catch { return null; } }
