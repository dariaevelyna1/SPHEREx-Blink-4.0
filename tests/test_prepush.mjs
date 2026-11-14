// The public-repository gate must catch what it promises to catch (scripts/prepush_check.mjs). Made-up files only.
// The sample secrets are assembled at run time so that this file does not contain one.

import { check, done } from "./_t.mjs";
import { checkRepo, creditsMention, MAX_FILE_BYTES } from "../scripts/prepush_check.mjs";

const file = (path, text = "", extra = {}) => ({ path, size: (text ?? "").length, text, head: (text ?? "").slice(0, 16), ...extra });
const bad = (f, credits = "") => checkRepo([f], credits).length > 0;
const j = (...parts) => parts.join("");

check("a clean text file passes", !bad(file("docs/NOTE.md", "Nothing to see. GCS_BUCKET= is empty.")));
check("a FITS file by extension fails", bad(file("x/level2_0073.fits", null, { text: null })));
check("a gzipped FITS file fails", bad(file("x/a.fits.gz", null, { text: null })));
check("a FITS file by content fails", bad({ path: "x/renamed.dat", size: 2880, text: null, head: "SIMPLE  =       T" }));
check("backend/data/ fails", bad(file("backend/data/store/manifest.json", "{}")));
check("a cache folder fails", bad(file("backend/.cache/a.bin", null, { text: null })));
check(".env fails", bad(file(".env", "X=1")));
check(".env.local fails", bad(file("backend/.env.local", "X=1")));
check(".env.example passes", !bad(file(".env.example", "ADMIN_TOKEN=\nGCS_BUCKET=\n")));
check("a service-account file name fails", bad(file("keys/my-service-account.json", "{}")));
check("a .pem file fails", bad(file("a/server.pem", "x")));
check("a private key block fails", bad(file("a.txt", j("-----BEGIN RSA ", "PRIVATE KEY-----\nabc"))));
check("a Google API key fails", bad(file("a.js", j("const k = 'AI", "za", "B".repeat(35), "';"))));
check("a GitHub token fails", bad(file("a.md", j("gh", "p_", "a1B2".repeat(9)))));
check("a service-account JSON body fails", bad(file("conf.json", j('{"type": "service', '_account", "private', '_key": "x"}'))));
check("an Anthropic-style key fails", bad(file("a.py", j("sk-", "ant-", "abc123".repeat(5)))));
check("an AWS key id fails", bad(file("a.txt", j("AK", "IA", "ABCDEFGHIJKLMNOP"))));
check("an assigned admin token fails", bad(file("run.sh", j("ADMIN_", "TOKEN=", "q9".repeat(12)))));
check("an empty admin token passes", !bad(file("run.sh", "ADMIN_TOKEN=\n")));
check("an e-mail address fails", bad(file("CREDITS.md", j("write to someone", "@", "gmail.com"))));
check("a placeholder address passes", !bad(file("docs/DEPLOY.md", j("reader", "@", "example.com"))));
check("a file above the size cap fails", bad({ path: "big.json", size: MAX_FILE_BYTES + 1, text: "", head: "" }));
check("an image without a credit fails", bad(file("frontend/img/logo.png", null, { text: null }), "nothing here"));
check("an image credited by path passes", !bad(file("frontend/img/logo.png", null, { text: null }), "| `frontend/img/logo.png` | ours |"));
check("an image credited by folder passes", !bad(file("frontend/img/a/logo.svg", "<svg/>"), "everything in `frontend/img/` is ours"));
check("a float file without a credit fails", bad(file("frontend/data/edu/f0.f32", null, { text: null }), ""));
check("a float file in a credited folder passes", !bad(file("frontend/data/edu/s/f0.f32", null, { text: null }), "`frontend/data/edu/` synthetic"));
check("a folder is credited only with its trailing slash in backticks", !creditsMention("see frontend/img for details", "frontend/img/x.png"));
check("several problems are all reported", checkRepo([file(".env", j("AK", "IA", "ABCDEFGHIJKLMNOP"))]).length >= 2);

done();
