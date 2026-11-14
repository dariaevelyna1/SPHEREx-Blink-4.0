// The contract validators accept what the contract describes and refuse what it forbids; the badge model says what the data says.

import { check, done } from "./_t.mjs";
import { FIELD_SPECS, buildSequence, staticHealth, summarise } from "../frontend/js/shared/synthField.js";
import { CONTRACT_VERSION, ContractError, assertSequence, badgeModel, validateFrame, validateGrid, validateHealth, validateSequence, validateSequenceList } from "../frontend/js/shared/contract.js";

const { sequence } = await buildSequence(FIELD_SPECS[0]);
const clone = (v) => JSON.parse(JSON.stringify(v));
const broken = (edit) => { const s = clone(sequence); edit(s); return validateSequence(s); };

check("a generated sequence is valid", validateSequence(sequence).length === 0);
check("a sequence survives JSON", validateSequence(clone(sequence)).length === 0);
check("another contract version is refused", broken((s) => { s.contractVersion = "blink-9/9"; }).length > 0);
check("a missing dataKind is refused", broken((s) => { delete s.dataKind; }).length > 0);
check("mixed kinds in one sequence are refused", broken((s) => { s.frames[2].dataKind = "real"; }).some((p) => p.includes("never mixed") || p.includes("real frame")));
check("frames out of time order are refused", broken((s) => { s.frames[1].mjd = s.frames[0].mjd - 1; }).some((p) => p.includes("time order")));
check("a repeated frameId is refused", broken((s) => { s.frames[1].frameId = s.frames[0].frameId; }).some((p) => p.includes("repeated")));
check("a 3.0-style provenance string is refused (it must be an object)", broken((s) => { s.frames[0].provenance = "synthetic"; }).some((p) => p.includes("provenance")));
check("a synthetic frame without a generator is refused", broken((s) => { s.frames[0].provenance.generator = null; }).length > 0);
check("pixelsServed false with a dataUrl is refused", broken((s) => { s.frames[0].pixelsServed = false; }).some((p) => p.includes("pixel URL")));
check("pixelsServed true without a dataUrl is refused", broken((s) => { s.frames[0].dataUrl = null; }).some((p) => p.includes("dataUrl")));
check("a bad sha256Pixels is refused", broken((s) => { s.frames[0].sha256Pixels = "abc"; }).length > 0);
check("a rotated grid is refused", broken((s) => { s.grid.cdDeg[0][1] = 1e-4; }).some((p) => p.includes("north-up")));
check("an off-centre crpix is refused", broken((s) => { s.grid.crpix = [1, 1]; }).some((p) => p.includes("crpix")));
check("a real sequence with a truth block is refused", broken((s) => { s.dataKind = "real"; }).some((p) => p.includes("truth")));
check("missing processing is refused", broken((s) => { delete s.processing; }).some((p) => p.includes("processing")));
let threw = null; try { assertSequence({}); } catch (e) { threw = e; }
check("assertSequence throws a ContractError with the problems", threw instanceof ContractError && threw.problems.length > 0);

// a real frame, as the full profile would serve it with pixels off
const real = { ...clone(sequence.frames[0]), dataKind: "real", pixelsServed: false, dataUrl: null, maskUrl: null, unit: "MJy / sr", timeKeyword: "MJD-OBS", wavelengthSource: "WCS-WAVE",
  provenance: { headerCheck: "spherex_header", origin: "archive", generator: null, archive: { sourceUrl: "https://archive.example.org/x.fits", fileName: "x.fits", obsId: "X", sha256: "a".repeat(64), sizeBytes: 10, retrievedAt: "2026-11-14T00:00:00Z" } } };
check("a real frame with numbers only is valid", validateFrame(real).length === 0, validateFrame(real).join("; "));
check("a real frame without the SHA-256 of its original is refused", validateFrame({ ...real, provenance: { ...real.provenance, archive: { ...real.provenance.archive, sha256: "" } } }).length > 0);
check("a real frame that says headerCheck synthetic is refused", validateFrame({ ...real, provenance: { ...real.provenance, headerCheck: "synthetic" } }).length > 0);
check("the grid validator accepts the sequence grid", validateGrid(sequence.grid).length === 0);

const health = staticHealth(3);
check("the static health document is valid", validateHealth(health).length === 0 && health.contractVersion === CONTRACT_VERSION);
check("a health document with an unknown data source is refused", validateHealth({ ...health, dataSource: "DISK" }).length > 0);
check("the list document is valid", validateSequenceList({ sequences: [summarise(sequence)], total: 1, limit: 1, offset: 0 }).length === 0);

const b = badgeModel({ health, sequence });
check("badge: a synthetic sequence says SYNTHETIC", b.data.label === "SYNTHETIC" && b.data.detail.includes("Not an observation"));
check("badge: the backend line is profile, data source, status", b.backend.label === "edu · STATIC · ok" && b.backend.ok);
check("badge: a real sequence without pixels says REAL and numbers only", badgeModel({ health, sequence: { dataKind: "real", pixelsServed: false } }).data.detail.includes("derived numbers only"));
check("badge: no sequence says NO DATA, never a kind", badgeModel({ health }).data.label === "NO DATA" && badgeModel({ health }).data.kind === null);
const down = badgeModel({ health: null, healthError: "Could not reach the backend." });
check("badge: a failed health check is shown as a failure", !down.backend.ok && down.backend.label.includes("unreachable") && down.backend.detail.includes("Could not reach"));
check("badge: a store problem is shown", badgeModel({ health: { ...health, profile: "full", dataSource: "CLOUD", storeReachable: false, problem: "The store cannot be read." } }).backend.label === "full · CLOUD · problem");

done();
