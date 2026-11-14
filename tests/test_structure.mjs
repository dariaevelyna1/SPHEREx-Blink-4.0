// The hard acceptance test of the brief: Science and Learn are DIFFERENT STRUCTURES, not two skins of one page.
// Reads the two HTML shells and the scripts they load. Fails unless: different landmark sequences; Science = nav + main + aside + timeline
// region as siblings of one grid, no stepper; Learn = a stepper list + one step section + a dialog, no aside, no candidate table; neither page
// holds the other's root container or loads the other's stylesheet or scripts; the switch is a link between two documents.
import { readFileSync } from "node:fs";
import { check, done } from "./_t.mjs";

const read = (p) => readFileSync(new URL(`../frontend/${p}`, import.meta.url), "utf8");
const sci = read("science.html"), learn = read("learn.html");
const body = (html) => html.slice(html.indexOf("<body"));
const landmarks = (html) => [...body(html).matchAll(/<(header|nav|main|aside|footer|section|dialog)\b/g)].map((m) => m[1]);

const ls = landmarks(sci), ll = landmarks(learn);
check("the landmark sequences differ", ls.join() !== ll.join(), `${ls.join()} / ${ll.join()}`);
check("different body classes", /class="workspace-page"/.test(sci) && /class="story-page"/.test(learn));

// Science: one grid container with nav, main, aside, timeline as direct children
const ws = body(sci).match(/<div class="workspace" id="workspace">([\s\S]*)<\/div>\s*<noscript/);
check("Science has the workspace grid", !!ws);
const top = (inner) => { const out = []; let depth = 0; for (const m of inner.matchAll(/<(\/?)(nav|main|aside|section|div|fieldset|form|table|dl|ol|ul|p|span|label|h1|h2|canvas|button|input|output|caption|thead|tbody|tr|th|td|dt|dd|li|legend|kbd|small)\b[^>]*?(\/?)>/g)) {
  const [, close, tag, self] = m; if (["input"].includes(tag) || self) { if (depth === 0) out.push(tag); continue; }
  if (close) depth--; else { if (depth === 0) out.push(tag + (m[0].match(/id="([^"]+)"/)?.[1] ? "#" + m[0].match(/id="([^"]+)"/)[1] : "")); depth++; } } return out; };
const kids = ws ? top(ws[1]) : [];
check("Science grid children are nav, main, aside, timeline section", kids.join() === "nav#controls,main#viewer,aside#inspector,section#timeline", kids.join());
check("Science has the candidate table and inspector", /id="candidates"/.test(sci) && /<aside[^>]*id="inspector"/.test(sci));
check("Science has no stepper", !/stepper/.test(sci) && !/aria-current="step"/.test(sci));

// Learn: stepper (ol inside nav), exactly one step section in main, a dialog, no aside, no candidate table
check("Learn has a stepper nav with an ordered list", /<nav class="stepper"[\s\S]*?<ol id="stepper-list"/.test(learn));
check("Learn main holds exactly one section", (body(learn).match(/<main[\s\S]*?<\/main>/)?.[0].match(/<section\b/g) ?? []).length === 1);
check("Learn has a glossary dialog", /<dialog id="glossary"/.test(learn));
check("Learn has no aside and no candidate table", !/<aside\b/.test(learn) && !/id="candidates"/.test(learn) && !/cand-table/.test(learn));
check("Learn has no workspace panels", !/class="workspace"/.test(learn) && !/panel-/.test(learn));
check("Science does not hold Learn's root", !/id="stepper"/.test(sci) && !/class="story"/.test(sci));

// stylesheets and scripts are their own
const sheets = (html) => [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
check("science.html does not load learn.css", !sheets(sci).includes("css/learn.css") && sheets(sci).includes("css/science.css"));
check("learn.html does not load science.css", !sheets(learn).includes("css/science.css") && sheets(learn).includes("css/learn.css"));
check("each page loads its own entry script", /src="js\/science\/main.js"/.test(sci) && /src="js\/learn\/main.js"/.test(learn) && !/js\/learn\//.test(sci) && !/js\/science\//.test(learn));
const sciJs = read("js/science/main.js"), learnJs = read("js/learn/main.js");
check("the view scripts do not import each other", !/\.\.\/learn\//.test(sciJs) && !/\.\.\/science\//.test(learnJs));

// the switch is a link to the other document, not a class toggle
check("Science's switch links to learn.html", /<a href="learn.html" data-view-link="learn"/.test(sci));
check("Learn's switch links to science.html", /<a href="science.html" data-view-link="science"/.test(learn));
check("no view toggle by class or hidden DOM", !/classList\.(toggle|add)\(["'](learn|science)/.test(sciJs + learnJs));

// different navigation models in the code
check("Science navigates by selection (timeline ticks, candidate rows)", /goTo\(/.test(sciJs) && /selectCandidate\(/.test(sciJs));
check("Learn navigates by steps (?step=, back/next)", /step: state.step \+ 1/.test(learnJs) && /go\(state.step \+ 1\)/.test(learnJs));

// both show the two badges in the header
for (const [name, html] of [["science", sci], ["learn", learn]]) check(`${name}: both badges in the header`, /<header[\s\S]*id="badge-data"[\s\S]*id="badge-backend"[\s\S]*<\/header>/.test(html));

done();
