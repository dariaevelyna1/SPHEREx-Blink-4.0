// The public-repository gate. Run it before every commit and before the author pushes:
//
//   node scripts/prepush_check.mjs          exit 0 = clean, exit 1 = at least one problem (each printed on its own line)
//
// It looks at every file git would publish (tracked files and untracked files that are not ignored) and fails on:
//   - real-data files (FITS by extension or by content, anything under backend/data/ or /data/);
//   - secret files (.env other than .env.example, key files, service-account JSON) and common key/token patterns in text;
//   - an e-mail address (nobody's address belongs in this repository; the commit trailer lives in git, not in files);
//   - a file above the size cap (a real image would be megabytes; the synthetic bundle files are kilobytes);
//   - an asset (image, font, sound, video, PDF) or a binary data file without an entry in CREDITS.md.
// The rules are a pure function (checkRepo) so that tests/test_prepush.mjs can feed it made-up files.

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MAX_FILE_BYTES = 1_500_000;

const DATA_EXT = /\.(fits|fit|fts)(\.gz)?$/i;
const SECRET_FILE = /(^|\/)(\.env(\.(?!example$)[^/]*)?|[^/]*\.(pem|key|p12|pfx)|[^/]*service[-_]account[^/]*\.json|[^/]*credentials[^/]*\.json)$/i;
const DATA_DIR = /^(backend\/data|data|backend\/\.cache|\.cache)\//;
export const ASSET_EXT = /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp|woff2?|ttf|otf|eot|mp3|wav|ogg|flac|mp4|webm|mov|pdf)$/i;
const BINARY_DATA_EXT = /\.(f32|u8|bin|npy|npz)$/i;
const TEXT_EXT = /\.(md|txt|js|mjs|cjs|json|html|css|py|toml|yml|yaml|cfg|ini|example|sh|ps1|svg|csv|gitignore|dockerignore)$|(^|\/)(Dockerfile|LICENSE|\.gitignore|\.dockerignore|\.env\.example)$/i;

// Common key and token shapes. Each is written so that this file does not match itself.
export const SECRET_PATTERNS = [
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
  ["Google OAuth token", /ya29\.[0-9A-Za-z_-]{20,}/],
  ["service-account private key field", /"private_key"\s*:\s*"/],
  ["service-account type field", /"type"\s*:\s*"service_account"/],
  ["GitHub token", /gh[pousr]_[A-Za-z0-9]{36,}/],
  ["GitHub fine-grained token", /github_pat_[A-Za-z0-9_]{40,}/],
  ["Anthropic key", /sk-ant-[A-Za-z0-9_-]{20,}/],
  ["OpenAI-style key", /sk-[A-Za-z0-9]{40,}/],
  ["AWS access key id", /AKIA[0-9A-Z]{16}/],
  ["Slack token", /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ["bearer token literal", /Bearer\s+[A-Za-z0-9._-]{32,}/],
  ["assigned secret", /(ADMIN_TOKEN|API_KEY|SECRET|PASSWORD)\s*[=:]\s*["']?[A-Za-z0-9+/_-]{16,}/i],
];
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const EMAIL_ALLOWED = /^noreply@anthropic\.com$|@(example\.(com|org|net)|[a-z0-9-]+\.iam\.gserviceaccount\.com)$/i;   // the commit trailer's no-reply address and documentation placeholders only

/**
 * files: [{ path (forward slashes, repo-relative), size, text (string or null for binary), head (first bytes as latin1) }]
 * credits: the text of CREDITS.md.   Returns a list of problem strings (empty = clean).
 */
export function checkRepo(files, credits = "") {
  const problems = [];
  for (const f of files) {
    const p = f.path;
    if (DATA_EXT.test(p)) problems.push(`${p}: a FITS file (real data is never committed)`);
    if (DATA_DIR.test(p)) problems.push(`${p}: inside a data or cache folder that must stay git-ignored`);
    if (SECRET_FILE.test(p)) problems.push(`${p}: looks like a secret file (only .env.example may be committed)`);
    if ((f.head ?? "").startsWith("SIMPLE  =")) problems.push(`${p}: has a FITS header (real data is never committed)`);
    if (f.size > MAX_FILE_BYTES) problems.push(`${p}: ${f.size} bytes, above the cap of ${MAX_FILE_BYTES}`);
    if (ASSET_EXT.test(p) && !creditsMention(credits, p)) problems.push(`${p}: an asset with no entry in CREDITS.md`);
    if (BINARY_DATA_EXT.test(p) && !creditsMention(credits, p)) problems.push(`${p}: a binary data file with no entry in CREDITS.md (only synthetic or derived fixtures may be committed, each listed)`);
    if (f.text != null) {
      for (const [name, re] of SECRET_PATTERNS) if (re.test(f.text)) problems.push(`${p}: contains what looks like a secret (${name})`);
      for (const m of f.text.match(EMAIL) ?? []) if (!EMAIL_ALLOWED.test(m)) problems.push(`${p}: contains an e-mail address`);
    }
  }
  return [...new Set(problems)];
}

/** An asset is credited when CREDITS.md names its path, or a folder that contains it written with a trailing slash. */
export function creditsMention(credits, path) {
  if (credits.includes(path)) return true;
  const parts = path.split("/");
  for (let i = parts.length - 1; i > 0; i--) if (credits.includes("`" + parts.slice(0, i).join("/") + "/`")) return true;
  return false;
}

export function listPublishedFiles(root) {
  const out = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64e6 });
  return out.split("\0").filter(Boolean);
}

export function loadFiles(root, paths) {
  return paths.flatMap((path) => {
    let size; try { size = statSync(resolve(root, path)).size; } catch { return []; }          // deleted but still in the index
    const buf = size <= MAX_FILE_BYTES ? readFileSync(resolve(root, path)) : Buffer.alloc(0);
    return [{ path, size, head: buf.subarray(0, 16).toString("latin1"), text: TEXT_EXT.test(path) ? buf.toString("utf8") : null }];
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const paths = listPublishedFiles(root);
  let credits = ""; try { credits = readFileSync(resolve(root, "CREDITS.md"), "utf8"); } catch { /* reported below */ }
  const problems = checkRepo(loadFiles(root, paths), credits);
  if (!credits) problems.push("CREDITS.md is missing");
  for (const p of problems) console.log("PROBLEM " + p);
  console.log(problems.length ? `prepush check: FAIL (${problems.length} problem(s) in ${paths.length} files)` : `prepush check: PASS (${paths.length} files)`);
  process.exit(problems.length ? 1 : 0);
}
