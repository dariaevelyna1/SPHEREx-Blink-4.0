// learn/main.js: the DOM side of the Learn narrative. Navigation model: a SEQUENCE of steps (Back / Next, progress dots, ?step=).
// Each step's DOM is built fresh into the one <section>; nothing of the Science workspace is reused here except the shared data modules.
// Every picture says SYNTHETIC on the picture. A failed backend is shown in words; nothing is substituted.

import { createClient, loadSequence, parseApiParam } from "../shared/dataClient.js";
import { parseQuery, keepQuery } from "../shared/urlState.js";
import { mountHeader } from "../shared/siteHeader.js";
import { candidateAt, stretchAsinh } from "../shared/analysis.js";
import { eventToPixel, paintGrey, paintMarks } from "../shared/skyCanvas.js";
import { MAX_TRIES, STEPS, checklist, fartherMover, huntGuess, newHunt, pairFrames, progress, stepIndex, warmth } from "./model.js";
import { GLOSSARY_KEYS, LANGS, t, translateBadge } from "./strings.js";

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids.filter((k) => k !== null && k !== undefined)); return e; };
const header = mountHeader("learn", document, { translate: (text) => translateBadge(state.lang, text) });
const query = parseQuery(location.search);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const LANG_KEY = "blink4.lang";
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* not remembered */ } } };

const state = {
  lang: query.lang ?? (LANGS.includes(store.get(LANG_KEY)) ? store.get(LANG_KEY) : (navigator.language || "en").startsWith("ro") ? "ro" : "en"),
  step: stepIndex(query.step), client: null, health: null, healthError: null, cache: new Map(),
  hunt: newHunt(), guess: null, cleanup: [],
};
const tr = (key, vars) => t(state.lang, key, vars);

// ---- data ----
async function getLoaded(id) {
  if (!state.cache.has(id)) state.cache.set(id, loadSequence(state.client, id));
  return state.cache.get(id);
}

// ---- a picture of the sky, labelled SYNTHETIC on the picture ----
function skyFigure(loaded, { caption = "", tappable = false } = {}) {
  const image = el("canvas", { width: loaded.sequence.grid.n, height: loaded.sequence.grid.n });
  const overlay = el("canvas", { className: "sky-overlay" });
  overlay.setAttribute("aria-hidden", "true");
  const label = el("span", { className: "sky-label", textContent: loaded.sequence.dataKind === "synthetic" ? tr("ui.synthetic") : "REAL" });
  label.dataset.kind = loaded.sequence.dataKind;
  const frame = el("div", { className: "sky-frame" + (tappable ? " tappable" : "") }, image, overlay, label);
  const cap = el("figcaption", { textContent: caption });
  const fig = el("figure", {}, frame, cap);
  let k = 0, marks = () => [];
  const paint = () => {
    const f = loaded.sequence.frames[k];
    paintGrey(image, stretchAsinh(loaded.arrays[k], f.stats?.noiseSigma ?? 1), loaded.sequence.grid.n);
    image.setAttribute("role", "img");
    image.setAttribute("aria-label", `${tr("ui.synthetic")} · ${tr("ui.image", { n: k + 1 })} · ${f.dateISO.slice(0, 10)}`);
    paintMarks(overlay, marks(k), loaded.sequence.grid.n);
  };
  return {
    fig, frame, image, cap,
    show(index) { k = index; paint(); },
    get index() { return k; },
    setMarks(fn) { marks = fn; paint(); },
  };
}

/** Alternate a figure between frame indices; auto-blinks unless reduced motion. Returns the tools row. */
function blinker(sky, indices, { auto = !reducedMotion, label } = {}) {
  let i = 0, timer = null;
  const flip = () => { i = (i + 1) % indices.length; sky.show(indices[i]); sky.cap.textContent = label ? label(indices[i]) : tr("ui.image", { n: indices[i] + 1 }); };
  const flipBtn = el("button", { type: "button", textContent: tr("ui.flip") });
  const playBtn = el("button", { type: "button" });
  const setPlay = (on) => { clearInterval(timer); timer = on ? setInterval(flip, 600) : null; playBtn.textContent = on ? tr("ui.pause") : tr("ui.play"); playBtn.setAttribute("aria-pressed", String(on)); };
  flipBtn.addEventListener("click", () => { setPlay(false); flip(); });
  playBtn.addEventListener("click", () => setPlay(!timer));
  sky.show(indices[0]); sky.cap.textContent = label ? label(indices[0]) : tr("ui.image", { n: indices[0] + 1 });
  setPlay(auto);
  state.cleanup.push(() => clearInterval(timer));
  return el("div", { className: "visual-tools" }, flipBtn, playBtn);
}

/** A one-question multiple choice. options: [{ key, right }]. */
function choice(options, { ok, no }) {
  const fb = el("p", { className: "feedback", role: "status" });
  const box = el("div", { className: "answers" }, ...options.map((o) => {
    const b = el("button", { type: "button", textContent: tr(o.key) });
    b.addEventListener("click", () => { b.dataset.result = o.right ? "right" : "wrong"; fb.textContent = o.right ? tr(ok) : tr(no ?? ok); if (o.right) $("next").focus(); });
    return b;
  }));
  return [box, fb];
}

// ---- the steps ----
const BUILD = {
  async intro() {
    return [...choice([{ key: "still.a1", right: true }, { key: "still.a2" }, { key: "still.a3" }], { ok: "still.ok", no: "still.no" })];
  },
  async pair(loaded) {
    const [a, b] = pairFrames(loaded.sequence.frames);
    const left = skyFigure(loaded), right = skyFigure(loaded);
    const vis = el("div", { className: "visual two" }, left.fig, right.fig);
    requestAnimationFrame(() => { left.show(a); right.show(b); left.cap.textContent = loaded.sequence.frames[a].dateISO.slice(0, 10); right.cap.textContent = loaded.sequence.frames[b].dateISO.slice(0, 10); });
    return [vis, ...choice([{ key: "pair.a1", right: true }, { key: "pair.a2", right: true }], { ok: "pair.ok" })];
  },
  async blink(loaded) {
    const sky = skyFigure(loaded), pair = pairFrames(loaded.sequence.frames);
    const vis = el("div", { className: "visual" }, sky.fig);
    let tools = null;
    requestAnimationFrame(() => { tools = blinker(sky, pair, { label: (k) => loaded.sequence.frames[k].dateISO.slice(0, 10) }); vis.append(tools); });
    return [vis, ...choice([{ key: "blink.a1", right: true }, { key: "blink.a2" }], { ok: "blink.ok", no: "blink.no" })];
  },
  async hunt(loaded) {
    const sky = skyFigure(loaded, { tappable: true }), pair = pairFrames(loaded.sequence.frames);
    const vis = el("div", { className: "visual" }, sky.fig);
    const fb = el("p", { className: "feedback", role: "status" }), left = el("p", { className: "note" });
    const again = el("button", { type: "button", className: "ghost", textContent: tr("hunt.again"), hidden: true });
    const truthAt = (k) => { const yr = (loaded.sequence.frames[k].mjd - loaded.sequence.truth.mjdRef) / 365.25; return loaded.sequence.truth.movers.map((m) => ({ x: m.x + m.vxPxPerYr * yr, y: m.y + m.vyPxPerYr * yr })); };
    const marks = (k) => {
      const out = [];
      if (state.guess && state.guess.frame === k) out.push({ x: state.guess.x, y: state.guess.y, kind: "guess", shape: "dot" });
      if (state.hunt.done && !state.hunt.score) for (const p of truthAt(k)) out.push({ ...p, kind: "truth", shape: "cross", radiusPx: 3 });
      return out;
    };
    const update = () => {
      left.textContent = state.hunt.done ? "" : tr("hunt.tries", { left: MAX_TRIES - state.hunt.tries });
      again.hidden = !state.hunt.done;
      sky.setMarks(marks);
    };
    sky.frame.addEventListener("click", (e) => {
      if (state.hunt.done) return;
      const p = eventToPixel(e, sky.image, loaded.sequence.grid.n), k = sky.index;
      state.guess = { ...p, frame: k };
      state.hunt = huntGuess(state.hunt, p, loaded.sequence.truth, loaded.sequence.frames[k].mjd);
      const r = state.hunt.last;
      fb.textContent = r.hit ? tr("hunt.hit", { points: state.hunt.score, tries: state.hunt.tries }) : state.hunt.done ? tr("hunt.out") : tr(`hunt.${warmth(r.distancePx)}`);
      update();
    });
    again.addEventListener("click", () => { state.hunt = newHunt(); state.guess = null; fb.textContent = ""; update(); });
    requestAnimationFrame(() => { vis.append(blinker(sky, pair)); update(); });
    return [vis, left, fb, again];
  },
  async found(loaded) {
    const sky = skyFigure(loaded), pair = pairFrames(loaded.sequence.frames), set = loaded.candidates;
    const vis = el("div", { className: "visual" }, sky.fig);
    const marks = (k) => {
      const out = (set?.candidates ?? []).map((c) => ({ ...candidateAt(c, loaded.sequence.frames[k].mjd), kind: "candidate", shape: "ring", radiusPx: 2.6 }));
      if (state.guess && state.guess.frame === k) out.push({ x: state.guess.x, y: state.guess.y, kind: "guess", shape: "dot" });
      return out;
    };
    requestAnimationFrame(() => { sky.setMarks(marks); vis.append(blinker(sky, pair)); });
    return [vis, el("p", { textContent: tr("found.count", { n: set?.candidates.length ?? 0 }) }),
      ...choice([{ key: "found.a1", right: true }, { key: "found.a2", right: true }], { ok: "found.ok" })];
  },
  async checklist(loaded) {
    const set = loaded.candidates, fastest = [...(set?.candidates ?? [])].sort((a, b) => b.speedPx - a.speedPx)[0];
    if (!fastest) return [el("p", { className: "failure", textContent: "No candidate to check." })];
    const items = checklist(fastest, set, loaded.masks);
    const rows = items.map((it) => {
      const box = el("input", { type: "checkbox" }), verdict = el("span", { className: "verdict" });
      return { it, box, verdict, label: el("label", {}, box, el("span", {}, tr(`planet.${it.id}`), verdict)) };
    });
    const fb = el("p", { className: "feedback", role: "status" });
    const check = el("button", { type: "button", className: "primary", textContent: tr("planet.check") });
    check.addEventListener("click", () => {
      for (const r of rows) r.verdict.textContent = r.it.passed === null ? tr("planet.unchecked") : r.it.passed ? tr("planet.yes") : tr("planet.no");
      fb.textContent = tr("planet.ok");
    });
    return [el("div", { className: "checks" }, ...rows.map((r) => r.label)), check, fb];
  },
  async far(loaded) {
    const sky = skyFigure(loaded), pair = pairFrames(loaded.sequence.frames), truth = loaded.sequence.truth, names = ["A", "B"];
    const vis = el("div", { className: "visual" }, sky.fig);
    const marks = (k) => truth.movers.map((m, i) => { const yr = (loaded.sequence.frames[k].mjd - truth.mjdRef) / 365.25; return { x: m.x + m.vxPxPerYr * yr, y: m.y + m.vyPxPerYr * yr, kind: "candidate", shape: "ring", radiusPx: 2.6, label: names[i] }; });
    requestAnimationFrame(() => { sky.setMarks(marks); vis.append(blinker(sky, pair)); });
    const answer = fartherMover(truth).index, fb = el("p", { className: "feedback", role: "status" });
    const box = el("div", { className: "answers" }, ...truth.movers.map((_, i) => {
      const b = el("button", { type: "button", textContent: tr("far.a", { name: names[i] }) });
      b.addEventListener("click", () => { b.dataset.result = i === answer ? "right" : "wrong"; fb.textContent = i === answer ? tr("far.ok", { name: names[i] }) : tr("far.no"); });
      return b;
    }));
    return [vis, box, fb];
  },
  async explore() {
    const summaries = (await state.client.listSequences()).filter((s) => s.pixelsServed);
    const select = el("select", { id: "explore-field" }, ...summaries.map((s) => el("option", { value: s.sequenceId, textContent: `${s.dataKind === "synthetic" ? tr("ui.synthetic") : "REAL"} · ${s.title}` })));
    const holder = el("div", { className: "visual" });
    const show = async () => {
      state.cleanup.splice(0).forEach((f) => f());
      const loaded = await getLoaded(select.value), sky = skyFigure(loaded);
      holder.replaceChildren(sky.fig);
      requestAnimationFrame(() => holder.append(blinker(sky, loaded.sequence.frames.map((_, k) => k), { label: (k) => `${tr("ui.image", { n: k + 1 })} · ${loaded.sequence.frames[k].dateISO.slice(0, 10)}` })));
      header.setBadges({ health: state.health, sequence: loaded.sequence });
    };
    select.addEventListener("change", show);
    const link = el("a", { href: `science.html${keepQuery(location.search)}`, className: "primary", textContent: tr("ui.toScience") });
    link.addEventListener("click", () => { try { localStorage.setItem("blink4.view", "science"); } catch { /* not remembered */ } });
    setTimeout(show, 0);
    const sheet = el("a", { href: `learn-worksheet.html?lang=${state.lang}`, className: "ghost", textContent: tr("ui.worksheet") });
    return [el("label", {}, tr("explore.field") + " ", select), holder, link, sheet];
  },
};

// ---- rendering one step ----
async function render() {
  state.cleanup.splice(0).forEach((f) => f());
  const step = STEPS[state.step], section = $("step");
  document.documentElement.lang = state.lang;
  history.replaceState(null, "", `learn.html${keepQuery(location.search, { step: state.step + 1, lang: state.lang })}`);
  header.refreshLinks();
  renderChrome();
  const title = el("h1", { id: "step-title", textContent: tr(`${step.id}.title`) });
  const parts = [title, el("p", { className: "lead", textContent: tr(`${step.id}.text`) })];
  if (step.id !== "explore") parts.push(el("p", { className: "question", textContent: tr(`${step.id}.q`) }));
  section.replaceChildren(...parts, el("p", { className: "note", textContent: tr("ui.loading") }));
  try {
    if (!state.client) throw new Error(state.healthError);
    const loaded = step.sequence ? await getLoaded(step.sequence) : null;
    if (loaded && !loaded.arrays) throw new Error(loaded.pixelsProblem);
    const body = await BUILD[step.kind](loaded);
    if (loaded) header.setBadges({ health: state.health, sequence: loaded.sequence });
    else if (step.kind === "intro") header.setBadges({ health: state.health });
    section.replaceChildren(...parts, ...body, loaded ? el("p", { className: "note", textContent: tr("ui.syntheticNote") }) : null);
    if (step.kind === "intro") section.append(el("p", { className: "note", textContent: tr("ui.syntheticNote") }));
  } catch (err) {
    section.replaceChildren(...parts, el("p", { className: "failure" }, el("strong", { textContent: tr("ui.failed") + " " }), err.message ?? String(err)));
  }
}

function renderChrome() {
  $("stepper-list").replaceChildren(...progress(state.step).map((p) => {
    const a = el("a", { href: `learn.html${keepQuery(location.search, { step: p.index + 1 })}` });
    a.dataset.state = p.state;
    a.setAttribute("aria-label", `${tr("ui.step", { n: p.index + 1, total: STEPS.length })}: ${tr(`${p.id}.title`)}${p.state === "done" ? " ✓" : ""}`);
    if (p.state === "current") a.setAttribute("aria-current", "step");
    a.addEventListener("click", (e) => { e.preventDefault(); go(p.index); });
    return el("li", {}, a);
  }));
  $("stepper").setAttribute("aria-label", tr("ui.progress"));
  $("stepper-count").textContent = tr("ui.step", { n: state.step + 1, total: STEPS.length });
  $("back").textContent = tr("ui.back"); $("back").disabled = state.step === 0;
  $("next").textContent = tr("ui.next"); $("next").disabled = state.step === STEPS.length - 1;
  $("open-glossary").textContent = tr("ui.glossary"); $("close-glossary").textContent = tr("ui.close"); $("glossary-title").textContent = tr("ui.glossary");
  $("glossary-list").replaceChildren(...GLOSSARY_KEYS.flatMap((k) => { const s = tr(k), i = s.indexOf(":"); return [el("dt", { textContent: s.slice(0, i) }), el("dd", { textContent: s.slice(i + 1).trim() })]; }));
  for (const b of document.querySelectorAll("[data-lang]")) b.setAttribute("aria-pressed", String(b.dataset.lang === state.lang));
}

function go(index) {
  state.step = Math.max(0, Math.min(STEPS.length - 1, index));
  render().then(() => $("step").focus());
}

// ---- start ----
$("back").addEventListener("click", () => go(state.step - 1));
$("next").addEventListener("click", () => go(state.step + 1));
$("open-glossary").addEventListener("click", () => $("glossary").showModal());
for (const b of document.querySelectorAll("[data-lang]")) b.addEventListener("click", () => { state.lang = b.dataset.lang; store.set(LANG_KEY, state.lang); render(); });

(async () => {
  const api = parseApiParam(query.api);
  if (api.problem) { state.healthError = api.problem; header.setBadges({ healthError: api.problem }); return render(); }
  const client = createClient({ api: api.api, staticBase: new URL("data/edu/", document.baseURI).href });
  try { state.health = await client.health(); state.client = client; header.setBadges({ health: state.health }); }
  catch (err) { state.healthError = `${err.message} Nothing is shown in its place.`; header.setBadges({ healthError: err.message }); }
  render();
})();
