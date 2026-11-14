// The Learn story and game: learn/model.js and learn/strings.js against the static edu bundle.
import { readFileSync } from "node:fs";
import { check, done } from "./_t.mjs";
import { MAX_TRIES, STEPS, checklist, fartherMover, huntGuess, newHunt, pairFrames, progress, stepIndex, warmth } from "../frontend/js/learn/model.js";
import { GLOSSARY_KEYS, LANGS, STRINGS, t } from "../frontend/js/learn/strings.js";

const base = new URL("../frontend/data/edu/sequences/", import.meta.url);
const doc = (id, f) => JSON.parse(readFileSync(new URL(`${id}/${f}`, base)));
const list = JSON.parse(readFileSync(new URL("../frontend/data/edu/sequences.json", import.meta.url))).sequences;

check("eight steps", STEPS.length === 8);
check("explore is the last step (free exploring comes last)", STEPS.at(-1).kind === "explore");
check("every step's field is in the bundle and synthetic", STEPS.filter((s) => s.sequence).every((s) => list.some((x) => x.sequenceId === s.sequence && x.dataKind === "synthetic")));
check("stepIndex: 1-based in, 0-based out, junk -> 0", stepIndex(3) === 2 && stepIndex(99) === 0 && stepIndex(null) === 0);
const pr = progress(2);
check("progress: done, current, todo", pr[0].state === "done" && pr[2].state === "current" && pr[7].state === "todo");

// strings: both languages have every key, every step has title/text, every glossary entry has "term: definition"
const en = Object.keys(STRINGS.en).sort(), ro = Object.keys(STRINGS.ro).sort();
check("EN and RO have the same keys", en.join() === ro.join(), en.filter((k) => !ro.includes(k)).concat(ro.filter((k) => !en.includes(k))).join(", "));
check("every step has a title and a text in both languages", LANGS.every((l) => STEPS.every((s) => STRINGS[l][`${s.id}.title`] && STRINGS[l][`${s.id}.text`])));
check("every step except explore asks a question", STEPS.filter((s) => s.id !== "explore").every((s) => STRINGS.en[`${s.id}.q`]));
check("glossary entries are 'term: definition'", LANGS.every((l) => GLOSSARY_KEYS.every((k) => /^[^:]+: \S/.test(STRINGS[l][k]))));
check("placeholders filled", t("en", "ui.step", { n: 2, total: 8 }) === "Step 2 of 8" && t("ro", "ui.step", { n: 2, total: 8 }) === "Pasul 2 din 8");
check("placeholders identical across languages", en.every((k) => (STRINGS.en[k].match(/\{\w+\}/g) ?? []).sort().join() === (STRINGS.ro[k].match(/\{\w+\}/g) ?? []).sort().join()));
check("the Pluto story is marked unverified in both languages", /\[unverified/.test(STRINGS.en["blink.ok"]) && /\[neverificat/.test(STRINGS.ro["blink.ok"]));
check("SYNTHETIC label in both languages", STRINGS.en["ui.synthetic"] === "SYNTHETIC" && STRINGS.ro["ui.synthetic"] === "SINTETIC");
check("no step text calls a candidate a discovery", LANGS.every((l) => !/(is|e) a discovery\b|este o descoperire/i.test(STRINGS[l]["found.ok"] + STRINGS[l]["planet.ok"])));

// the pair: first image of the first and of the last pass
const A = doc("syn-a-d2", "sequence.json");
const [a, b] = pairFrames(A.frames);
check("pair = first frame and first frame of the last pass", a === 0 && b === 9, `${a}, ${b}`);

// the game, on field C
const C = doc("syn-c-d4", "sequence.json"), mjd = C.frames[0].mjd, yr = (mjd - C.truth.mjdRef) / 365.25;
const m0 = C.truth.movers[0], at0 = { x: m0.x + m0.vxPxPerYr * yr, y: m0.y + m0.vyPxPerYr * yr };
let s = huntGuess(newHunt(), at0, C.truth, mjd);
check("a tap on the mover is a hit with 100 points", s.done && s.score === 100 && s.tries === 1, JSON.stringify(s));
check("no further taps after a hit", huntGuess(s, { x: 0, y: 0 }, C.truth, mjd) === s);
s = newHunt();
s = huntGuess(s, { x: 2, y: 45 }, C.truth, mjd);   // a corner far from both movers
check("a far miss is not done and scores 0", !s.done && s.score === 0 && warmth(s.last.distancePx) === "cold");
s = huntGuess(s, { x: at0.x + 1, y: at0.y }, C.truth, mjd);
check("a hit after a miss scores less than 100", s.done && s.score > 0 && s.score < 100, String(s.score));
s = newHunt(); for (let i = 0; i < MAX_TRIES; i++) s = huntGuess(s, { x: 1, y: 1 }, C.truth, mjd);
check("out of tries after MAX_TRIES misses", s.done && s.score === 0 && s.tries === MAX_TRIES);
check("warmth bands", warmth(3) === "warm" && warmth(10) === "near" && warmth(30) === "cold");

// is it a planet?
const set = doc("syn-c-d4", "candidates.json"), fastest = [...set.candidates].sort((x, y) => y.speedPx - x.speedPx)[0];
const items = checklist(fastest, set);
check("checklist has four items", items.map((i) => i.id).join() === "line,passes,pixel,known");
check("the known-asteroid check is never claimed", items.find((i) => i.id === "known").passed === null);
check("without masks the bad-pixel check is not claimed", items.find((i) => i.id === "pixel").passed === null);
check("field C's fastest candidate is on a line and in 3+ passes", items[0].passed && items[1].passed);
const n = C.grid.n, clean = Array.from({ length: C.frames.length }, () => new Uint8Array(n * n));
check("with clean masks the bad-pixel check passes", checklist(fastest, set, clean).find((i) => i.id === "pixel").passed === true);
const dirty = clean.map((m) => m.slice()); const p = fastest.points[0]; dirty[p.frame][Math.round(p.y) * n + Math.round(p.x)] = 1;
check("a flagged pixel under the track fails the check", checklist(fastest, set, dirty).find((i) => i.id === "pixel").passed === false);

// how far?
const far = fartherMover(C.truth);
check("the farther mover is the slower one (B in field C)", far.index === 1 && far.speeds[1] < far.speeds[0]);

done();
