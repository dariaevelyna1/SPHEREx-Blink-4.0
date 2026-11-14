// Tests for features/missions.js and features/pinBoard.js.   Run: node scratch/test_missions_pins.mjs
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { missionsDatabase, pickRandomMission, missionHref, loadProgress, saveProgress, markComplete, noteShown } from "../frontend/js/features/missions.js";
import { cleanObserver, makePin, verifyPin, pinTag, addPin, removePin, loadPins, savePins, skyToMap, sha256Hex } from "../frontend/js/features/pinBoard.js";

let failed = 0;
const check = (name, ok, d = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${d ? "  – " + d : ""}`); if (!ok) failed++; };
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const html = readFileSync(new URL("../frontend/index.html", import.meta.url), "utf8");

const keys = ["id", "category", "title", "story", "targetType", "objective", "successFeedback"];
check("at least 15 missions, every one with all fields", missionsDatabase.length >= 15 && missionsDatabase.every((m) => keys.every((k) => typeof m[k] === "string" && m[k])));
check("ids unique", new Set(missionsDatabase.map((m) => m.id)).size === missionsDatabase.length);
check("at least 4 categories", new Set(missionsDatabase.map((m) => m.category)).size >= 4);
const hashes = missionsDatabase.filter((m) => m.target.kind === "section").map((m) => m.target.hash);
check("every section a mission points to exists in index.html", hashes.every((h) => html.includes(`id="${h.slice(1)}"`)), hashes.filter((h) => !html.includes(`id="${h.slice(1)}"`)).join(","));
check("random pick uses the rng", pickRandomMission(() => 0).id === missionsDatabase[0].id && pickRandomMission(() => 0.9999).id === missionsDatabase.at(-1).id);
check("random pick avoids recent ones", pickRandomMission(() => 0, [missionsDatabase[0].id]).id === missionsDatabase[1].id);
check("random pick falls back when all avoided", Boolean(pickRandomMission(Math.random, missionsDatabase.map((m) => m.id))));
const seen = new Set(); for (let i = 0; i < 2000; i++) seen.add(pickRandomMission().id);
check("Math.random reaches every mission", seen.size === missionsDatabase.length);
const barn = missionsDatabase.find((m) => m.id === "proper-barnard");
check("mission href keeps the backend", missionHref(barn, "?data=api&api=http://localhost:8003&ra=1") === "index.html?data=api&api=http%3A%2F%2Flocalhost%3A8003&ra=269.4462&dec=4.769&fov=5&det=D2#missions");
const st = mem(); let pr = loadProgress(st);
pr = markComplete(markComplete(pr, "blink-first-look"), "blink-first-look"); pr = noteShown(pr, "px-injection"); saveProgress(st, pr);
check("progress round-trips and counts once", JSON.stringify(loadProgress(st)) === JSON.stringify({ completed: ["blink-first-look"], recent: ["px-injection"] }));
check("broken storage gives empty progress", loadProgress({ getItem: () => "{bad" }).completed.length === 0);

check("observer cleaned", cleanObserver("  Alex_Space99 <script> ") === "Alex_Space99 script" && cleanObserver("<>") === "");
check("sha256 of 'abc'", (await sha256Hex("abc", webcrypto.subtle)) === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
const cand = { ra: 269.4462, dec: 4.769, label: "#1", speedArcsecPerYear: 10.14, nDet: 24, nFrames: 24, known: "Barnard's Star" };
const pin = await makePin(cand, { observer: "Alex_Space99", realData: false, now: new Date("2026-11-14T10:00:00Z"), subtle: webcrypto.subtle });
check("pin fields", pin.observer === "Alex_Space99" && pin.dataKind === "synthetic" && pin.foundAt === "2026-11-14T10:00:00.000Z" && /^[0-9a-f]{64}$/.test(pin.hash));
check("tag says reported, not discovered, and synthetic", pinTag(pin) === "Reported by Alex_Space99 (synthetic demo data)");
check("hash verifies, and an edit breaks it", (await verifyPin(pin, webcrypto.subtle)) && !(await verifyPin({ ...pin, observer: "Mallory" }, webcrypto.subtle)));
let threw = ""; try { await makePin(cand, { observer: "  ", subtle: webcrypto.subtle }); } catch (e) { threw = e.message; }
check("empty name refused", threw === "Enter an observer name.");
threw = ""; try { await makePin({ ra: NaN, dec: 0 }, { observer: "x", subtle: webcrypto.subtle }); } catch (e) { threw = e.message; }
check("no position refused", /no sky position/.test(threw));
let pins = addPin(addPin([], pin), pin); const s2 = mem(); savePins(s2, pins);
check("duplicate not added; storage round-trip", pins.length === 1 && loadPins(s2).length === 1 && removePin(pins, pin.id).length === 0);
const a = skyToMap(0, 90), b = skyToMap(180, -90);
check("map projection", a.x === 1 && a.y === 0 && b.x === 0.5 && b.y === 1);
check("page has the pin button and the dialog", html.includes('id="pin-report-btn"') && html.includes("Enter observer name / handle:"));

console.log(failed ? `FAIL  ${failed} check(s) failed` : "PASS  all missions/pin board checks");
process.exit(failed ? 1 : 0);
