// learn/strings.js: every sentence of the Learn view, in English and Romanian. tests/test_learn.mjs checks that both tables have the
// same keys. Keep sentences short: one idea per step. The Tombaugh/Pluto story is from memory and is marked [unverified] until checked.

export const LANGS = ["en", "ro"];

export const STRINGS = {
  en: {
    "ui.back": "Back", "ui.next": "Next", "ui.glossary": "Glossary", "ui.close": "Close", "ui.step": "Step {n} of {total}",
    "ui.synthetic": "SYNTHETIC", "ui.lang": "Language", "ui.progress": "Your progress", "ui.flip": "Flip", "ui.play": "Blink", "ui.pause": "Stop",
    "ui.image": "image {n}", "ui.toScience": "Open the Science workspace", "ui.worksheet": "Classroom worksheet (printable)", "ui.loading": "Loading the pictures…", "ui.failed": "The pictures did not load:",
    "ui.syntheticNote": "Made by our code, not taken by a telescope. It has a hidden answer, so you can check yourself.",

    "still.title": "The sky is not still", "still.text": "Stars are so far away that they seem fixed. Things in our own Solar System are close, so they drift across the stars.",
    "still.q": "Which of these could move in a photo of the sky, months later?",
    "still.a1": "An asteroid", "still.a2": "A distant galaxy", "still.a3": "The pattern of the stars",
    "still.ok": "Yes. An asteroid orbits the Sun, so it changes place against the stars.", "still.no": "Not quite: that is so far away it looks fixed. Try another.",

    "pair.title": "Two photos, months apart", "pair.text": "SPHEREx, a NASA space telescope, photographs the whole sky again and again. These two pictures show the same place, months apart.",
    "pair.q": "Can you see what changed?", "pair.a1": "Yes, I found it", "pair.a2": "Not sure",
    "pair.ok": "Side by side it is hard on purpose. The next step shows a trick.",

    "blink.title": "Blink!", "blink.text": "Show the two pictures one after the other, in the same place. Stars stay put. A thing that moved jumps.",
    "blink.q": "Did something jump?", "blink.a1": "Yes", "blink.a2": "No",
    "blink.ok": "That jump is a mover. Astronomers have blinked photos like this for about a hundred years [unverified: the Pluto story, 1930].", "blink.no": "Look again near the lower left. Use Flip slowly.",

    "hunt.title": "Hunt the mover", "hunt.text": "This field hides a mover. Blink it, then tap where the mover is in the picture you see.",
    "hunt.q": "Tap the dot that jumps.", "hunt.hit": "Hit! {points} points, {tries} tap(s).", "hunt.cold": "Not there: far away.", "hunt.near": "Closer, but not there.",
    "hunt.warm": "Very close!", "hunt.out": "Out of tries. The green cross shows where it was.", "hunt.tries": "Tries left: {left}", "hunt.again": "Play again",

    "found.title": "What the computer found", "found.text": "We ran the same search a scientist would use on these pictures. Amber rings are what it found; blue is your tap.",
    "found.q": "Did the computer agree with you?", "found.count": "It found {n} mover(s).", "found.a1": "Yes", "found.a2": "No",
    "found.ok": "Good. A computer can check thousands of fields, but people still look at every lead.",

    "planet.title": "Is it a planet?", "planet.text": "A dot that moves is only a lead. Before anyone says “new planet”, it must pass tests.",
    "planet.q": "Which tests did our fastest dot pass?", "planet.check": "Check",
    "planet.line": "Its positions lie on a straight line", "planet.passes": "It was seen in at least 3 visits",
    "planet.pixel": "It is not a bad pixel of the camera", "planet.known": "It is not an asteroid we already know",
    "planet.yes": "passed", "planet.no": "failed", "planet.unchecked": "not checked in this app (real work asks a catalogue of known asteroids)",
    "planet.ok": "So it is a good lead, not a discovery. A lead becomes a discovery only after more observations.",

    "far.title": "How far is it?", "far.text": "A nearby body races across the sky. A far one creeps. (This is true for bodies on similar orbits.)",
    "far.q": "Which mover is farther away?", "far.a": "Mover {name}", "far.ok": "Yes: {name} moves slower on the sky, so it is probably farther.",
    "far.no": "Look again: which one moves less between blinks?",

    "explore.title": "Explore freely", "explore.text": "Now blink any field yourself. When you want numbers, errors and where each picture comes from, open the Science workspace.",
    "explore.field": "Field",

    "gloss.blink": "Blink: showing two or more pictures of the same place one after another, so that a change jumps out.",
    "gloss.mover": "Mover: a dot that changes place between pictures taken at different times.",
    "gloss.spherex": "SPHEREx: a NASA space telescope that maps the whole sky in infrared light, several times.",
    "gloss.pass": "Visit (survey pass): one round in which the telescope photographs a place; the next one comes months later.",
    "gloss.candidate": "Candidate: a mover found by the computer. It is a lead, never a discovery by itself.",
    "gloss.synthetic": "Synthetic: made by our code with a known answer, not observed by a telescope.",
    "gloss.pixel": "Pixel: one small square of a digital picture. Here one pixel is about 6 arcseconds of sky.",
  },
  ro: {
    "ui.back": "Înapoi", "ui.next": "Înainte", "ui.glossary": "Glosar", "ui.close": "Închide", "ui.step": "Pasul {n} din {total}",
    "ui.synthetic": "SINTETIC", "ui.lang": "Limba", "ui.progress": "Progresul tău", "ui.flip": "Schimbă", "ui.play": "Clipește", "ui.pause": "Oprește",
    "ui.image": "imaginea {n}", "ui.toScience": "Deschide spațiul de lucru Science", "ui.worksheet": "Fișă de lucru pentru clasă (de tipărit)", "ui.loading": "Se încarcă imaginile…", "ui.failed": "Imaginile nu s-au încărcat:",
    "ui.syntheticNote": "Făcută de codul nostru, nu fotografiată de un telescop. Are un răspuns ascuns, ca să te poți verifica.",

    "still.title": "Cerul nu stă pe loc", "still.text": "Stelele sunt atât de departe încât par fixe. Corpurile din Sistemul nostru Solar sunt aproape, așa că alunecă printre stele.",
    "still.q": "Care dintre acestea s-ar putea mișca într-o fotografie a cerului, luni mai târziu?",
    "still.a1": "Un asteroid", "still.a2": "O galaxie îndepărtată", "still.a3": "Desenul stelelor",
    "still.ok": "Da. Un asteroid se rotește în jurul Soarelui, deci își schimbă locul față de stele.", "still.no": "Nu chiar: e atât de departe încât pare fix. Mai încearcă.",

    "pair.title": "Două fotografii, la luni distanță", "pair.text": "SPHEREx, un telescop spațial NASA, fotografiază tot cerul din nou și din nou. Cele două imagini arată același loc, la luni distanță.",
    "pair.q": "Vezi ce s-a schimbat?", "pair.a1": "Da, l-am găsit", "pair.a2": "Nu sunt sigur",
    "pair.ok": "Una lângă alta e greu, intenționat. Pasul următor îți arată un truc.",

    "blink.title": "Clipește!", "blink.text": "Arată cele două imagini una după alta, în același loc. Stelele rămân pe loc. Ce s-a mișcat sare.",
    "blink.q": "A sărit ceva?", "blink.a1": "Da", "blink.a2": "Nu",
    "blink.ok": "Acel salt e un corp în mișcare. Astronomii compară așa fotografii de aproximativ o sută de ani [neverificat: povestea lui Pluto, 1930].", "blink.no": "Uită-te din nou în stânga jos. Apasă Schimbă încet.",

    "hunt.title": "Vânează corpul în mișcare", "hunt.text": "Câmpul acesta ascunde un corp în mișcare. Clipește imaginile, apoi atinge locul unde e corpul în imaginea pe care o vezi.",
    "hunt.q": "Atinge punctul care sare.", "hunt.hit": "Ai nimerit! {points} puncte, {tries} atingeri.", "hunt.cold": "Nu acolo: departe.", "hunt.near": "Mai aproape, dar nu acolo.",
    "hunt.warm": "Foarte aproape!", "hunt.out": "Nu mai ai încercări. Crucea verde arată unde era.", "hunt.tries": "Încercări rămase: {left}", "hunt.again": "Joacă din nou",

    "found.title": "Ce a găsit calculatorul", "found.text": "Am rulat pe aceste imagini aceeași căutare pe care ar folosi-o un cercetător. Inelele portocalii sunt ce a găsit; albastru e atingerea ta.",
    "found.q": "Calculatorul a fost de acord cu tine?", "found.count": "A găsit {n} corp(uri) în mișcare.", "found.a1": "Da", "found.a2": "Nu",
    "found.ok": "Bine. Un calculator poate verifica mii de câmpuri, dar oamenii se uită în continuare la fiecare pistă.",

    "planet.title": "E o planetă?", "planet.text": "Un punct care se mișcă e doar o pistă. Înainte ca cineva să spună „planetă nouă”, trebuie să treacă niște teste.",
    "planet.q": "Ce teste a trecut punctul nostru cel mai rapid?", "planet.check": "Verifică",
    "planet.line": "Pozițiile lui stau pe o linie dreaptă", "planet.passes": "A fost văzut în cel puțin 3 vizite",
    "planet.pixel": "Nu e un pixel defect al camerei", "planet.known": "Nu e un asteroid deja cunoscut",
    "planet.yes": "trecut", "planet.no": "picat", "planet.unchecked": "neverificat în această aplicație (în practică se consultă un catalog de asteroizi cunoscuți)",
    "planet.ok": "Deci e o pistă bună, nu o descoperire. O pistă devine descoperire doar după alte observații.",

    "far.title": "Cât de departe e?", "far.text": "Un corp apropiat aleargă pe cer. Unul îndepărtat se târăște. (Asta e adevărat pentru corpuri pe orbite asemănătoare.)",
    "far.q": "Care corp e mai departe?", "far.a": "Corpul {name}", "far.ok": "Da: {name} se mișcă mai încet pe cer, deci probabil e mai departe.",
    "far.no": "Uită-te din nou: care se mută mai puțin între clipiri?",

    "explore.title": "Explorează liber", "explore.text": "Acum clipește singur orice câmp. Când vrei cifre, erori și proveniența fiecărei imagini, deschide spațiul de lucru Science.",
    "explore.field": "Câmp",

    "gloss.blink": "Clipire (blink): arătarea a două sau mai multe imagini ale aceluiași loc una după alta, ca o schimbare să sară în ochi.",
    "gloss.mover": "Corp în mișcare: un punct care își schimbă locul între imagini făcute la momente diferite.",
    "gloss.spherex": "SPHEREx: un telescop spațial NASA care cartografiază tot cerul în lumină infraroșie, de mai multe ori.",
    "gloss.pass": "Vizită (trecere a survey-ului): o rundă în care telescopul fotografiază un loc; următoarea vine după luni.",
    "gloss.candidate": "Candidat: un corp în mișcare găsit de calculator. E o pistă, niciodată o descoperire în sine.",
    "gloss.synthetic": "Sintetic: făcut de codul nostru, cu un răspuns cunoscut, nu observat de un telescop.",
    "gloss.pixel": "Pixel: un pătrățel al unei imagini digitale. Aici un pixel cuprinde cam 6 secunde de arc de cer.",
  },
};

/** t(lang, key, vars): the sentence, with {name} placeholders filled. A missing key returns the key itself (visible, so tests catch it). */
export function t(lang, key, vars = {}) {
  const s = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export const GLOSSARY_KEYS = ["gloss.blink", "gloss.mover", "gloss.spherex", "gloss.pass", "gloss.candidate", "gloss.synthetic", "gloss.pixel"];

/** The shared header's badge words in the page language. Exact sentences first, then single words of the backend label. */
const BADGE_RO = {
  "SYNTHETIC": "SINTETIC", "REAL": "REAL", "NO DATA": "FĂRĂ DATE", "Data": "Date", "Backend": "Server",
  "Made by this project's code. Not an observation.": "Făcut de codul acestui proiect. Nu este o observație.",
  "No sequence is loaded.": "Nicio secvență încărcată.",
  "Processed SPHEREx observations.": "Observații SPHEREx procesate.",
  "Processed SPHEREx observations: derived numbers only, no pixels served.": "Observații SPHEREx procesate: doar cifre derivate, fără pixeli.",
};
const BADGE_WORDS_RO = [[/\bbackend\b/g, "server"], [/\bunreachable\b/g, "inaccesibil"], [/\bproblem\b/g, "problemă"], [/\bchecking\b/g, "se verifică"]];
export function translateBadge(lang, text) {
  if (lang !== "ro" || typeof text !== "string") return text;
  if (text in BADGE_RO) return BADGE_RO[text];
  return BADGE_WORDS_RO.reduce((s, [re, to]) => s.replace(re, to), text);
}
