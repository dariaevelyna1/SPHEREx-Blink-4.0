// worksheet.js: builds the printable worksheet (learn-worksheet.html) from WORKSHEET[lang]. ?lang=ro|en, else the Learn view's
// remembered language. No data is loaded: the worksheet works on paper next to the Learn page.

import { WORKSHEET } from "./worksheetStrings.js";
import { parseQuery } from "../shared/urlState.js";

const q = parseQuery(location.search);
let remembered = null; try { remembered = localStorage.getItem("blink4.lang"); } catch { /* not remembered */ }
const lang = q.lang ?? (remembered === "ro" ? "ro" : "en");
const w = WORKSHEET[lang];
document.documentElement.lang = lang;
document.title = `SPHEREx Blink · ${w.title}`;

const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const lines = (n) => el("div", { className: "lines" }, ...Array.from({ length: n }, () => el("span")));
const box = (label) => el("label", { className: "tick" }, el("span", { className: "box", ariaHidden: "true" }), label);

const head = el("header", { className: "sheet-head" },
  el("div", {}, el("h1", { textContent: w.title }), el("p", { className: "sub", textContent: w.sub })),
  el("nav", { className: "no-print", ariaLabel: "Worksheet tools" },
    el("button", { type: "button", textContent: w.print, onclick: () => print() }),
    el("a", { href: `learn-worksheet.html?lang=${lang === "ro" ? "en" : "ro"}`, textContent: w.lang })));

const who = el("p", { className: "who" }, ...[w.name, w.klass, w.date].map((k) => el("span", {}, `${k}: `, el("span", { className: "fill" }))));

const game = el("table", { className: "game" },
  el("thead", {}, el("tr", {}, el("th", { scope: "col", textContent: "#" }), el("th", { scope: "col", textContent: w.tries }), el("th", { scope: "col", textContent: w.points }), el("th", { scope: "col", textContent: w.where }))),
  el("tbody", {}, ...[1, 2, 3].map((r) => el("tr", {}, el("td", { textContent: String(r) }), el("td"), el("td"), el("td")))));

const checks = el("table", { className: "checks" },
  el("thead", {}, el("tr", {}, el("th", { scope: "col" }), ...[w.passed, w.failed, w.notChecked].map((t) => el("th", { scope: "col", textContent: t })))),
  el("tbody", {}, ...[w.c1, w.c2, w.c3, w.c4].map((c) => el("tr", {}, el("th", { scope: "row", textContent: c }), el("td", {}, box("")), el("td", {}, box("")), el("td", {}, box(""))))));

document.getElementById("sheet").replaceChildren(
  head, who,
  el("p", { className: "open", textContent: w.open }),
  el("section", {}, el("h2", { textContent: w.q1 }), lines(2)),
  el("section", {}, el("h2", { textContent: w.q2 }), game),
  el("section", {}, el("h2", { textContent: w.q3 }), checks, el("p", { className: "q", textContent: w.q3b }), lines(2)),
  el("section", {}, el("h2", { textContent: w.q4 }), lines(1)),
  el("section", {}, el("h2", { textContent: w.q5 }), lines(3)),
  el("p", { className: "team", textContent: w.team }),
  el("p", { className: "synthetic", textContent: w.note }),
  el("footer", { className: "key" }, el("h2", { textContent: w.key }), ...[w.k1, w.k2, w.k3, w.k4, w.history].map((k) => el("p", { textContent: k }))),
);
