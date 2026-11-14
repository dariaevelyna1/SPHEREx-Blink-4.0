// missionRunner.js – runs a Cosmic Mission inside Science Mode (index.html?mission=<id>): shows the steps, highlights the control to use,
// and ticks each step when the learner really does it (a click/change/input on the right control, or a result appearing). DOM only;
// the missions and the step check are pure, in missions.js.

import { findMission, stepMatches, loadProgress, saveProgress, markComplete, pickRandomMission, missionHref } from "./missions.js";

const store = (() => { try { return window.localStorage; } catch { return null; } })();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const visible = (el) => Boolean(el && el.getClientRects().length && !el.closest("[hidden]"));

export function startMissionRunner() {
  const id = new URLSearchParams(location.search).get("mission");
  const mission = id && findMission(id);
  if (!mission) return null;

  let step = 0;
  let marked = null;
  const box = document.createElement("aside");
  box.className = "mission-runner";
  box.setAttribute("aria-live", "polite");
  box.setAttribute("aria-label", "Current mission");
  document.body.appendChild(box);

  function highlight() {
    marked?.classList.remove("mission-target");
    marked = null;
    const s = mission.steps[step];
    if (!s?.check.on) return;
    const el = [...document.querySelectorAll(s.check.on)].find(visible) ?? document.querySelector(s.check.on);
    const target = el?.matches("input[type=radio], input[type=checkbox]") ? el.closest("label") ?? el : el;
    if (target) { target.classList.add("mission-target"); marked = target; }
  }

  function render() {
    const done = step >= mission.steps.length;
    const items = mission.steps.map((s, i) =>
      `<li class="${i < step ? "is-done" : i === step ? "is-current" : ""}"><span aria-hidden="true">${i < step ? "✓" : i + 1}</span> ${esc(s.does)}</li>`).join("");
    const next = pickRandomMission(Math.random, [...loadProgress(store).completed, mission.id]);
    box.innerHTML = `
      <p class="mission-runner-kicker">Mission · ${esc(mission.category)}</p>
      <h2>${esc(mission.title)}</h2>
      ${done ? "" : `<p class="mission-runner-story">${esc(mission.story)}</p>`}
      <ol class="mission-steps">${items}</ol>
      ${done ? `<p class="mission-runner-win">🏆 Mission complete! ${esc(mission.successFeedback)}</p>
        <p class="mission-runner-actions"><a class="btn btn-small btn-primary" href="${esc(missionHref(next, location.search))}">Next random mission</a>
        <a class="btn btn-small" href="learn.html#missions">Back to Learn Mode</a></p>`
      : `<p class="mission-runner-actions"><button type="button" class="btn btn-small" data-act="show">Show me where</button>
        <button type="button" class="btn btn-small" data-act="quit">Quit mission</button></p>`}`;
    highlight();
  }

  function advance() {
    step++;
    if (step >= mission.steps.length) {
      saveProgress(store, markComplete(loadProgress(store), mission.id));
      marked?.classList.remove("mission-target");
      clearInterval(timer);
    }
    render();
    if (step < mission.steps.length && mission.steps[step].check.see) poll();
  }

  function onEvent(e) {
    if (box.contains(e.target)) return;
    const s = mission.steps[step];
    if (s && stepMatches(s.check, e.target)) setTimeout(advance, 0);  // let the page react first
  }
  function poll() {
    const s = mission.steps[step];
    if (s?.check.see && [...document.querySelectorAll(s.check.see)].some(visible)) advance();
    else if (s?.check.on && !marked) highlight();                       // the control may appear later (after a search)
  }
  for (const t of ["click", "change", "input"]) document.addEventListener(t, onEvent, true);
  const timer = setInterval(poll, 600);

  box.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "quit") {
      clearInterval(timer); marked?.classList.remove("mission-target"); box.remove();
      const u = new URL(location.href); u.searchParams.delete("mission"); history.replaceState(null, "", u);
    }
    if (act === "show") { highlight(); marked?.scrollIntoView({ behavior: "smooth", block: "center" }); }
  });
  render();
  return { mission };
}
