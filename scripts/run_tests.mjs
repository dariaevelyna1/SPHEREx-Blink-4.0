// Run every Node test (tests/test_*.mjs), one process each, and print the last line of each.
//
//   node scripts/run_tests.mjs            all the cheap tests, then the prepush check
//   node scripts/run_tests.mjs movers     only the test files whose name contains "movers"
//
// Exit code 1 if a test file fails or the prepush check finds a problem. The backend tests are separate:
//   backend/.venv/Scripts/python.exe -m pytest backend -q

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const only = process.argv[2];
const files = readdirSync(resolve(root, "tests")).filter((f) => /^test_.*\.mjs$/.test(f) && (!only || f.includes(only))).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [resolve(root, "tests", f)], { cwd: root, encoding: "utf8" });
  const last = (r.stdout ?? "").trim().split("\n").pop() ?? "";
  const bad = r.status !== 0;
  if (bad) { failed++; console.log((r.stdout ?? "").split("\n").filter((l) => l.startsWith("FAIL")).join("\n")); if (r.stderr) console.log(r.stderr.trim().split("\n").slice(-6).join("\n")); }
  console.log(`${bad ? "FAIL" : "ok  "} ${f.padEnd(28)} ${last}`);
}
if (!only) {
  const r = spawnSync(process.execPath, [resolve(root, "scripts", "prepush_check.mjs")], { cwd: root, encoding: "utf8" });
  if (r.status !== 0) { failed++; console.log(r.stdout.trim()); } else console.log("ok   " + r.stdout.trim().split("\n").pop());
}
console.log(failed ? `\n${failed} FAILED of ${files.length} test files` : `\nall ${files.length} test files passed`);
process.exit(failed ? 1 : 0);
