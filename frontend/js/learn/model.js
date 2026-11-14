// learn/model.js: the Learn narrative as data and small pure functions (no DOM), so Node can test the story and the game.
// The DOM side is learn/main.js. Every picture in Learn is SYNTHETIC and is labelled so on the picture itself.

import { scoreGuess } from "../shared/analysis.js";
import { passIndices } from "../shared/analysis.js";

/** The eight steps, in order. `kind` picks the step's widget in main.js; `sequence` is the synthetic field it shows. */
export const STEPS = [
  { id: "still", kind: "intro", sequence: "syn-a-d2" },
  { id: "pair", kind: "pair", sequence: "syn-a-d2" },
  { id: "blink", kind: "blink", sequence: "syn-a-d2" },
  { id: "hunt", kind: "hunt", sequence: "syn-c-d4" },
  { id: "found", kind: "found", sequence: "syn-c-d4" },
  { id: "planet", kind: "checklist", sequence: "syn-c-d4" },
  { id: "far", kind: "far", sequence: "syn-c-d4" },
  { id: "explore", kind: "explore", sequence: null },
];

/** ?step= (1-based) -> a valid step index (0-based). */
export const stepIndex = (step) => (Number.isInteger(step) && step >= 1 && step <= STEPS.length ? step - 1 : 0);

/** The two images a beginner compares: the first image of the first pass and the first image of the last pass. */
export function pairFrames(frames) {
  const pass = passIndices(frames.map((f) => f.mjd)), last = pass.at(-1);
  return [0, pass.findIndex((p) => p === last)];
}

export const MAX_TRIES = 3;

/**
 * The game "hunt the mover". state = { tries, done, score, last }. guess = { x, y } (image px) on frame mjd.
 * A hit ends the round with points (fewer for each earlier miss); after MAX_TRIES misses the round ends with 0 and the answer is shown.
 */
export const newHunt = () => ({ tries: 0, done: false, score: 0, last: null });
export function huntGuess(state, guess, truth, mjd) {
  if (state.done) return state;
  const r = scoreGuess(guess, truth, mjd, { misses: state.tries });
  const tries = state.tries + 1;
  if (r.hit) return { tries, done: true, score: r.points, last: { ...r, guess } };
  return { tries, done: tries >= MAX_TRIES, score: 0, last: { ...r, guess } };
}

/** "Hot / warm / cold" feedback after a miss, from the distance in pixels. */
export const warmth = (distancePx) => (distancePx <= 6 ? "warm" : distancePx <= 14 ? "near" : "cold");

/**
 * Is it a planet? The checklist, evaluated for one candidate. Each item: { id, passed: true | false | null } where null means
 * "not checked in this app" (we never pretend to have checked something).
 */
export function checklist(candidate, set, masks = null) {
  const passes = set?.stats?.passes ?? 0;
  const onBadPixel = masks ? candidate.points.some((p) => {
    const m = masks[p.frame]; if (!m) return false;
    const n = Math.round(Math.sqrt(m.length)); return m[Math.round(p.y) * n + Math.round(p.x)] !== 0;
  }) : null;
  return [
    { id: "line", passed: candidate.rms < 0.5 },
    { id: "passes", passed: passes >= 3 && candidate.nDet >= 3 },
    { id: "pixel", passed: onBadPixel === null ? null : !onBadPixel },
    { id: "known", passed: null },
  ];
}

/** Which of two movers is farther? The slower one on the sky (for bodies on similar orbits: an assumption the step states). */
export function fartherMover(truth) {
  const speeds = truth.movers.map((m) => Math.hypot(m.vxPxPerYr, m.vyPxPerYr));
  return { index: speeds.indexOf(Math.min(...speeds)), speeds };
}

/** Progress shown in the stepper: [{ index, state: "done" | "current" | "todo" }]. */
export const progress = (current) => STEPS.map((s, index) => ({ index, id: s.id, state: index < current ? "done" : index === current ? "current" : "todo" }));
