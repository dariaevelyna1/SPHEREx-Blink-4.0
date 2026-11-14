// The files reused unchanged from 3.0 must stay unchanged: their SHA-256 (with LF line endings) is pinned in frontend/js/core/REUSED.md.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { check, done } from "./_t.mjs";

const root = new URL("../", import.meta.url);
const table = readFileSync(new URL("frontend/js/core/REUSED.md", root), "utf8");
const rows = [...table.matchAll(/\| `(frontend\/js\/core\/[^`]+)` \| `[^`]+` \| `([0-9a-f]{64})` \|/g)];

check("REUSED.md pins three files", rows.length === 3, `found ${rows.length}`);
for (const [, path, sha] of rows) {
  const text = readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");
  check(`${path} is the 3.0 file`, createHash("sha256").update(text).digest("hex") === sha);
}
const credits = readFileSync(new URL("CREDITS.md", root), "utf8");
check("CREDITS.md points to REUSED.md", credits.includes("frontend/js/core/REUSED.md"));
check("CREDITS.md credits the 3.0 contributor by name", credits.includes("Ioonut"));

done();
