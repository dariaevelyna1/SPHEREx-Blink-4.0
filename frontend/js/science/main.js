// science/main.js: the DOM side of the Science workspace. Every number it shows comes from science/model.js (pure, tested in Node).
// Navigation model: SELECTION inside fixed panels (sequence list, timeline ticks, candidate rows) plus the keyboard. Nothing is behind a step.
// Failures are shown in words in the viewer; synthetic data is never loaded in place of a backend that failed.

import { createClient, loadSequence, parseApiParam } from "../shared/dataClient.js";
import { parseQuery, pickSequence, keepQuery } from "../shared/urlState.js";
import { mountHeader } from "../shared/siteHeader.js";
import { runDetector, stretchAsinh } from "../shared/analysis.js";
import { eventToPixel, paintGrey, paintMarks } from "../shared/skyCanvas.js";
import { MODES, candidateRows, candidateTable, displayImage, frameRows, marksFor, pointerRows, provenanceRows, stepFrame, timelineModel } from "./model.js";

const $ = (id) => document.getElementById(id);
const header = mountHeader("science");
const query = parseQuery(location.search);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = {
  client: null, health: null, summaries: [], loaded: null, k: 0, mode: "blink",
  candidates: null, candidateSource: "stored", selectedId: null, timer: null, top: 120,
  layers: { candidates: true, truth: false }, pointer: null,
};

function fill(dl, rows) {
  dl.replaceChildren(...rows.flatMap(([k, v]) => { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = k; dd.textContent = v; return [dt, dd]; }));
}

function fail(message) {
  const box = $("viewer-message");
  box.replaceChildren(Object.assign(document.createElement("strong"), { textContent: "Not loaded. " }), document.createTextNode(message));
  box.hidden = false;
}

// ---- controls ----
function renderSequenceList() {
  const list = $("seq-list");
  list.replaceChildren(...state.summaries.map((s) => {
    const label = document.createElement("label"), input = document.createElement("input"), span = document.createElement("span"), small = document.createElement("small");
    label.className = "choice";
    input.type = "radio"; input.name = "seq"; input.value = s.sequenceId; input.checked = s.sequenceId === state.loaded?.sequence.sequenceId;
    input.addEventListener("change", () => openSequence(s.sequenceId));
    span.textContent = s.title;
    small.textContent = `${s.dataKind.toUpperCase()} · ${s.detector} · ${s.frameCount} images · ${s.passCount} passes`;
    span.append(small); label.append(input, span);
    return label;
  }));
}

function renderModes() {
  $("mode-list").replaceChildren(...MODES.map((m) => {
    const label = document.createElement("label"), input = document.createElement("input"), span = document.createElement("span"), kbd = document.createElement("kbd"), small = document.createElement("small");
    label.className = "choice";
    input.type = "radio"; input.name = "mode"; input.value = m.id; input.checked = m.id === state.mode;
    input.addEventListener("change", () => setMode(m.id));
    kbd.textContent = m.key.toUpperCase(); small.textContent = m.note;
    span.append(kbd, document.createTextNode(m.label), small); label.append(input, span);
    return label;
  }));
}

function setMode(id) {
  state.mode = id;
  for (const input of document.querySelectorAll('input[name="mode"]')) input.checked = input.value === id;
  draw();
}

// ---- timeline ----
function renderTimeline() {
  const { sequence } = state.loaded;
  $("timeline-passes").replaceChildren(...timelineModel(sequence.frames).map((g) => {
    const li = document.createElement("li"), label = document.createElement("span"), ol = document.createElement("ol");
    li.className = "pass"; label.className = "pass-label"; label.textContent = `pass ${g.pass} · ${g.dateLabel}`;
    for (const f of g.frames) {
      const item = document.createElement("li"), b = document.createElement("button");
      b.type = "button"; b.className = "tick"; b.textContent = String(f.index + 1); b.title = f.title; b.dataset.index = f.index;
      b.setAttribute("aria-label", f.title);
      b.addEventListener("click", () => goTo(f.index));
      item.append(b); ol.append(item);
    }
    li.append(label, ol);
    return li;
  }));
  $("timeline-note").textContent = "Keys: ← → image · Space play · B D S T view · G rings · 1-9 candidate";
}

function goTo(k) { state.k = k; draw(); }

// ---- the picture ----
function draw() {
  if (!state.loaded) return;
  const { sequence, arrays } = state.loaded, n = sequence.grid.n, k = state.k, f = sequence.frames[k];
  for (const b of document.querySelectorAll(".tick")) { if (Number(b.dataset.index) === k) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); }
  const label = $("sky-label");
  label.textContent = sequence.dataKind === "synthetic" ? "SYNTHETIC" : "REAL"; label.dataset.kind = sequence.dataKind;
  if (arrays) {
    const shown = displayImage(state.mode, arrays, k, sequence.frames.map((x) => x.mjd));
    const sigma = state.mode === "blink" ? f.stats?.noiseSigma ?? 1 : 1;
    paintGrey($("sky-image"), stretchAsinh(shown.image, sigma, { hi: state.top }), n);
    $("sky-caption").textContent = `${sequence.dataKind.toUpperCase()} · ${shown.caption} · asinh stretch, top ${state.top} σ · north up, east left · display only, measurements use the float pixels`;
    $("sky-image").setAttribute("aria-label", `${sequence.dataKind} ${shown.caption}`);
  } else {
    $("sky-caption").textContent = state.loaded.pixelsProblem;
  }
  paintMarks($("sky-overlay"), marksFor(sequence, state.candidates, k, { layers: state.layers, selectedId: state.selectedId, mode: state.mode }), n);
  fill($("frame-rows"), frameRows(sequence, k));
  fill($("prov-rows"), provenanceRows(sequence, k));
  renderPointer();
}

function renderPointer() {
  const { sequence, arrays } = state.loaded, p = state.pointer;
  fill($("pointer-rows"), pointerRows(sequence, arrays, state.k, p?.x ?? -1, p?.y ?? -1));
}

// ---- candidates ----
function renderCandidates() {
  const { sequence } = state.loaded, t = candidateTable(state.candidates, sequence, state.candidateSource);
  $("cand-head").replaceChildren(...t.head.map((h) => Object.assign(document.createElement("th"), { scope: "col", textContent: h })));
  $("cand-body").replaceChildren(...t.rows.map((r, i) => {
    const tr = document.createElement("tr");
    tr.dataset.id = r.id; tr.setAttribute("aria-selected", String(r.id === state.selectedId));
    r.cells.forEach((c, j) => {
      const td = document.createElement("td");
      if (j === 0) { const b = document.createElement("button"); b.type = "button"; b.className = "row-btn"; b.textContent = c; b.title = `Select ${c} (key ${i + 1})`; td.append(b); }
      else td.textContent = c;
      tr.append(td);
    });
    tr.addEventListener("click", () => selectCandidate(r.id));
    return tr;
  }));
  $("cand-caption").textContent = t.caption;
  const c = state.candidates?.candidates.find((x) => x.candidateId === state.selectedId);
  fill($("cand-detail"), c ? candidateRows(c, sequence) : []);
}

function selectCandidate(id) {
  state.selectedId = state.selectedId === id ? null : id;
  renderCandidates(); draw();
}

function runSearch() {
  const { sequence, arrays, masks } = state.loaded, status = $("detector-status");
  if (!arrays) { status.textContent = "No pixels here: the search needs the float pixels."; return; }
  status.textContent = "Searching…";
  setTimeout(() => {
    const t0 = performance.now();
    state.candidates = runDetector(sequence, arrays, masks);
    state.candidateSource = "browser"; state.selectedId = null;
    status.textContent = `Done in ${Math.round(performance.now() - t0)} ms: ${state.candidates.candidates.length} candidate(s).`;
    renderCandidates(); draw();
  }, 20);
}

// ---- playback ----
function setPlaying(on) {
  clearInterval(state.timer); state.timer = null;
  $("play").setAttribute("aria-pressed", String(on)); $("play").textContent = on ? "Pause" : "Play";
  if (on) state.timer = setInterval(() => goTo(stepFrame(state.k, state.loaded.sequence.frames.length, 1)), 1000 / Number($("speed").value));
}

// ---- real results (numbers only) ----
async function renderRealExamples() {
  let doc = null;
  try { doc = await state.client.getRealExamples(); } catch (err) { $("real-note").textContent = `Could not load the real results: ${err.message}`; return; }
  if (!doc) { $("real-note").textContent = "This backend does not publish the quoted real results."; return; }
  $("real-note").textContent = `${doc.label}. ${doc.caution} Source: ${doc.source}`;
  const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : "-");
  $("real-body").replaceChildren(...doc.examples.map((e) => {
    const tr = document.createElement("tr");
    for (const v of [e.field, e.detector, e.images, `${f2(e.catalogueMotion[0])}, ${f2(e.catalogueMotion[1])}`, `${f2(e.measuredMotion[0])}, ${f2(e.measuredMotion[1])}`, f2(e.difference), e.significanceSigma])
      tr.append(Object.assign(document.createElement("td"), { textContent: String(v) }));
    return tr;
  }));
}

// ---- loading ----
async function openSequence(id) {
  setPlaying(false);
  $("viewer-message").hidden = true;
  $("field-title").textContent = "Loading…";
  try {
    state.loaded = await loadSequence(state.client, id);
  } catch (err) {
    state.loaded = null; header.setBadges({ health: state.health, sequence: null });
    $("field-title").textContent = "No sequence"; fail(err.message); return;
  }
  const { sequence } = state.loaded;
  state.k = 0; state.selectedId = null;
  state.candidates = state.loaded.candidates; state.candidateSource = "stored";
  $("field-title").textContent = `${sequence.title} · ${sequence.detector} · RA ${sequence.center.raDeg.toFixed(4)}° Dec ${sequence.center.decDeg >= 0 ? "+" : "−"}${Math.abs(sequence.center.decDeg).toFixed(4)}°`;
  $("layer-truth").disabled = !sequence.truth;
  header.setBadges({ health: state.health, sequence });
  history.replaceState(null, "", `science.html${keepQuery(location.search, { seq: id, ra: null, dec: null })}`);
  header.refreshLinks();
  renderSequenceList(); renderTimeline(); renderCandidates(); draw();
  if (state.loaded.candidatesProblem) $("detector-status").textContent = state.loaded.candidatesProblem;
}

async function start() {
  renderModes();
  const api = parseApiParam(query.api);
  if (api.problem) { header.setBadges({ healthError: api.problem }); $("field-title").textContent = "No backend"; fail(api.problem); return; }
  state.client = createClient({ api: api.api, staticBase: new URL("data/edu/", document.baseURI).href });
  try { state.health = await state.client.health(); }
  catch (err) { header.setBadges({ healthError: err.message }); $("field-title").textContent = "Backend unreachable"; fail(`${err.message} Nothing is shown in its place.`); return; }
  header.setBadges({ health: state.health });
  try { state.summaries = await state.client.listSequences(); }
  catch (err) { $("field-title").textContent = "No list"; fail(err.message); return; }
  renderSequenceList();
  renderRealExamples();
  const pick = pickSequence(state.summaries, query);
  if (!pick.sequenceId) { $("field-title").textContent = "Nothing matches"; fail(pick.problem); return; }
  await openSequence(pick.sequenceId);
}

// ---- events ----
$("play").addEventListener("click", () => setPlaying(!state.timer));
$("speed").addEventListener("input", () => { $("speed-out").textContent = $("speed").value; if (state.timer) setPlaying(true); });
$("top").addEventListener("input", () => { state.top = Number($("top").value); $("top-out").textContent = $("top").value; draw(); });
$("layer-candidates").addEventListener("change", (e) => { state.layers.candidates = e.target.checked; draw(); });
$("layer-truth").addEventListener("change", (e) => { state.layers.truth = e.target.checked; draw(); });
$("run-detector").addEventListener("click", runSearch);
$("sky").addEventListener("pointermove", (e) => { if (!state.loaded) return; state.pointer = eventToPixel(e, $("sky-image"), state.loaded.sequence.grid.n); renderPointer(); });
$("sky").addEventListener("pointerleave", () => { state.pointer = null; if (state.loaded) renderPointer(); });
addEventListener("resize", () => draw());

document.addEventListener("keydown", (e) => {
  if (!state.loaded || e.altKey || e.ctrlKey || e.metaKey) return;
  const tag = e.target.tagName, typing = tag === "INPUT" && !["radio", "checkbox", "range"].includes(e.target.type);
  if (typing || tag === "TEXTAREA" || tag === "SELECT") return;
  const count = state.loaded.sequence.frames.length, key = e.key.toLowerCase();
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    if (e.target.type === "range" || e.target.type === "radio") return;
    e.preventDefault(); goTo(stepFrame(state.k, count, e.key === "ArrowRight" ? 1 : -1));
  } else if (e.key === " " && tag !== "BUTTON") { e.preventDefault(); setPlaying(!state.timer); }
  else if (MODES.some((m) => m.key === key)) setMode(MODES.find((m) => m.key === key).id);
  else if (key === "g") { const box = $("layer-candidates"); box.checked = !box.checked; state.layers.candidates = box.checked; draw(); }
  else if (/^[1-9]$/.test(key)) { const c = state.candidates?.candidates[Number(key) - 1]; if (c) selectCandidate(c.candidateId); }
});

if (reducedMotion) $("speed").value = "1";
start();
