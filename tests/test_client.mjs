// The data client: reads the static bundle from disk through an injected fetch, maps API routes, refuses bad addresses,
// and turns every failure into an error with a sentence. It never falls back to another source.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { check, done } from "./_t.mjs";
import { BlinkDataError, createClient, loadSequence, parseApiParam } from "../frontend/js/shared/dataClient.js";
import { chooseView, keepQuery, parseQuery, pickSequence, rememberView, rememberedView } from "../frontend/js/shared/urlState.js";

const STATIC = new URL("../frontend/data/edu/", import.meta.url).href;
const calls = [];
const response = (status, body, isJson) => ({ ok: status >= 200 && status < 300, status,
  json: async () => { if (!isJson) throw new Error("not json"); return JSON.parse(Buffer.from(body).toString("utf8")); },
  arrayBuffer: async () => { const b = Buffer.from(body); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } });
const diskFetch = async (url) => { calls.push(url); const path = fileURLToPath(url); return existsSync(path) ? response(200, readFileSync(path), path.endsWith(".json")) : response(404, '{"detail":"no such file"}', true); };
const caught = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };

// ---- static bundle
const client = createClient({ staticBase: STATIC, fetchFn: diskFetch });
const health = await client.health();
check("static: health says edu, STATIC, pixels served, real data off", health.profile === "edu" && health.dataSource === "STATIC" && health.servePixels && !health.realDataEnabled);
const list = await client.listSequences();
check("static: three synthetic sequences are listed", list.length === 3 && list.every((s) => s.dataKind === "synthetic"));
const loaded = await loadSequence(client, list[0].sequenceId);
check("static: a sequence loads with 12 float images of 49 x 49", loaded.arrays.length === 12 && loaded.arrays[0] instanceof Float32Array && loaded.arrays[0].length === 2401);
check("static: pixel URLs were made absolute", loaded.sequence.frames[0].dataUrl.startsWith("file:") && loaded.sequence.frames[0].dataUrl.endsWith("/frames/f000.f32"));
check("static: masks load, all zero", loaded.masks[0] instanceof Uint8Array && loaded.masks[0].every((v) => v === 0));
check("static: stored candidates load with their algorithm", loaded.candidates.algorithm === "movers-2" && loaded.candidates.candidates.length === 1);
const real = await client.getRealExamples();
check("static: real examples are numbers only, labelled real", real.dataKind === "real" && real.pixels === false && real.examples.length === 4 && !JSON.stringify(real).includes(".f32"));
const missing = await caught(() => client.getSequence("nope"));
check("static: an unknown sequence is a not-found error with a sentence", missing instanceof BlinkDataError && missing.kind === "not-found" && missing.message.includes("404"));

// ---- failures are shown, never replaced
const dead = createClient({ api: "https://backend.example.org", fetchFn: async () => { throw new TypeError("fetch failed"); } });
const net = await caught(() => dead.health());
check("api: an unreachable backend is a network error naming the backend", net instanceof BlinkDataError && net.kind === "network" && net.message.includes("backend.example.org"));
const before = calls.length; await caught(() => loadSequence(dead, "syn-a-d2"));
check("api: after a failure the client does not read the static bundle instead", calls.length === before);
const garbage = createClient({ api: "https://backend.example.org", fetchFn: async () => response(200, '{"profile":"edu"}', true) });
check("api: a document that breaks the contract is refused", (await caught(() => garbage.health()))?.kind === "contract");
const limited = createClient({ api: "https://backend.example.org", fetchFn: async () => response(429, '{"detail":"Too many requests."}', true) });
const rate = await caught(() => limited.listSequences());
check("api: a 429 is a rate-limit error carrying the server's sentence", rate?.kind === "rate-limit" && rate.message.includes("Too many requests"));

// ---- api routes, and numbers-only sequences
const seen = [];
const seqDoc = JSON.parse(readFileSync(new URL("sequences/syn-a-d2/sequence.json", STATIC), "utf8"));
const numbersOnly = { ...seqDoc, pixelsServed: false, frames: seqDoc.frames.map((f) => ({ ...f, pixelsServed: false, dataUrl: null, maskUrl: null })) };
const api = createClient({ api: "http://localhost:8010", fetchFn: async (url) => { seen.push(url); return url.endsWith("/candidates") ? response(404, '{"detail":"none"}', true) : response(200, JSON.stringify(numbersOnly), true); } });
const viaApi = await loadSequence(api, "syn-a-d2");
check("api: routes are /api/sequences/{id} and /candidates", seen[0] === "http://localhost:8010/api/sequences/syn-a-d2" && seen[1] === "http://localhost:8010/api/sequences/syn-a-d2/candidates");
check("api: a numbers-only sequence loads without pixels and says why", viaApi.arrays === null && viaApi.pixelsProblem.includes("derived numbers only") && viaApi.candidatesProblem.includes("No stored candidates"));
check("api: asking for pixels that are not served is its own error", (await caught(() => api.getPixels(viaApi.sequence, viaApi.sequence.frames[0])))?.kind === "pixels-not-served");
const short = createClient({ staticBase: STATIC, fetchFn: async (url) => (url.endsWith(".f32") ? response(200, Buffer.alloc(100), false) : diskFetch(url)) });
check("pixels of the wrong length are refused", (await caught(() => loadSequence(short, "syn-a-d2")))?.kind === "contract");

// ---- the ?api= parameter
check("?api= https is accepted, trailing slash removed", parseApiParam("https://blink.example.org/").api === "https://blink.example.org");
check("?api= http on localhost is accepted", parseApiParam("http://localhost:8010").api === "http://localhost:8010");
check("?api= http on another host is refused", parseApiParam("http://blink.example.org").api === null && parseApiParam("http://blink.example.org").problem.includes("https"));
check("?api= with a query (a place for a token) is refused", parseApiParam("https://blink.example.org/?key=1").api === null);
check("?api= with a user name is refused", parseApiParam("https://user:pw@example.org").api === null);
check("?api= javascript: is refused", parseApiParam("javascript:alert(1)").api === null);
check("no ?api= means the static bundle", parseApiParam(null).api === null && parseApiParam("").problem === null);

// ---- deep links and the remembered view
const q = parseQuery("?ra=136.5&dec=16.6&fov=5&det=d2&api=https://x.example.org&view=learn&step=4&junk=1");
check("the query is parsed and cleaned", q.ra === 136.5 && q.dec === 16.6 && q.fov === 5 && q.det === "D2" && q.view === "learn" && q.step === 4);
check("values out of range become null", parseQuery("?ra=400&dec=abc&det=D9&view=other&seq=../x").ra === null && parseQuery("?dec=abc").dec === null && parseQuery("?det=D9").det === null && parseQuery("?view=x").view === null && parseQuery("?seq=../x").seq === null);
check("the kept query carries ra, dec, fov, det, api and drops the rest", keepQuery("?ra=1&dec=2&fov=5&det=D2&api=https://x.example.org&step=3&junk=1") === "?ra=1&dec=2&fov=5&det=D2&api=https%3A%2F%2Fx.example.org");
check("extra parameters are added and empty ones dropped", keepQuery("?ra=1", { view: "learn", dec: null }) === "?ra=1&view=learn" && keepQuery("") === "");
check("a sequence is picked by id", pickSequence(list, { seq: "syn-c-d4" }).sequenceId === "syn-c-d4");
check("an unknown id is a problem, not another field", pickSequence(list, { seq: "nope" }).sequenceId === null && pickSequence(list, { seq: "nope" }).problem.includes("nope"));
check("a sequence is picked by position", pickSequence(list, { ra: 201.31, dec: -11.21 }).sequenceId === "syn-b-d2" && pickSequence(list, { ra: 201.31, dec: -11.21 }).why === "position");
check("a position outside every field is a problem", pickSequence(list, { ra: 10, dec: 10 }).sequenceId === null);
check("a position in the wrong detector is a problem", pickSequence(list, { ra: 136.5, dec: 16.6, det: "D6" }).sequenceId === null);
check("no parameters pick the first sequence", pickSequence(list, {}).why === "default" && pickSequence(list, {}).sequenceId === list[0].sequenceId);
check("an empty backend is a problem", pickSequence([], {}).problem.includes("no sequence"));
check("?view= wins over the remembered view", chooseView({ view: "learn", remembered: "science", widthPx: 1600 }) === "learn");
check("the remembered view wins over the screen", chooseView({ remembered: "science", widthPx: 400 }) === "science");
check("a narrow screen opens Learn, a wide one Science", chooseView({ widthPx: 400 }) === "learn" && chooseView({ widthPx: 1400 }) === "science");
const store = new Map(), storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
rememberView(storage, "learn");
check("the view is remembered", rememberedView(storage) === "learn");
const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
rememberView(throwing, "learn");
check("blocked storage does not throw", rememberedView(throwing) === null);

done();
