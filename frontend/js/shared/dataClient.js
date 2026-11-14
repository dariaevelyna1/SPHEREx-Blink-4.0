// dataClient.js: the one way both interfaces get data. Two transports, one contract (docs/DATA_CONTRACT.md):
//
//   static   the edu bundle, files next to the site (data/edu/...): no server, no login, no token
//   api      a backend given with ?api=<url>: the same documents from /api/...
//
// It never falls back from one to the other and never substitutes synthetic data for real data: a failure is thrown as a
// BlinkDataError with a sentence the interface shows. `fetchFn` is injectable, so Node tests run it without a network.

import { assertCandidateSet, assertHealth, assertSequence, assertSequenceList, ContractError } from "./contract.js";

export class BlinkDataError extends Error {
  constructor(kind, message, status = null) { super(message); this.name = "BlinkDataError"; this.kind = kind; this.status = status; }
}

/**
 * The ?api= value -> a base URL, or a problem. Accepted: https://any.host[/path] and http://localhost|127.0.0.1|[::1][:port].
 * Plain http to another host is refused (pixels and an admin token must not travel in clear text).
 */
export function parseApiParam(value) {
  if (value === null || value === undefined || value === "") return { api: null, problem: null };
  let url;
  try { url = new URL(value); } catch { return { api: null, problem: `The backend address "${value}" is not a URL.` }; }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return { api: null, problem: `The backend address must be https (or http on localhost): "${value}".` };
  if (url.username || url.password || url.search || url.hash) return { api: null, problem: "The backend address must not carry a user name, a query or a fragment." };
  return { api: url.origin + url.pathname.replace(/\/+$/, ""), problem: null };
}

/**
 * createClient({ api, staticBase, fetchFn })
 *   api          base URL from parseApiParam, or null for the static bundle
 *   staticBase   absolute URL of the bundle folder (ends with "/"), e.g. new URL("data/edu/", document.baseURI).href
 */
export function createClient({ api = null, staticBase = null, fetchFn = globalThis.fetch } = {}) {
  if (!api && !staticBase) throw new Error("createClient needs an api or a staticBase");
  const mode = api ? "api" : "static";
  const where = api ? `the backend at ${api}` : "the static bundle";
  const url = {
    health: () => (api ? `${api}/api/health` : `${staticBase}health.json`),
    list: () => (api ? `${api}/api/sequences` : `${staticBase}sequences.json`),
    sequence: (id) => (api ? `${api}/api/sequences/${encodeURIComponent(id)}` : `${staticBase}sequences/${encodeURIComponent(id)}/sequence.json`),
    candidates: (id) => (api ? `${api}/api/sequences/${encodeURIComponent(id)}/candidates` : `${staticBase}sequences/${encodeURIComponent(id)}/candidates.json`),
    realExamples: () => (api ? null : `${staticBase}real_examples.json`),
  };

  async function request(target, what) {
    let res;
    try { res = await fetchFn(target, { headers: { Accept: "application/json, application/octet-stream" } }); }
    catch (err) { throw new BlinkDataError("network", `Could not reach ${where} for ${what} (${err?.message ?? "network error"}).`); }
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json())?.detail ?? ""; } catch { /* not JSON */ }
      const kind = res.status === 403 ? "refused" : res.status === 404 ? "not-found" : res.status === 429 ? "rate-limit" : "http";
      throw new BlinkDataError(kind, `${where[0].toUpperCase() + where.slice(1)} answered ${res.status} for ${what}${detail ? `: ${detail}` : "."}`, res.status);
    }
    return res;
  }
  async function json(target, what, assert) {
    const res = await request(target, what);
    let doc;
    try { doc = await res.json(); } catch { throw new BlinkDataError("contract", `${what} from ${where} is not JSON.`); }
    try { return assert ? assert(doc) : doc; }
    catch (err) { if (err instanceof ContractError) throw new BlinkDataError("contract", err.message); throw err; }
  }
  async function bytes(target, what, expected) {
    const buf = await (await request(target, what)).arrayBuffer();
    if (buf.byteLength !== expected) throw new BlinkDataError("contract", `${what} has ${buf.byteLength} bytes, the grid needs ${expected}.`);
    return buf;
  }

  return {
    mode, api,
    health: () => json(url.health(), "the health check", assertHealth),
    listSequences: async () => (await json(url.list(), "the list of sequences", assertSequenceList)).sequences,
    /** A sequence with its frames; relative pixel URLs are made absolute against the document's own URL. */
    async getSequence(id) {
      const target = url.sequence(id), seq = await json(target, `sequence ${id}`, assertSequence);
      const abs = (u) => (u ? new URL(u, target).href : null);
      return { ...seq, frames: seq.frames.map((f) => ({ ...f, dataUrl: abs(f.dataUrl), maskUrl: abs(f.maskUrl), imageUrl: abs(f.imageUrl), flagsUrl: abs(f.flagsUrl) })) };
    },
    /** The float pixels of a frame as a Float32Array of n*n values. Throws kind "pixels-not-served" when the backend hands out numbers only. */
    async getPixels(sequence, frame) {
      if (!frame.pixelsServed || !frame.dataUrl) throw new BlinkDataError("pixels-not-served", `Pixels of ${sequence.sequenceId} are not served by ${where}: derived numbers only.`);
      const n = sequence.grid.n;
      return new Float32Array(await bytes(frame.dataUrl, `the pixels of frame ${frame.frameId}`, 4 * n * n));
    },
    async getMask(sequence, frame) {
      if (!frame.pixelsServed || !frame.maskUrl) return null;
      const n = sequence.grid.n;
      return new Uint8Array(await bytes(frame.maskUrl, `the mask of frame ${frame.frameId}`, n * n));
    },
    getCandidates: (id) => json(url.candidates(id), `the candidates of ${id}`, assertCandidateSet),
    /** REAL results as derived numbers (static bundle only); null with an API backend. */
    getRealExamples: () => (url.realExamples() ? json(url.realExamples(), "the real examples") : Promise.resolve(null)),
  };
}

/** Everything a view needs to show a sequence: the document, its pixels and masks (null when not served), its stored candidates (null if none). */
export async function loadSequence(client, id) {
  const sequence = await client.getSequence(id);
  let arrays = null, masks = null, pixelsProblem = null;
  if (sequence.pixelsServed) {
    arrays = await Promise.all(sequence.frames.map((f) => client.getPixels(sequence, f)));
    masks = await Promise.all(sequence.frames.map((f) => client.getMask(sequence, f)));
  } else pixelsProblem = "This backend serves derived numbers only: no pixels to show.";
  let candidates = null, candidatesProblem = null;
  try { candidates = await client.getCandidates(id); }
  catch (err) { if (err instanceof BlinkDataError && err.kind === "not-found") candidatesProblem = "No stored candidates for this sequence."; else throw err; }
  return { sequence, arrays, masks, pixelsProblem, candidates, candidatesProblem };
}
