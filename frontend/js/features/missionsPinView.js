// missionsPinView.js – the DOM part of missions.js (the mission card) and pinBoard.js (the pin board with its sky map and the observer-name dialog).

import { missionsDatabase, pickRandomMission, missionHref, loadProgress, saveProgress, markComplete, noteShown } from "./missions.js";
import { makePin, pinTag, loadPins, savePins, addPin, removePin, skyToMap, verifyPin } from "./pinBoard.js";

const $ = (id) => document.getElementById(id);
const store = (() => { try { return window.localStorage; } catch { return null; } })();
const fmt = (x, d) => (Number.isFinite(x) ? x.toFixed(d) : "–");

/** The mission card in Learn Mode: a random practical mission on every visit and on "Load random mission", plus the whole catalogue. */
export function setupMissions() {
  const card = $("mission-card");
  if (!card) return null;
  let progress = loadProgress(store);
  let current = null;

  function renderCatalogue() {
    const box = $("mission-catalogue");
    if (!box) return;
    const groups = new Map();
    for (const m of missionsDatabase) (groups.get(m.category) ?? groups.set(m.category, []).get(m.category)).push(m);
    box.textContent = "";
    for (const [cat, list] of groups) {
      const det = document.createElement("details");
      const done = list.filter((m) => progress.completed.includes(m.id)).length;
      const sum = document.createElement("summary"); sum.textContent = `${cat} · ${done}/${list.length}`;
      const ul = document.createElement("ul");
      for (const m of list) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = missionHref(m, location.search);
        a.textContent = `${progress.completed.includes(m.id) ? "✓ " : ""}${m.title}`;
        li.append(a, ` · level ${m.tier} · ${m.steps.length} steps`);
        ul.appendChild(li);
      }
      det.append(sum, ul);
      box.appendChild(det);
    }
  }

  function render() {
    const m = current;
    const done = progress.completed.includes(m.id);
    $("mission-category").textContent = `${m.category} · level ${m.tier} · ${m.steps.length} steps`;
    $("mission-title").textContent = (done ? "✓ " : "") + m.title;
    $("mission-story").textContent = m.story;
    const ol = $("mission-steps-preview");
    ol.textContent = "";
    for (const s of m.steps) { const li = document.createElement("li"); li.textContent = s.does; ol.appendChild(li); }
    $("mission-feedback").hidden = !done;
    $("mission-feedback").textContent = m.successFeedback;
    $("mission-go").href = missionHref(m, location.search);
    $("mission-go").textContent = done ? "Play this mission again" : "🚀 Start this mission";
    $("cm-progress").textContent = `Missions completed: ${progress.completed.length} of ${missionsDatabase.length}`;
    $("cm-progress-bar").max = missionsDatabase.length;
    $("cm-progress-bar").value = progress.completed.length;
    renderCatalogue();
  }

  function loadRandom() {
    current = pickRandomMission(Math.random, [...progress.recent, ...progress.completed, current?.id].filter(Boolean));
    progress = noteShown(progress, current.id);
    saveProgress(store, progress);
    render();
  }

  $("mission-random-btn").addEventListener("click", loadRandom);
  $("mission-reset-btn").addEventListener("click", () => {
    if (!confirm("Reset your Cosmic Missions progress on this device?")) return;
    progress = { completed: [], recent: [] };
    saveProgress(store, progress);
    render();
  });
  loadRandom();
  return { loadRandom };
}

/**
 * The pin board. getCandidate() returns the selected candidate ({ra, dec, label, ...}) or null; getContext() → { realData, field }.
 * Returns { refresh } so the page can enable the pin button when the selection changes.
 */
export function setupPinBoard({ getCandidate, getContext }) {
  if (!$("pin-board")) return null;
  let pins = loadPins(store);
  const dialog = $("pin-dialog");
  const pinBtn = $("pin-report-btn");

  function refresh() { pinBtn.disabled = !getCandidate(); }

  function render() {
    const svg = $("pin-map");
    svg.querySelectorAll(".pin-marker").forEach((n) => n.remove());
    const list = $("pin-list");
    list.textContent = "";
    $("pin-empty").hidden = pins.length > 0;
    for (const p of pins) {
      const { x, y } = skyToMap(p.ra, p.dec);
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "pin-marker" + (p.dataKind === "synthetic" ? " is-synthetic" : ""));
      g.setAttribute("transform", `translate(${(x * 360).toFixed(2)} ${(y * 180).toFixed(2)})`);
      g.innerHTML = `<path d="M0 0 L-4 -8 A4.5 4.5 0 1 1 4 -8 Z"/><circle cx="0" cy="-10" r="1.6"/>`;
      const t = document.createElementNS("http://www.w3.org/2000/svg", "title");
      t.textContent = `${pinTag(p)} · RA ${fmt(p.ra, 4)}° Dec ${fmt(p.dec, 4)}°`;
      g.appendChild(t);
      svg.appendChild(g);

      const li = document.createElement("li");
      li.className = "pin-item";
      const head = document.createElement("strong"); head.textContent = pinTag(p);
      const body = document.createElement("span");
      body.textContent = ` · ${p.label ?? "candidate"} · RA ${fmt(p.ra, 5)}°, Dec ${fmt(p.dec, 5)}° · ${new Date(p.foundAt).toLocaleString()}` +
        (p.speedArcsecPerYear != null ? ` · ${fmt(p.speedArcsecPerYear, 2)}″/yr` : "") +
        (p.checks?.detections != null ? ` · seen in ${p.checks.detections} of ${p.checks.images} images` : "") +
        (p.checks?.knownObject ? ` · known object: ${p.checks.knownObject}` : "");
      const hash = document.createElement("code"); hash.className = "pin-hash"; hash.textContent = `SHA-256 ${p.hash}`;
      const ok = document.createElement("span"); ok.className = "pin-verify muted small";
      verifyPin(p).then((good) => { ok.textContent = good ? " · hash checks out" : " · hash does NOT match (edited?)"; });
      const del = document.createElement("button");
      del.type = "button"; del.className = "btn btn-small"; del.textContent = "Remove";
      del.addEventListener("click", () => { pins = removePin(pins, p.id); savePins(store, pins); render(); });
      li.append(head, body, document.createElement("br"), hash, ok, " ", del);
      list.appendChild(li);
    }
  }

  pinBtn.addEventListener("click", () => {
    if (!getCandidate()) return;
    $("pin-name-error").textContent = "";
    dialog.showModal();
    $("pin-name").focus();
  });
  $("pin-cancel").addEventListener("click", () => dialog.close());
  $("pin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const c = getCandidate();
    try {
      const pin = await makePin(c, { observer: $("pin-name").value, ...getContext() });
      pins = addPin(pins, pin);
      if (!savePins(store, pins)) $("pin-status").textContent = "This browser would not store the pin; it is shown until the page is reloaded.";
      else $("pin-status").textContent = `Pinned: ${pinTag(pin)}.`;
      dialog.close();
      render();
    } catch (err) {
      $("pin-name-error").textContent = err.message;
    }
  });
  $("pin-clear-btn").addEventListener("click", () => {
    if (!pins.length || !confirm(`Remove all ${pins.length} pins from this browser?`)) return;
    pins = []; savePins(store, pins); render();
  });

  render();
  refresh();
  return { refresh };
}
