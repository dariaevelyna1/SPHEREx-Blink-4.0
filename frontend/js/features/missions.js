// missions.js – the Cosmic Missions database and its random picker (pure: no DOM, no network; storage and the random source are injectable).
//
// Every mission sends the learner to a tool that already exists in the workspace. `target` says what a mission loads:
//   { kind: "demo" }                         the synthetic demo field (no query string; always labelled synthetic in the page)
//   { kind: "query", query: "ra=..&..." }    a field by URL query (real only with ?data=api and a backend; otherwise the synthetic demo is shown)
//   { kind: "section", hash: "#planet-lab" } a panel of the workspace
// The physics in `successFeedback` is textbook material written from memory (marked "from memory" in docs/SCIENTIFIC_LIMITATIONS.md), not a measurement.

export const MISSIONS_VERSION = "missions-1";

const BARNARD = "ra=269.4462&dec=4.769&fov=5&det=D2";   // the Barnard's Star field used throughout docs/VALIDATION.md

export const CATEGORIES = Object.freeze({
  blink: "Blink method / moving asteroids",
  proper: "Proper motion / fast stars",
  parallax: "Parallax & distance",
  infrared: "Deep infrared / Planet X simulations",
  method: "Doing science honestly",
});

export const missionsDatabase = Object.freeze([
  // ---------- 1. blink
  { id: "blink-first-look", category: CATEGORIES.blink, tier: 1, title: "First Blink",
    story: "In 1930 Clyde Tombaugh found Pluto by flipping between two photographs of the same sky. Stars stay put; anything that jumps is moving. Your turn.",
    targetType: "demo", target: { kind: "demo" },
    objective: "Press Play under the picture and watch the images blink. Find one dot that changes place.",
    successFeedback: "Blinking turns motion into flicker: the eye ignores what stays fixed and notices what jumps. Every mover search in this app starts from this idea." },
  { id: "blink-difference", category: CATEGORIES.blink, tier: 1, title: "Ghost Hunter",
    story: "Subtract one image from the next and the stars cancel out. What is left behind is a ghost: a bright spot where something arrived and a dark one where it left.",
    targetType: "demo", target: { kind: "demo" },
    objective: "Switch the view to Difference and find a bright/dark pair of spots.",
    successFeedback: "A difference image removes everything that did not change. A bright-dark pair is the signature of a moving object; a lone spot may be noise, a cosmic ray or a variable star." },
  { id: "blink-find-movers", category: CATEGORIES.blink, tier: 2, title: "Let the Machine Look",
    story: "Your eyes got tired. The computer can test every possible straight path across every image in seconds.",
    targetType: "demo", target: { kind: "demo" },
    objective: "Press Find movers and open the first candidate in the list.",
    successFeedback: "The search links dots across images into straight tracks and asks how unlikely each track is by chance. What it returns is a candidate: a lead to check, not a discovery." },
  { id: "blink-asteroid-check", category: CATEGORIES.blink, tier: 2, title: "Is It Already Known?",
    story: "Thousands of asteroids cross the sky every night. Before you get excited, find out whether someone named yours already.",
    targetType: "demo", target: { kind: "demo" },
    objective: "Select a mover and read its asteroid check (the known-object line in its description).",
    successFeedback: "Professional surveys always compare against catalogues of known objects first (SkyBoT for asteroids, SIMBAD and Gaia for stars). A match is not a failure: it shows the pipeline works." },

  // ---------- 2. proper motion
  { id: "proper-barnard", category: CATEGORIES.proper, tier: 2, title: "The Runaway Star",
    story: "Barnard's Star is the fastest-moving star across our sky. Over a few years it slides visibly against the background.",
    targetType: "preset-coordinates", target: { kind: "query", query: BARNARD },
    objective: "Load the Barnard's Star field, press Find movers and read the speed of the top candidate in arcseconds per year.",
    successFeedback: "Proper motion is a star's sideways drift across the sky. Barnard's Star moves about 10 arcseconds a year (from memory), because it is close (about 6 light-years) and fast." },
  { id: "proper-direction", category: CATEGORIES.proper, tier: 2, title: "Which Way, Captain?",
    story: "Speed is only half the story. A navigator also needs a heading.",
    targetType: "preset-coordinates", target: { kind: "query", query: BARNARD },
    objective: "On the Barnard field, find the candidate's direction (position angle or compass point) in its description.",
    successFeedback: "Position angle is measured from north through east. Two numbers, speed and angle, describe a star's motion across the sky." },
  { id: "proper-follow", category: CATEGORIES.proper, tier: 1, title: "Lock On",
    story: "Telescopes track their targets. You can too.",
    targetType: "preset-coordinates", target: { kind: "query", query: BARNARD },
    objective: "Select a mover and press Follow it, then play the blink.",
    successFeedback: "Following a mover keeps it centred while the background streams past: you now see the sky from the star's point of view." },
  { id: "proper-spectrum", category: CATEGORIES.proper, tier: 3, title: "Colours of a Wanderer",
    story: "SPHEREx sees the sky in more than a hundred infrared colours. A moving star carries its colour with it.",
    targetType: "preset-coordinates", target: { kind: "query", query: BARNARD },
    objective: "Select a mover and press Spectrum along its path.",
    successFeedback: "A spectrum is brightness against wavelength. Cool red dwarfs like Barnard's Star are brighter in the infrared; asteroids reflect sunlight and show different colours." },

  // ---------- 3. parallax
  { id: "parallax-thumb", category: CATEGORIES.parallax, tier: 1, title: "The Thumb Trick",
    story: "Hold up a thumb and close one eye, then the other. Your thumb jumps. Earth does the same thing with stars, using its orbit as the two eyes.",
    targetType: "section", target: { kind: "section", hash: "#planet-lab" },
    objective: "Open the Planet X Lab and read how it describes the Earth's parallax swing.",
    successFeedback: "Parallax is the apparent shift of a nearby object as the observer moves. Earth's orbit gives a baseline of 2 AU (1 AU is about 150 million km)." },
  { id: "parallax-distance", category: CATEGORIES.parallax, tier: 2, title: "Ruler of the Stars",
    story: "Measure the swing, get the distance. That is how astronomers built the first rung of the cosmic distance ladder.",
    targetType: "demo", target: { kind: "demo" },
    objective: "Run Look for a distant body on the demo and read the distance the candidate's swing implies.",
    successFeedback: "Distance in parsecs = 1 / parallax in arcseconds. For a body inside the Solar System the swing is large, and its distance is usually given in AU." },
  { id: "parallax-compare", category: CATEGORIES.parallax, tier: 3, title: "Line or Wobble?",
    story: "A star drifting in a straight line and a far planet wobbling with Earth's orbit can look alike over a few nights. Over months they do not.",
    targetType: "section", target: { kind: "section", hash: "#planet-lab" },
    objective: "Select a candidate and press Compare the motions of the selected candidate in the Planet X Lab.",
    successFeedback: "Model comparison asks which explanation fits the positions best without overfitting. A parallax wobble that beats a straight line is evidence for something nearby, not proof." },

  // ---------- 4. deep infrared / Planet X
  { id: "px-hidden-body", category: CATEGORIES.infrared, tier: 2, title: "The Ninth Shadow",
    story: "Some astronomers suspect a large planet far beyond Neptune. It would be cold, dim and slow. The demo hides a simulated one for you to find.",
    targetType: "demo", target: { kind: "demo" },
    objective: "On the synthetic demo, press Look for a distant body and find the simulated body.",
    successFeedback: "This body is synthetic, injected by the demo. A real distant planet would move only a few arcseconds per day and mostly show Earth's parallax swing." },
  { id: "px-injection", category: CATEGORIES.infrared, tier: 3, title: "Could We Even See It?",
    story: "Before searching for something, scientists ask: if it were there, would our method catch it?",
    targetType: "section", target: { kind: "section", hash: "#planet-lab" },
    objective: "In the Planet X Lab, run the detection-efficiency test (synthetic bodies added to the images).",
    successFeedback: "Injection-recovery tests hide fake objects in real data and count how many are found. They measure the search; they never find anything themselves." },
  { id: "px-why-infrared", category: CATEGORIES.infrared, tier: 1, title: "Warm in the Dark",
    story: "A planet far from the Sun reflects almost no sunlight, but it still glows faintly from its own heat.",
    targetType: "section", target: { kind: "section", hash: "#telescope" },
    objective: "Read the section about the SPHEREx telescope and find the wavelength range it observes.",
    successFeedback: "Cold objects emit mostly in the infrared. That is why infrared surveys like SPHEREx and WISE are used to look for cool dwarfs and distant bodies." },
  { id: "px-sky-context", category: CATEGORIES.infrared, tier: 2, title: "Map the Neighbourhood",
    story: "A candidate never lives alone. Check what else catalogues know about that patch of sky.",
    targetType: "section", target: { kind: "section", hash: "#sky-explorer" },
    objective: "Open the sky explorer for the current field and look at the catalogue layers.",
    successFeedback: "Cross-matching with other surveys (Gaia, 2MASS, WISE) tells you whether a dot is a known star, a galaxy or something new." },

  // ---------- 5. method
  { id: "method-explain", category: CATEGORIES.method, tier: 1, title: "Ask Why",
    story: "A good scientist can explain every claim with a number.",
    targetType: "section", target: { kind: "section", hash: "#assistant" },
    objective: "Select a candidate and press Why is it a candidate?",
    successFeedback: "Each sentence of the explanation cites a measured value. If a claim cannot be traced to a number, it should not be made." },
  { id: "method-tables", category: CATEGORIES.method, tier: 1, title: "No Picture Needed",
    story: "Science is also tables. Some readers use a screen reader; others want to check the numbers.",
    targetType: "section", target: { kind: "section", hash: "#text-analysis" },
    objective: "Open Text analysis and save the candidates table as CSV.",
    successFeedback: "The CSV starts by saying whether the data are real or synthetic. Labelling data honestly is the first rule of this project." },
  { id: "method-bundle", category: CATEGORIES.method, tier: 3, title: "Prove It",
    story: "Claims of discovery need proof that others can check without trusting you.",
    targetType: "section", target: { kind: "section", hash: "#text-analysis" },
    objective: "Save a provenance bundle and find the SHA-256 hash of an image inside it.",
    successFeedback: "A hash is a fingerprint: change one pixel and it changes completely. It proves which data you used without publishing the pixels." },
  { id: "method-pin", category: CATEGORIES.method, tier: 2, title: "Report to the Board",
    story: "Observers share leads so others can confirm them, like drivers reporting a hazard on the road.",
    targetType: "section", target: { kind: "section", hash: "#pin-board" },
    objective: "Select a mover and pin it to the Discovery Pin Board with your observer name.",
    successFeedback: "A pin is a report, not a discovery: it records who saw what, where and when, so someone else can check it." },
]);

/** Pick a mission at random. `rng` returns [0,1) (Math.random by default); `avoidIds` are skipped when anything else is left (so a reload rarely repeats). */
export function pickRandomMission(rng = Math.random, avoidIds = [], db = missionsDatabase) {
  if (!db.length) return null;
  const avoid = new Set(avoidIds);
  const pool = db.filter((m) => !avoid.has(m.id));
  const from = pool.length ? pool : db;
  return from[Math.min(from.length - 1, Math.floor(rng() * from.length))];
}

/** The URL a mission opens, relative to index.html. Keeps ?data=api&api=… when the current page uses a backend. */
export function missionHref(mission, currentSearch = "") {
  const t = mission.target;
  const keep = new URLSearchParams(currentSearch);
  const p = new URLSearchParams();
  for (const k of ["data", "api", "theme"]) if (keep.has(k)) p.set(k, keep.get(k));
  if (t.kind === "query") for (const [k, v] of new URLSearchParams(t.query)) p.set(k, v);
  const qs = p.toString();
  return `index.html${qs ? "?" + qs : "?mode=blink"}${t.kind === "section" ? t.hash : ""}`;
}

const KEY = "spherex-blink-missions";

/** Progress kept in the browser: { completed: [ids], recent: [ids] }. `storage` is a localStorage-like object; any failure gives empty progress. */
export function loadProgress(storage) {
  try {
    const p = JSON.parse(storage?.getItem(KEY) || "{}");
    const ids = new Set(missionsDatabase.map((m) => m.id));
    return { completed: [...new Set((p.completed || []).filter((id) => ids.has(id)))], recent: (p.recent || []).filter((id) => ids.has(id)).slice(-5) };
  } catch { return { completed: [], recent: [] }; }
}

export function saveProgress(storage, progress) {
  try { storage?.setItem(KEY, JSON.stringify(progress)); return true; } catch { return false; }
}

export function markComplete(progress, id) {
  return progress.completed.includes(id) ? progress : { ...progress, completed: [...progress.completed, id] };
}

export function noteShown(progress, id) {
  return { ...progress, recent: [...progress.recent.filter((r) => r !== id), id].slice(-5) };
}
