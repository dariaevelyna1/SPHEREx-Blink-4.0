// Deployment smoke test: run by the AUTHOR against a deployed backend (Cloud Run URL) or a local one. Read-only: GET requests and one
// burst of GET /api/health to see the rate limit answer. No token, no key: it checks exactly what the public can do.
//
//   node scripts/smoke_test_full.mjs https://<service>.run.app --sequence <approved id> --origin https://<site origin>
//   options: --skip-rate-limit   (the burst uses up to 400 requests of this client's minute)
//            --expect-profile full|edu (default full)
//
// Checks: health (contract, profile, store reachable, no problem, flags off unless stated); the list is paginated and capped; the approved
// sequence is served with numbers; NO PIXEL is served by default (no data URLs, the data route answers 403); unknown ids are 404 with no
// detail; CORS answers only the allowed origin; the rate limit answers 429. Exit code 1 if a check fails.

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--") && /^https?:\/\//.test(a)) ?? "").replace(/\/+$/, "");
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
if (!base) { console.error("usage: node scripts/smoke_test_full.mjs <backend URL> [--sequence id] [--origin url] [--skip-rate-limit]"); process.exit(2); }
const sequenceId = opt("--sequence"), origin = opt("--origin"), expectProfile = opt("--expect-profile") ?? "full";

let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? "  -> " + detail : ""}`); if (!ok) failed++; };
const get = async (path, headers = {}) => { const r = await fetch(base + path, { headers }); let body = null; try { body = await r.clone().json(); } catch { /* binary */ } return { r, body }; };

let hr, h;
try { ({ r: hr, body: h } = await get("/api/health")); }
catch (err) { console.log(`FAIL the backend at ${base} cannot be reached: ${err.cause?.code ?? err.message}`); process.exit(1); }
check("health answers 200", hr.status === 200, String(hr.status));
check("health speaks the 4.0 contract", h?.contractVersion === "blink-4.0/1", h?.contractVersion);
check(`profile is ${expectProfile}`, h?.profile === expectProfile, h?.profile);
check("store reachable, no problem", h?.storeReachable === true && h?.problem === null, h?.problem ?? "");
check("data source stated", ["LOCAL", "CLOUD"].includes(h?.dataSource), h?.dataSource);
console.log(`     health: ${JSON.stringify({ profile: h?.profile, dataSource: h?.dataSource, realDataEnabled: h?.realDataEnabled, servePixels: h?.servePixels, sequenceCount: h?.sequenceCount })}`);
if (expectProfile === "full") check("pixels are not served by default (SERVE_PIXELS=false)", h?.servePixels === false, String(h?.servePixels));
check("no store path or bucket name in health", !/gs:\/\/|\/srv\/|bucket/i.test(JSON.stringify(h ?? {})));

const { body: list } = await get("/api/sequences?limit=10000");
check("list is capped by the server", list && list.limit <= 500 && Array.isArray(list.sequences) && list.sequences.length <= list.limit, JSON.stringify(list?.limit));

if (sequenceId) {
  const { r, body: s } = await get(`/api/sequences/${encodeURIComponent(sequenceId)}`);
  check(`approved sequence ${sequenceId} is served`, r.status === 200 && s?.sequenceId === sequenceId, String(r.status));
  if (s?.frames) {
    check("it says REAL or SYNTHETIC", ["real", "synthetic"].includes(s.dataKind), s.dataKind);
    check("every frame carries numbers and provenance", s.frames.every((f) => /^[0-9a-f]{64}$/.test(f.sha256Pixels) && f.provenance && Number.isFinite(f.mjd)));
    if (h?.servePixels === false) {
      check("no pixel URL in the document", s.frames.every((f) => !f.dataUrl && !f.maskUrl && !f.imageUrl));
      const { r: px } = await get(`/api/sequences/${encodeURIComponent(sequenceId)}/frames/${s.frames[0].frameId}/data`);
      check("the pixel route refuses (403)", px.status === 403, String(px.status));
    }
    const { r: cr } = await get(`/api/sequences/${encodeURIComponent(sequenceId)}/candidates`);
    check("candidates answer 200 or a plain 404", cr.status === 200 || cr.status === 404, String(cr.status));
  }
} else console.log("SKIP approved-sequence checks (no --sequence given)");

const { r: nf, body: nfb } = await get("/api/sequences/no-such-sequence-0");
check("unknown sequence is a 404 that reveals nothing", nf.status === 404 && nfb?.detail === "No such sequence here.", JSON.stringify(nfb));
const { r: bad } = await get("/api/sequences/..%2f..%2fetc");
check("a path-like id is refused", [400, 404].includes(bad.status), String(bad.status));

if (origin) {
  const { r: ok } = await get("/api/health", { Origin: origin });
  check(`CORS allows ${origin}`, ok.headers.get("access-control-allow-origin") === origin, ok.headers.get("access-control-allow-origin"));
}
const { r: evil } = await get("/api/health", { Origin: "https://not-allowed.example.com" });
check("CORS does not allow an unknown origin", evil.headers.get("access-control-allow-origin") !== "https://not-allowed.example.com" && evil.headers.get("access-control-allow-origin") !== "*");

if (!args.includes("--skip-rate-limit")) {
  let limited = false, sent = 0;
  for (let batch = 0; batch < 20 && !limited; batch++) {
    const rs = await Promise.all(Array.from({ length: 20 }, () => fetch(base + "/api/health").then((r) => r.status).catch(() => 0)));
    sent += rs.length; limited = rs.includes(429);
  }
  check(`rate limit answers 429 (after ${sent} requests)`, limited);
} else console.log("SKIP rate-limit burst");

console.log(failed ? `\nFAILED: ${failed} check(s)` : "\nall smoke checks passed");
process.exit(failed ? 1 : 0);
