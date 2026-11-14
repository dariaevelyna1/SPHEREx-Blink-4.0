// contract.js: the data contract (docs/DATA_CONTRACT.md) as code. Pure: no DOM, no network.
//
// Every document that enters an interface passes through one of these validators first. A validator returns the list of problems
// (empty = valid); the assert* forms throw a ContractError that the interfaces show as a failure. Nothing here repairs a document.

export const CONTRACT_VERSION = "blink-4.0/1";
export const DATA_KINDS = ["synthetic", "real"];
export const PROFILES = ["edu", "full"];
export const DATA_SOURCES = ["STATIC", "LOCAL", "CLOUD"];
export const HEADER_CHECKS = ["synthetic", "spherex_header", "unverified"];

export class ContractError extends Error {
  constructor(what, problems) { super(`${what} does not follow the data contract: ${problems.slice(0, 3).join("; ")}${problems.length > 3 ? ` (and ${problems.length - 3} more)` : ""}`); this.name = "ContractError"; this.problems = problems; }
}

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isStr = (v) => typeof v === "string" && v.length > 0;
const isId = (v) => typeof v === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(v);
const nullOr = (test) => (v) => v === null || test(v);

export function validateFrame(f, at = "frame") {
  const p = [], need = (ok, msg) => { if (!ok) p.push(`${at}: ${msg}`); };
  if (!f || typeof f !== "object") return [`${at}: not an object`];
  need(isId(f.frameId), "frameId missing or not URL-safe");
  need(isNum(f.mjd), "mjd is not a number");
  need(isStr(f.dateISO) && !Number.isNaN(Date.parse(f.dateISO)), "dateISO is not a date");
  need(isStr(f.detector), "detector missing");
  need(isNum(f.wavelengthMinUm) && isNum(f.wavelengthMaxUm) && f.wavelengthMinUm <= f.wavelengthMaxUm, "wavelength band missing or reversed");
  need(isNum(f.pixelScaleArcsec) && f.pixelScaleArcsec > 0, "pixelScaleArcsec missing");
  need(f.unit === null || typeof f.unit === "string", "unit must be a string or null");
  need(DATA_KINDS.includes(f.dataKind), "dataKind must be synthetic or real");
  need(typeof f.pixelsServed === "boolean", "pixelsServed must be true or false");
  need(typeof f.backgroundSubtracted === "boolean", "backgroundSubtracted must be true or false");
  for (const k of ["dataUrl", "maskUrl", "imageUrl", "flagsUrl"]) need(f[k] === null || f[k] === undefined || isStr(f[k]), `${k} must be a string or null`);
  if (f.pixelsServed === true) need(isStr(f.dataUrl), "pixelsServed is true but dataUrl is missing");
  if (f.pixelsServed === false) need(!f.dataUrl && !f.maskUrl && !f.imageUrl, "pixelsServed is false but a pixel URL is present");
  need(typeof f.sha256Pixels === "string" && /^[0-9a-f]{64}$/.test(f.sha256Pixels), "sha256Pixels is not a SHA-256");
  need(f.flags === null || (f.flags && typeof f.flags.anyFlagged === "boolean" && isNum(f.flags.fractionFlagged)), "flags must be { anyFlagged, fractionFlagged } or null");
  const pr = f.provenance;
  if (!pr || typeof pr !== "object") p.push(`${at}: provenance must be an object`);
  else {
    need(HEADER_CHECKS.includes(pr.headerCheck), "provenance.headerCheck unknown");
    need(pr.origin === "generator" || pr.origin === "archive", "provenance.origin must be generator or archive");
    if (f.dataKind === "synthetic") need(pr.origin === "generator" && pr.generator && isStr(pr.generator.name) && isStr(pr.generator.version) && pr.headerCheck === "synthetic", "a synthetic frame needs provenance.generator and headerCheck synthetic");
    if (f.dataKind === "real") need(pr.origin === "archive" && pr.archive && isStr(pr.archive.fileName) && /^[0-9a-f]{64}$/.test(pr.archive.sha256 ?? "") && pr.headerCheck !== "synthetic", "a real frame needs provenance.archive with fileName and the SHA-256 of the original");
  }
  return p;
}

export function validateGrid(g, at = "grid") {
  const p = [], need = (ok, msg) => { if (!ok) p.push(`${at}: ${msg}`); };
  if (!g || typeof g !== "object") return [`${at}: missing`];
  need(g.projection === "TAN", "projection must be TAN");
  need(Number.isInteger(g.n) && g.n >= 8, "n must be an integer of at least 8");
  need(isNum(g.pixelScaleArcsec) && g.pixelScaleArcsec > 0, "pixelScaleArcsec missing");
  need(Array.isArray(g.crvalDeg) && g.crvalDeg.length === 2 && g.crvalDeg.every(isNum), "crvalDeg must be [ra, dec]");
  need(Array.isArray(g.crpix) && g.crpix.length === 2 && g.crpix.every(isNum), "crpix must be two numbers");
  need(Array.isArray(g.cdDeg) && g.cdDeg.length === 2 && g.cdDeg.every((r) => Array.isArray(r) && r.length === 2 && r.every(isNum)), "cdDeg must be a 2 x 2 matrix");
  if (p.length === 0) {
    const s = g.pixelScaleArcsec / 3600;
    need(Math.abs(g.cdDeg[0][0] + s) < 1e-9 && Math.abs(g.cdDeg[1][1] - s) < 1e-9 && g.cdDeg[0][1] === 0 && g.cdDeg[1][0] === 0, "cdDeg is not the north-up, east-left matrix of this pixel scale");
    need(g.crpix[0] === (g.n + 1) / 2 && g.crpix[1] === (g.n + 1) / 2, "crpix is not the centre of the grid");
  }
  return p;
}

function validateHead(s, at) {
  const p = [], need = (ok, msg) => { if (!ok) p.push(`${at}: ${msg}`); };
  need(isId(s.sequenceId), "sequenceId missing or not URL-safe");
  need(isId(s.fieldId), "fieldId missing or not URL-safe");
  need(isStr(s.title), "title missing");
  need(DATA_KINDS.includes(s.dataKind), "dataKind must be synthetic or real");
  need(isStr(s.detector), "detector missing");
  need(s.center && isNum(s.center.raDeg) && isNum(s.center.decDeg) && s.center.raDeg >= 0 && s.center.raDeg < 360 && Math.abs(s.center.decDeg) <= 90, "center must be { raDeg, decDeg } in range");
  need(isNum(s.fovArcmin) && s.fovArcmin > 0, "fovArcmin missing");
  need(typeof s.pixelsServed === "boolean", "pixelsServed must be true or false");
  return p;
}

export function validateSequence(s) {
  if (!s || typeof s !== "object") return ["sequence: not an object"];
  const p = validateHead(s, "sequence");
  if (s.contractVersion !== CONTRACT_VERSION) p.push(`sequence: contractVersion is ${JSON.stringify(s.contractVersion)}, this client speaks ${CONTRACT_VERSION}`);
  p.push(...validateGrid(s.grid, "sequence.grid"));
  if (!Array.isArray(s.frames) || s.frames.length === 0) p.push("sequence: frames missing or empty");
  else {
    const ids = new Set();
    s.frames.forEach((f, i) => {
      p.push(...validateFrame(f, `frames[${i}]`));
      if (ids.has(f?.frameId)) p.push(`frames[${i}]: frameId repeated`);
      ids.add(f?.frameId);
      if (f && f.dataKind !== s.dataKind) p.push(`frames[${i}]: dataKind differs from the sequence (kinds are never mixed)`);
      if (f && f.detector !== s.detector) p.push(`frames[${i}]: detector differs from the sequence`);
      if (i > 0 && f && s.frames[i - 1] && f.mjd < s.frames[i - 1].mjd) p.push(`frames[${i}]: frames are not in time order`);
    });
  }
  const pr = s.processing;
  if (!pr || !Array.isArray(pr.steps) || !isStr(pr.codeVersion) || !isStr(pr.processedAt)) p.push("sequence: processing must have steps, codeVersion and processedAt");
  if (s.dataKind === "real" && s.truth !== undefined) p.push("sequence: a real sequence cannot carry a truth block");
  if (!isStr(s.terms)) p.push("sequence: terms missing");
  return p;
}

export function validateSummary(s, at = "summary") {
  if (!s || typeof s !== "object") return [`${at}: not an object`];
  const p = validateHead(s, at);
  if (!Number.isInteger(s.frameCount) || s.frameCount < 1) p.push(`${at}: frameCount missing`);
  if (!isNum(s.mjdFirst) || !isNum(s.mjdLast)) p.push(`${at}: mjdFirst/mjdLast missing`);
  return p;
}

export function validateSequenceList(d) {
  if (!d || !Array.isArray(d.sequences)) return ["list: sequences missing"];
  const p = d.sequences.flatMap((s, i) => validateSummary(s, `sequences[${i}]`));
  if (!Number.isInteger(d.total)) p.push("list: total missing");
  return p;
}

export function validateHealth(h) {
  if (!h || typeof h !== "object") return ["health: not an object"];
  const p = [];
  if (h.contractVersion !== CONTRACT_VERSION) p.push(`health: contractVersion is ${JSON.stringify(h.contractVersion)}, this client speaks ${CONTRACT_VERSION}`);
  if (!PROFILES.includes(h.profile)) p.push("health: profile must be edu or full");
  if (!DATA_SOURCES.includes(h.dataSource)) p.push("health: dataSource must be STATIC, LOCAL or CLOUD");
  for (const k of ["storeReachable", "realDataEnabled", "servePixels"]) if (typeof h[k] !== "boolean") p.push(`health: ${k} must be true or false`);
  if (!(h.manifestVersion === null || isStr(h.manifestVersion))) p.push("health: manifestVersion must be a string or null");
  if (!(h.problem === null || h.problem === undefined || isStr(h.problem))) p.push("health: problem must be a string or null");
  return p;
}

export function validateCandidateSet(c) {
  if (!c || typeof c !== "object") return ["candidates: not an object"];
  const p = [];
  if (!isId(c.sequenceId)) p.push("candidates: sequenceId missing");
  if (!DATA_KINDS.includes(c.dataKind)) p.push("candidates: dataKind must be synthetic or real");
  if (!isStr(c.algorithm)) p.push("candidates: algorithm (name and version of the detector) missing");
  if (!isStr(c.ranAt)) p.push("candidates: ranAt missing");
  if (!Array.isArray(c.candidates)) p.push("candidates: candidates must be a list");
  else c.candidates.forEach((k, i) => {
    for (const f of ["x", "y", "vx", "vy", "mjdRef", "vErrPx", "falseAlarm", "significance"]) if (!isNum(k[f])) p.push(`candidates[${i}]: ${f} is not a number`);
    if (!isStr(k.candidateId)) p.push(`candidates[${i}]: candidateId missing`);
    if (!Number.isInteger(k.nDet)) p.push(`candidates[${i}]: nDet missing`);
  });
  return p;
}

const asserter = (validate, what) => (doc) => { const problems = validate(doc); if (problems.length) throw new ContractError(what, problems); return doc; };
export const assertSequence = asserter(validateSequence, "The sequence");
export const assertSequenceList = asserter(validateSequenceList, "The list of sequences");
export const assertHealth = asserter(validateHealth, "The health document");
export const assertCandidateSet = asserter(validateCandidateSet, "The candidate list");

/** The list entry of a sequence (docs/DATA_CONTRACT.md section 3). `passes` = the pass index of each frame. */
export function summaryOf(s, passCount) {
  const { frames, truth, processing, ...head } = s;
  return { ...head, frameCount: frames.length, mjdFirst: frames[0].mjd, mjdLast: frames.at(-1).mjd, passCount };
}

/**
 * What the two badges say (both views use this and nothing else).
 * health: a valid Health document, or null with `healthError` (a sentence) when the check failed. sequence: the loaded sequence or null.
 */
export function badgeModel({ health = null, healthError = null, sequence = null } = {}) {
  const kind = sequence ? sequence.dataKind : null;
  const data = kind === "real"
    ? { kind, label: "REAL", detail: sequence.pixelsServed ? "Processed SPHEREx observations." : "Processed SPHEREx observations: derived numbers only, no pixels served." }
    : kind === "synthetic"
      ? { kind, label: "SYNTHETIC", detail: "Made by this project's code. Not an observation." }
      : { kind: null, label: "NO DATA", detail: "No sequence is loaded." };
  let backend;
  if (!health) backend = { ok: false, label: "backend · unreachable", detail: healthError || "The backend did not answer the health check." };
  else {
    const ok = health.storeReachable && !health.problem;
    backend = { ok, label: `${health.profile} · ${health.dataSource} · ${ok ? "ok" : "problem"}`,
      detail: [health.problem, `profile ${health.profile}`, `data source ${health.dataSource}`, `real data ${health.realDataEnabled ? "enabled" : "disabled"}`,
        `pixels ${health.servePixels ? "served" : "not served"}`, health.manifestVersion ? `manifest ${health.manifestVersion}` : null].filter(Boolean).join("; ") };
  }
  return { data, backend };
}
