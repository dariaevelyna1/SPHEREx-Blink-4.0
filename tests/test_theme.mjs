// Colours only through tokens (defined once, in css/tokens.css) and enough contrast in every theme we ship (night, paper).
// Idea taken from SPHEREx Blink 3.0 scratch/test_theme.mjs; written fresh for 4.0's tokens.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { check, done } from "./_t.mjs";

const front = fileURLToPath(new URL("../frontend/", import.meta.url));
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? (f === "data" ? [] : walk(p)) : [p]; });
const files = walk(front).filter((p) => /\.(css|html|js)$/.test(p) && !p.endsWith("tokens.css"));
const COLOUR = /#[0-9a-fA-F]{3,8}\b(?![-\w])|\brgba?\(|\bhsla?\(/;
const offenders = files.filter((p) => readFileSync(p, "utf8").split("\n").some((line) => !/^\s*(\/\/|\*|\/\*)/.test(line) && COLOUR.test(line.replace(/&#\d+;|href="#[^"]*"|"#[a-z][\w-]*"/g, ""))));
check("no colour literal outside tokens.css", offenders.length === 0, offenders.map((p) => p.slice(front.length)).join(", "));

// parse the tokens per theme
const css = readFileSync(join(front, "css/tokens.css"), "utf8");
const block = (sel) => { const i = css.indexOf(sel); const b = css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i)); return Object.fromEntries([...b.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]])); };
const shared = block(":root {\n  /* the sky");
const themes = { night: { ...shared, ...block(':root[data-theme="night"]') }, paper: { ...shared, ...block(':root[data-theme="paper"]') } };

const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const TEXT = 4.5, NONTEXT = 3;
const PAIRS = [
  ["--text", "--bg", TEXT], ["--text", "--surface", TEXT], ["--text", "--surface-2", TEXT],
  ["--text-muted", "--bg", TEXT], ["--text-muted", "--surface", TEXT], ["--text-muted", "--surface-2", TEXT],
  ["--link", "--bg", TEXT], ["--link", "--surface", TEXT],
  ["--accent-ink", "--accent", TEXT], ["--ok-ink", "--ok", TEXT], ["--warn-ink", "--warn", TEXT], ["--danger-ink", "--danger", TEXT],
  ["--accent", "--surface", NONTEXT], ["--ok", "--surface", NONTEXT], ["--danger", "--surface", NONTEXT], ["--focus", "--bg", NONTEXT],
  ["--sky-ink", "--sky-ground", TEXT], ["--mark-candidate", "--sky-ground", NONTEXT], ["--mark-truth", "--sky-ground", NONTEXT], ["--mark-guess", "--sky-ground", NONTEXT],
  ["--warn-ink", "--warn", TEXT],
];
for (const [name, t] of Object.entries(themes)) for (const [fg, bg, need] of PAIRS) {
  if (!t[fg] || !t[bg]) { check(`${name}: ${fg} and ${bg} defined`, false); continue; }
  const r = ratio(t[fg], t[bg]);
  check(`${name}: ${fg} on ${bg} >= ${need}`, r >= need, r.toFixed(2));
}
check("the sky ground is the same in both themes", themes.night["--sky-ground"] === themes.paper["--sky-ground"]);
check("SYNTHETIC (warn) and REAL (ok) badge colours differ in both themes", themes.night["--warn"] !== themes.night["--ok"] && themes.paper["--warn"] !== themes.paper["--ok"]);

done();
