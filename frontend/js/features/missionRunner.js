// missionRunner.js – runs a Cosmic Mission inside Science Mode (index.html?mission=<id>): a mission console that shows the steps,
// highlights the control to use, ticks each step when the learner really does it, explains what just happened, asks for measurements
// read off the page, and awards XP. DOM only; the missions and the checks are pure, in missions.js.

import { findMission, stepMatches, checkMeasurement, STEP_NOTES, xpFor, totalXp, rankFor,
  loadProgress, saveProgress, markComplete, pickRandomMission, missionHref } from "./missions.js";

const store = (() => { try { return window.localStorage; } catch { return null; } })();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const visible = (el) => Boolean(el && el.getClientRects().length && !el.closest("[hidden]"));
const ICONS = { "Cockpit": "🛰️", "Blink": "✨", "Proper": "☄️", "Parallax": "📐", "Deep": "🔭", "Sky": "🗺️", "Data": "💾", "Pro": "📌" };
const iconFor = (cat) => ICONS[Object.keys(ICONS).find((k) => cat.startsWith(k))] ?? "🚀";

/** getCandidate(): the selected candidate or null; getCount(): how many candidates are listed. */
export function startMissionRunner({ getCandidate = () => null, getCount = () => 0 } = {}) {
  const id = new URLSearchParams(location.search).get("mission");
  const mission = id && findMission(id);
  if (!mission) return null;

  let step = 0, marked = null, note = "", wrong = "", collapsed = false;
  const box = document.createElement("aside");
  box.className = "mission-runner";
  box.setAttribute("aria-label", "Mission console");
  document.body.appendChild(box);

  const current = () => mission.steps[step];
  function highlight() {
    marked?.classList.remove("mission-target");
    marked = null;
    const s = current();
    if (!s?.check.on) return;
    const el = [...document.querySelectorAll(s.check.on)].find(visible);
    const target = el?.matches("input[type=radio], input[type=checkbox]") ? el.closest("label") ?? el : el;
    if (target) { target.classList.add("mission-target"); marked = target; }
  }

  function render() {
    const n = mission.steps.length, done = step >= n;
    const items = mission.steps.map((s, i) =>
      `<li class="${i < step ? "is-done" : i === step ? "is-current" : ""}"><span class="mr-dot" aria-hidden="true">${i < step ? "✓" : i + 1}</span><span>${esc(s.does)}</span></li>`).join("");
    const s = current();
    const m = s?.check.measure;
    const progress = loadProgress(store);
    const xp = totalXp(progress);
    const next = pickRandomMission(Math.random, [...progress.completed, mission.id]);
    box.classList.toggle("is-collapsed", collapsed);
    box.classList.toggle("is-won", done);
    box.innerHTML = `
      <header class="mr-head">
        <span class="mr-icon" aria-hidden="true">${iconFor(mission.category)}</span>
        <div><p class="mr-kicker">${esc(mission.category)} · level ${mission.tier} · +${xpFor(mission)} XP</p><h2>${esc(mission.title)}</h2></div>
        <button type="button" class="mr-collapse" data-act="collapse" aria-expanded="${!collapsed}" aria-label="${collapsed ? "Expand" : "Collapse"} the mission console">${collapsed ? "▴" : "▾"}</button>
      </header>
      <div class="mr-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${Math.min(step, n)}" aria-label="Steps done"><span style="width:${(100 * Math.min(step, n) / n).toFixed(0)}%"></span></div>
      <div class="mr-body">
      ${step === 0 ? `<p class="mr-story">${esc(mission.story)}</p>` : ""}
      ${note ? `<p class="mr-note" role="status"><strong>What just happened:</strong> ${esc(note)}</p>` : ""}
      <ol class="mr-steps">${items}</ol>
      ${m ? `<form class="mr-measure" data-act="measure"><label for="mr-input">${esc(s.does)}</label>
          <div class="mr-measure-row"><input id="mr-input" autocomplete="off" inputmode="${m.field === "compass" ? "text" : "decimal"}" placeholder="${m.unit ? "value in " + esc(m.unit) : "your answer"}">
          <button type="submit" class="btn btn-small btn-primary">Check</button></div>
          ${wrong ? `<p class="mr-wrong" role="alert">${esc(wrong)}</p>` : ""}</form>` : ""}
      ${done ? `<div class="mr-win" role="status"><p class="mr-trophy" aria-hidden="true">🏆</p><p><strong>Mission complete! +${xpFor(mission)} XP</strong> · ${xp} XP · rank: ${esc(rankFor(xp))}</p>
          <p>${esc(mission.successFeedback)}</p></div>
        <p class="mr-actions"><a class="btn btn-small btn-primary" href="${esc(missionHref(next, location.search))}">Next mission: ${esc(next.title)} →</a>
        <a class="btn btn-small" href="learn.html#missions">Back to Learn Mode</a></p>`
      : `<p class="mr-actions">${s?.check.on ? `<button type="button" class="btn btn-small" data-act="show">📍 Show me where</button>` : ""}
          <button type="button" class="btn btn-small" data-act="quit">Quit</button></p>`}
      </div>`;
    highlight();
  }

  function advance(learnt) {
    note = learnt ?? "";
    wrong = "";
    step++;
    if (step >= mission.steps.length) {
      saveProgress(store, markComplete(loadProgress(store), mission.id));
      marked?.classList.remove("mission-target");
      clearInterval(timer);
    }
    collapsed = false;
    render();
    if (current()?.check.measure) box.querySelector("#mr-input")?.focus({ preventScroll: true });
  }

  function noteFor(s) { return s.learn ?? STEP_NOTES[s.check.on] ?? ""; }
  function onEvent(e) {
    if (box.contains(e.target)) return;
    const s = current();
    if (s && stepMatches(s.check, e.target)) setTimeout(() => advance(noteFor(s)), 0);   // let the page react first
  }
  function poll() {
    const s = current();
    if (s?.check.see && [...document.querySelectorAll(s.check.see)].some(visible)) advance("");
    else if (s?.check.on && !marked) highlight();                       // the control may appear later
  }
  for (const t of ["click", "change", "input"]) document.addEventListener(t, onEvent, true);
  const timer = setInterval(poll, 600);

  box.addEventListener("submit", (e) => {
    e.preventDefault();
    const m = current()?.check.measure;
    if (!m) return;
    const truth = m.field === "count" ? { count: getCount() } : getCandidate();
    if (!truth || (m.field !== "count" && !getCandidate())) { wrong = "First select a candidate in the list."; render(); return; }
    const { ok, expected } = checkMeasurement(m, box.querySelector("#mr-input").value, truth);
    if (ok) {
      const shown = typeof expected === "number" ? (Number.isInteger(expected) ? expected : expected.toFixed(m.field === "positionAngleDeg" ? 0 : 1)) : expected;
      advance(`Correct: the page measured ${shown}${m.unit}. ${m.field === "speedArcsecPerYear" ? "At that rate it would cross the full Moon (about 1800″) in " + Math.round(1800 / expected) + " years." : ""}`);
    } else { wrong = `Not quite. ${m.hint}`; render(); box.querySelector("#mr-input")?.focus(); }
  });
  box.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "quit") {
      clearInterval(timer); marked?.classList.remove("mission-target"); box.remove();
      const u = new URL(location.href); u.searchParams.delete("mission"); history.replaceState(null, "", u);
    } else if (act === "show") { highlight(); marked?.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else if (act === "collapse") { collapsed = !collapsed; render(); }
  });
  render();
  return { mission };
}
