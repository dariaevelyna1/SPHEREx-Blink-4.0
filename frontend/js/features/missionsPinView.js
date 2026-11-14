// missionsPinView.js – the DOM part of missions.js (the mission card) and pinBoard.js (the pin board with its sky map and the observer-name dialog).

import { missionWhy, missionsDatabase, pickRandomMission, missionHref, loadProgress, saveProgress, markComplete, noteShown } from "./missions.js";
import { makePin, pinTag, loadPins, savePins, addPin, removePin, skyToMap, verifyPin, eclipticPoints, fieldOffsetArcmin, initials, timeAgo, decorativeStars } from "./pinBoard.js";
import { formatRA, formatDec } from "../coords.js";
import { sharedConfig, fetchSharedPins, pushSharedPin, mergePins } from "./pinSync.js";
import { PIN_BOARD_URL, PIN_BOARD_KEY } from "../config.js";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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
        li.append(a, ` · level ${m.tier} · ${m.steps.length} steps${m.needsReal ? " · 🛰️ real data only" : ""}`);
        ul.appendChild(li);
      }
      det.append(sum, ul);
      box.appendChild(det);
    }
  }

  function render() {
    const m = current;
    const done = progress.completed.includes(m.id);
    $("mission-category").textContent = `${m.category} · level ${m.tier} · ${m.steps.length} steps${m.needsReal ? " · 🛰️ needs real data" : ""}`;
    $("mission-title").textContent = (done ? "✓ " : "") + m.title;
    $("mission-story").textContent = m.story;
    $("mission-why").textContent = missionWhy(m);
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
 * Returns { refresh } so the page can enable the pin buttons when the selection changes.
 */
export function setupPinBoard({ getCandidate, getContext }) {
  if (!$("pin-board")) return null;
  const SVG = "http://www.w3.org/2000/svg";
  const W = 720, H = 360;
  let pins = loadPins(store);
  let view = "sky";
  const shared = sharedConfig(PIN_BOARD_URL, PIN_BOARD_KEY);
  let syncText = shared ? "🌍 Connecting to the shared board…" : "💾 Pins are kept in this browser only.";
  let syncBad = false;
  let openId = null;
  const dialog = $("pin-dialog");
  const pinBtns = [$("pin-report-btn"), $("pin-board-pin-btn")].filter(Boolean);
  const svg = $("pin-map");
  const popup = $("pin-popup");
  const el = (tag, attrs = {}, parent = svg) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); parent.appendChild(n); return n; };
  const text = (x, y, t, cls, anchor = "middle") => { const n = el("text", { x, y, class: cls, "text-anchor": anchor }); n.textContent = t; return n; };

  let drawnField = "";
  function refresh() {
    for (const b of pinBtns) b.disabled = !getCandidate();
    const f = JSON.stringify(getContext().field);            // redraw when the field on screen changes ("you are here")
    if (f !== drawnField) { drawnField = f; render(); }
  }

  // ---- projections: all sky (equirectangular, RA grows to the left) or the field on screen (arcminutes around its centre)
  function project(ra, dec) {
    if (view === "sky") { const { x, y } = skyToMap(ra, dec); return { x: x * W, y: y * H, inside: true }; }
    const f = getContext().field ?? {};
    const half = Math.max(1, (f.fov ?? 5)) * 0.75;           // arcmin from the centre to the top edge
    const k = (H / 2) / half;
    const o = fieldOffsetArcmin(ra, dec, f.ra ?? 0, f.dec ?? 0);
    const x = W / 2 - o.east * k, y = H / 2 - o.north * k;
    return { x, y, inside: x >= 0 && x <= W && y >= 0 && y <= H };
  }

  function drawBase() {
    svg.textContent = "";
    const defs = el("defs");
    defs.innerHTML = `<radialGradient id="pb-sky" cx="50%" cy="45%" r="75%"><stop offset="0" class="pb-sky-in"/><stop offset="1" class="pb-sky-out"/></radialGradient>
      <radialGradient id="pb-glow"><stop offset="0" class="pb-glow-in"/><stop offset="1" class="pb-glow-out"/></radialGradient>`;
    el("rect", { width: W, height: H, fill: "url(#pb-sky)" });
    for (const [x, y, r, o] of decorativeStars(view === "sky" ? 320 : 140, view === "sky" ? 7 : 11)) el("circle", { cx: x * W, cy: y * H, r, class: "pb-star", "fill-opacity": o });
    const f = getContext().field;
    if (view === "sky") {
      for (let h = 0; h < 24; h += 2) { const x = (1 - h / 24) * W; el("line", { x1: x, y1: 0, x2: x, y2: H, class: "pb-grid" }); if (h) text(x, H - 6, `${h}h`, "pb-label"); }
      for (const d of [-60, -30, 0, 30, 60]) { const y = (90 - d) / 180 * H; el("line", { x1: 0, y1: y, x2: W, y2: y, class: d ? "pb-grid" : "pb-equator" }); text(6, y - 4, `${d > 0 ? "+" : ""}${d}°`, "pb-label", "start"); }
      let d = "", prev = null;
      for (const [ra, dec] of eclipticPoints()) { const p = project(ra, dec); d += (prev && Math.abs(p.x - prev.x) < W / 2 ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1); prev = p; }
      el("path", { d, class: "pb-ecliptic" });
      text(W - 8, 16, "RA ← increases   ·   Dec ↑", "pb-label", "end");
      if (f && Number.isFinite(f.ra)) { const p = project(f.ra, f.dec); const g = el("g", { class: "pb-here", transform: `translate(${p.x} ${p.y})` }); el("circle", { r: 9 }, g); el("path", { d: "M-14 0H-5M5 0H14M0 -14V-5M0 5V14" }, g); text(p.x, p.y - 16, "you are here", "pb-label pb-here-label"); }
    } else {
      const half = Math.max(1, (f?.fov ?? 5)) * 0.75, k = (H / 2) / half;
      for (let a = -Math.floor(half * 2); a <= half * 2; a++) { const x = W / 2 + a * k, y = H / 2 + a * k; el("line", { x1: x, y1: 0, x2: x, y2: H, class: a ? "pb-grid" : "pb-equator" }); if (y >= 0 && y <= H) el("line", { x1: 0, y1: y, x2: W, y2: y, class: a ? "pb-grid" : "pb-equator" }); }
      const s = (f?.fov ?? 5) * k;
      el("rect", { x: W / 2 - s / 2, y: H / 2 - s / 2, width: s, height: s, class: "pb-fieldbox" });
      text(W / 2, H / 2 - s / 2 - 6, `field on screen · ${f?.fov ?? 5}′ wide · grid every 1′`, "pb-label");
      text(14, H / 2 - 4, "E", "pb-label pb-compass"); text(W - 14, H / 2 - 4, "W", "pb-label pb-compass"); text(W / 2, 14, "N", "pb-label pb-compass");
    }
  }

  function drawPins() {
    let outside = 0;
    for (const p of pins) {
      const q = project(p.ra, p.dec);
      if (!q.inside) { outside++; continue; }
      const g = el("g", { class: "pin-marker" + (p.dataKind === "synthetic" ? " is-synthetic" : "") + (p.id === openId ? " is-open" : ""), transform: `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})`, tabindex: 0, role: "button", "data-id": p.id, "aria-label": `${pinTag(p)}, RA ${formatRA(p.ra)}, Dec ${formatDec(p.dec)}` });
      el("circle", { r: 16, fill: "url(#pb-glow)", class: "pb-halo" }, g);
      el("circle", { r: 7, class: "pb-pulse" }, g);
      el("path", { d: "M0 0 C-3 -6 -9 -9 -9 -15 A9 9 0 1 1 9 -15 C9 -9 3 -6 0 0Z", class: "pb-drop" }, g);
      const t = el("text", { x: 0, y: -12.5, class: "pb-initials", "text-anchor": "middle" }, g); t.textContent = initials(p.observer);
    }
    if (view === "field" && outside) text(W - 10, H - 10, `${outside} pin${outside > 1 ? "s" : ""} outside this field`, "pb-label", "end");
  }

  function chips(p) {
    const c = [];
    if (p.speedArcsecPerYear != null) c.push(`☄️ ${fmt(p.speedArcsecPerYear, 2)}″/yr`);
    if (p.checks?.detections != null) c.push(`✓ seen in ${p.checks.detections}/${p.checks.images} images`);
    if (p.checks?.knownObject) c.push(`🔎 known: ${p.checks.knownObject}`);
    c.push(p.dataKind === "synthetic" ? "🧪 synthetic demo" : "🛰️ real data");
    return c.map((t) => `<span class="pb-chip">${esc(t)}</span>`).join("");
  }
  function fieldLink(p) {
    const f = p.field ?? {};
    const q = new URLSearchParams(location.search);
    q.set("ra", (f.ra ?? p.ra).toFixed(5)); q.set("dec", (f.dec ?? p.dec).toFixed(5)); if (f.fov) q.set("fov", f.fov); if (f.det) q.set("det", f.det); q.delete("mission");
    return `index.html?${q}`;
  }
  function cardHtml(p) {
    return `<div class="pb-card-head"><span class="pb-avatar" aria-hidden="true">${esc(initials(p.observer))}</span>
      <div><strong>${esc(pinTag(p))}</strong><span class="pb-when">${esc(p.label ?? "candidate")} · ${esc(timeAgo(p.foundAt))} · ${esc(new Date(p.foundAt).toLocaleString())}</span></div></div>
      <p class="pb-coords"><span>RA <b>${esc(formatRA(p.ra))}</b></span><span>Dec <b>${esc(formatDec(p.dec))}</b></span><span class="muted">(${fmt(p.ra, 5)}°, ${fmt(p.dec, 5)}°)</span></p>
      <p class="pb-chips">${chips(p)}</p>
      <p class="pb-hash"><code title="${esc(p.hash)}">SHA-256 ${esc(p.hash.slice(0, 16))}…${esc(p.hash.slice(-6))}</code> <span class="pb-verify" data-verify="${esc(p.id)}">checking…</span></p>`;
  }
  function verifyInto(root) {
    for (const v of root.querySelectorAll("[data-verify]")) {
      const p = pins.find((x) => x.id === v.dataset.verify);
      if (p) verifyPin(p).then((ok) => { v.textContent = ok ? "✓ hash checks out" : "⚠ hash does not match (edited?)"; v.classList.toggle("is-bad", !ok); });
    }
  }

  function showPopup() {
    const p = pins.find((x) => x.id === openId);
    const q = p && project(p.ra, p.dec);
    if (!p || !q.inside) { popup.hidden = true; return; }
    popup.innerHTML = `<button type="button" class="pb-close" data-act="close" aria-label="Close">×</button>${cardHtml(p)}
      <p class="pb-popup-actions"><a class="btn btn-small" href="${esc(fieldLink(p))}">Open this field</a> <button type="button" class="btn btn-small" data-act="copy">Copy hash</button></p>`;
    popup.hidden = false;
    if (getComputedStyle(popup).position !== "absolute") { popup.style.left = popup.style.top = ""; verifyInto(popup); return; }
    const box = svg.getBoundingClientRect(), sx = box.width / W, sy = box.height / H;
    const left = Math.min(Math.max(8, q.x * sx - popup.offsetWidth / 2), box.width - popup.offsetWidth - 8);
    const above = q.y * sy - 30 - popup.offsetHeight;
    popup.style.left = `${left}px`;
    popup.style.top = `${above > 4 ? above : q.y * sy + 14}px`;
    verifyInto(popup);
  }

  async function sync() {
    if (!shared) return;
    try {
      for (const p of pins.filter((x) => x.pending)) { await pushSharedPin(shared, p); p.pending = false; }
      const { pins: remote, dropped } = await fetchSharedPins(shared);
      pins = mergePins(pins.filter((p) => !p.shared || remote.some((r) => r.hash === p.hash)), remote);
      savePins(store, pins);
      const people = new Set(remote.map((p) => p.observer)).size;
      syncText = `🌍 Shared board: ${remote.length} pin${remote.length === 1 ? "" : "s"} from ${people} observer${people === 1 ? "" : "s"}, seen by everyone who opens this site. Updated ${new Date().toLocaleTimeString()}.` + (dropped ? ` ${dropped} record(s) failed their hash check and are not shown.` : "");
      syncBad = false;
    } catch (err) {
      syncText = `⚠ The shared board cannot be reached (${err.message}) Your pins are kept in this browser and will be sent when it answers again.`;
      syncBad = true;
    }
    render();
  }

  function render() {
    drawBase();
    drawPins();
    const list = $("pin-list");
    list.textContent = "";
    $("pin-empty").hidden = pins.length > 0;
    const observers = new Set(pins.map((p) => p.observer));
    $("pin-stats").innerHTML = `<span class="pb-stat"><b>${pins.length}</b> pin${pins.length === 1 ? "" : "s"}</span><span class="pb-stat"><b>${observers.size}</b> observer${observers.size === 1 ? "" : "s"}</span>`;
    $("pin-sync").textContent = syncText;
    $("pin-sync").classList.toggle("is-bad", syncBad);
    $("pin-clear-btn").hidden = Boolean(shared);
    for (const p of pins) {
      const li = document.createElement("li");
      li.className = "pin-item" + (p.id === openId ? " is-open" : "");
      li.innerHTML = cardHtml(p) + `<p class="pb-popup-actions"><button type="button" class="btn btn-small" data-act="locate" data-id="${esc(p.id)}">📍 Show on map</button> <a class="btn btn-small" href="${esc(fieldLink(p))}">Open this field</a> ${p.shared ? `<span class="pb-chip">🌍 shared · permanent</span>` : p.pending ? `<span class="pb-chip">⏳ waiting to be sent</span>` : `<button type="button" class="btn btn-small" data-act="remove" data-id="${esc(p.id)}">Remove</button>`}</p>`;
      list.appendChild(li);
    }
    verifyInto(list);
    showPopup();
  }

  // ---- events
  svg.addEventListener("click", (e) => { const g = e.target.closest(".pin-marker"); openId = g ? (g.dataset.id === openId ? null : g.dataset.id) : null; render(); });
  svg.addEventListener("keydown", (e) => { const g = e.target.closest(".pin-marker"); if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openId = g.dataset.id; render(); } });
  popup.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "close") { openId = null; render(); }
    if (act === "copy") { const p = pins.find((x) => x.id === openId); navigator.clipboard?.writeText(p.hash).then(() => { $("pin-status").textContent = "Hash copied."; }, () => {}); }
  });
  $("pin-list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    if (b.dataset.act === "remove") { pins = removePin(pins, b.dataset.id); if (openId === b.dataset.id) openId = null; savePins(store, pins); render(); }
    if (b.dataset.act === "locate") {
      openId = b.dataset.id;
      const p = pins.find((x) => x.id === openId);
      if (view === "field" && !project(p.ra, p.dec).inside) setView("sky");
      render(); svg.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
  function setView(v) {
    view = v;
    document.querySelectorAll(".pb-view").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v)));
  }
  document.querySelectorAll(".pb-view").forEach((b) => b.addEventListener("click", () => { setView(b.dataset.view); render(); }));
  window.addEventListener("resize", () => { if (!popup.hidden) showPopup(); });

  function openDialog() {
    const c = getCandidate();
    if (!c) return;
    const ctx = getContext();
    $("pin-preview").innerHTML = `<p class="pb-coords"><span>RA <b>${esc(formatRA(c.ra))}</b></span><span>Dec <b>${esc(formatDec(c.dec))}</b></span></p>
      <p class="pb-chips">${chips({ ...c, checks: { detections: c.nDet, images: c.nFrames, knownObject: c.known }, dataKind: ctx.realData ? "real" : "synthetic" })}</p>
      <p class="small muted">Your observer name and this position will be <strong>public and permanent</strong> on the shared board. Time of the report: now (${esc(new Date().toLocaleString())}). The pin gets a SHA-256 hash of its own text.</p>`;
    $("pin-name-error").textContent = "";
    try { $("pin-name").value = store?.getItem("spherex-blink-observer") ?? ""; } catch {}
    dialog.showModal();
    $("pin-name").focus();
  }
  for (const b of pinBtns) b.addEventListener("click", openDialog);
  $("pin-cancel").addEventListener("click", () => dialog.close());
  $("pin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const pin = await makePin(getCandidate(), { observer: $("pin-name").value, ...getContext() });
      if (shared) pin.pending = true;
      pins = addPin(pins, pin);
      try { store?.setItem("spherex-blink-observer", pin.observer); } catch {}
      savePins(store, pins);
      $("pin-status").textContent = shared ? `📌 Pinned: ${pinTag(pin)}. Sending it to the shared board…` : `📌 Pinned: ${pinTag(pin)}.`;
      if (shared) sync().then(() => { $("pin-status").textContent = pin.pending ? `📌 ${pinTag(pin)} is saved here; it will be shared when the board answers.` : `📌 Shared with everyone: ${pinTag(pin)}. It stays on the board permanently.`; });
      dialog.close();
      openId = pin.id;
      if (view === "field" && !project(pin.ra, pin.dec).inside) setView("sky");
      render();
      $("pin-board").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      $("pin-name-error").textContent = err.message;
    }
  });
  $("pin-clear-btn").addEventListener("click", () => {
    if (!pins.length || !confirm(`Remove all ${pins.length} pins from this browser?`)) return;
    pins = []; openId = null; savePins(store, pins); render();
  });

  render();
  refresh();
  if (shared) { sync(); setInterval(() => { if (!document.hidden) sync(); }, 60000); }   // new pins from others appear within a minute
  return { refresh, render };
}
