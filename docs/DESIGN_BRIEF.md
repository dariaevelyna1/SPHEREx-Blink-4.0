# Design brief: SPHEREx Blink 4.0

## Purpose

SPHEREx photographs the whole sky several times, months apart. Something in our own Solar System moves between those visits; the stars do not.
"Blinking" two or more images of the same place makes a mover jump. SPHEREx Blink 4.0 lets a person do that by eye and lets a tested detector do
it by numbers, and it is honest about which data is real and which is synthetic.

One site, two interfaces over the same data modules:

- **Science**: a workspace for someone who wants the numbers (a student of astronomy, a judge who asks "how do you know?").
- **Learn**: a guided story with a game for someone who has never heard of a blink comparator (a pupil, a visitor at the stand, a teacher).

They are not two skins of one page. They have different HTML shells, different landmarks, different navigation.

## Audience and what each needs

| | Science | Learn |
|---|---|---|
| Who | Astronomy students, mentors, judges | Pupils (about 11+), families, teachers |
| Device | Desktop first (>= 1100 px); usable down to a tablet | Phone first (360 px); grows to desktop |
| Wants | Everything at once, numbers with errors, provenance | One idea at a time, a thing to do, a result |
| Navigation | Select inside fixed panels; keyboard | A linear stepper: back / next; one primary action |
| Text | Terse labels, tables, units | Short sentences, a glossary drawer, Romanian and English |

## Structure 1: Science = dense workspace

One screen, no page scroll on desktop, four regions always visible together, plus a status header.

```
+----------------------------------------------------------------------------------------------+
| SPHEREx Blink | [Science]|Learn |  SYNTHETIC  | backend: edu · STATIC · ok | field name      |  header (banner)
+--------------+---------------------------------------------+---------------------------------+
| CONTROLS     | VIEWER                                      | INSPECTOR                       |
| (nav)        | (main)                                      | (aside)                         |
| Sequence  v  |   +-------------------------------------+   | Frame 4/12  f003                |
| - syn A D2   |   |                                     |   | MJD 60908.300  2025-08-21 UTC   |
| - syn B D2   |   |          canvas (dark ground)       |   | 1.31-1.35 um  D2  6.14"/px      |
| - syn C D4   |   |          crosshair, candidate rings |   | Pointer x 20.1 y 27.9           |
|              |   |                                     |   |  RA 136.5087  Dec +16.5949      |
| Mode         |   +-------------------------------------+   |  value 12.4 (no unit: synthetic)|
| (o) Blink    |   SYNTHETIC · asinh stretch · north up      | Provenance                      |
| ( ) Diff     |                                             |  origin generator synth-1 #202  |
| ( ) Stack    |                                             |  sha256 9f2c...                 |
| Speed [---]  |                                             | Candidates (movers-2)           |
| Stretch [--] |                                             |  id  "/yr  +-   n  chance       |
| [Run detector]                                             |  c01 11.8 0.4  12 1e-9  <       |
| Layers [x]..                                               |  c02 ...                        |
+--------------+---------------------------------------------+---------------------------------+
| TIMELINE (footer region): |.|.|.|   |.|.|.|   |.|.|.|   |.|.|.|   passes 1-4 · keys: <- -> space 1-9 |
+----------------------------------------------------------------------------------------------+
```

- Landmarks: `header[role=banner]`, `nav` (controls), `main` (viewer), `aside` (inspector), `footer` region (timeline). CSS grid with named areas.
- Navigation model: **selection**. Selecting a sequence, a frame (timeline), a candidate (table row) updates the other panels. Nothing is hidden
  behind a step. Keyboard: left/right = frame, space = play/pause, `1`-`9` = candidate, `d` = difference, `g` = candidate rings.
- Always on screen: the REAL/SYNTHETIC badge, the backend badge (profile, data source, status), coordinates, the frame's time and wavelength,
  the candidate table with uncertainties, the algorithm's name and version.
- Deep links: `?ra=&dec=&fov=&det=` pick the sequence that covers that place, `?api=` picks a backend, `?seq=` picks a sequence by id.

## Structure 2: Learn = guided narrative

One column. One step on screen. One primary button. Progress always visible.

```
+--------------------------------+
| Blink  [Learn]|Science  EN|RO  |  header (banner), compact
| o o o (*) o o o o   step 4 / 8 |  progress (ol, aria-current)
+--------------------------------+
|                                |
|   What moved?                  |  h1: the one idea
|                                |
|   +------------------------+   |
|   |                        |   |
|   |    large blink canvas  |   |  one large visual
|   |    SYNTHETIC           |   |
|   +------------------------+   |
|                                |
|   Tap the dot that jumps.      |  one question
|                                |
|   [   Check my answer    ]     |  one primary action
|                                |
|   < Back            Glossary   |
+--------------------------------+
```

Steps (one idea and one question each):

1. **The sky is not still.** Stars seem fixed; nearby worlds drift. *What could move in a photo of the sky?*
2. **Two photos, months apart.** SPHEREx returns to each place. *Can you spot a difference side by side?* (hard on purpose)
3. **Blink.** Flip between them and the mover jumps. *Did something jump?*
4. **Hunt the mover** (the game): a synthetic field with a hidden mover. Tap it. Score: distance to the truth, tries, time.
5. **What the detector found.** The same field, the detector's candidates next to your mark. *Did you agree with it?*
6. **Is it a planet?** A short checklist: a line of dots, in at least 3 passes, not a known asteroid, not a bad pixel. *Which of these did our dot pass?*
7. **How far is it?** Slow means far. A far body creeps; a near one races. *Which of two movers is farther?*
8. **Explore freely.** The blink player without the rails, and a door to the Science view.

- Landmarks: `header[role=banner]`, `main` containing exactly one visible `section` (the step), a `nav` that is a stepper (`ol`), a glossary `dialog`.
- Navigation model: **sequence**. Back / Next, progress dots, `?step=` in the URL. Steps are separate DOM built by the stepper, not panels of the workspace.
- Strings: a table per language (`en`, `ro`); the language toggle is in the header and remembered.
- Every picture in Learn is labelled SYNTHETIC on the picture itself.
- Mobile first: single column, 44 px targets, no hover-only behaviour; `prefers-reduced-motion` stops auto-blink (the learner flips by hand).
- Printable one-page classroom worksheet (`learn-worksheet.html`), A4, black on white.

## What both share (and only this)

- Data modules: the contract client (static bundle or API), the float-pixel loader and stretch, the reused detector, geometry, the badge model.
- Design tokens: one file of CSS custom properties (colours, type scale, spacing). Two themes: `night` (default, both views) and `paper`
  (light; the worksheet and `?theme=paper`). Contrast is tested for both. Pictures of the sky keep a dark ground in every theme.
- The site header component: project name, the view switch, the two badges.
- System fonts only (no download, no licence question).

They do not share layout CSS, page HTML or view logic: `science.html` + `css/science.css` + `js/science/`, `learn.html` + `css/learn.css` + `js/learn/`.

## The structural acceptance test (QA runs it)

`tests/test_structure.mjs` reads both HTML shells and fails unless: the two files differ in their landmark sequence; Science has `nav`, `main`,
`aside` and a timeline region as siblings in one grid and no stepper; Learn has a stepper list and a single step container and no `aside`
inspector or candidate table; neither page contains the other's root container; neither stylesheet is loaded by the other page; the switch is a
link between two documents (not a class toggle).

## View switch and deep links

- `index.html` decides: `?view=science|learn`, else the remembered choice (`localStorage`, inside try/catch), else Learn on a narrow screen and
  Science on a wide one; then it goes to `science.html` or `learn.html`, keeping `ra`, `dec`, `fov`, `det`, `api`, `seq`, `lang`.
- The header switch is one click, a plain link, and stores the choice.

## Badges (both views, every screen)

- **Data kind**: `SYNTHETIC` or `REAL`, from `Sequence.dataKind`. Never inferred, never absent. Real results shown as numbers say "REAL · derived numbers, no pixels".
- **Backend**: `profile · dataSource · status` from the health document, e.g. `edu · STATIC · ok`, `full · CLOUD · unreachable`. A failed health
  check is shown as a failure, in words, and the view does not load synthetic data in its place.

## Carried over from 3.0, and not

| Carried over (idea or code) | How |
|---|---|
| The mover detector `movers.js` (validated in 3.0) | **Code reused unchanged**, attributed, checked against 3.0's golden digests |
| `geometry.js`, `targets.js` (its dependencies) | Code reused unchanged, attributed |
| The injected-star generator of `scratch/lib_inject.mjs` (pixel-integrated Gaussian PSF) | Code reused, attributed; basis of the synthetic fields |
| The frame contract and the float/mask formats | Kept; extended (docs/DATA_CONTRACT.md) |
| Blink, difference, stack; timeline grouped by survey pass; candidate table; provenance | Re-implemented for the new shells (inspiration only, no layout or CSS copied) |
| Real results as derived numbers | A small table of numbers quoted from 3.0's validation, each with its source |

| Not carried over in the MVP | |
|---|---|
| Planet X (parallax) search and its lab, *Find everything* and the catalogue cross-match, SkyBoT overlay, spectra and photometry endpoint | Scope |
| Sky map (Aladin Lite), survey coverage, sky explorer, solar-system simulator, explainer, dossier/exports, reproducibility bundle | Scope; Aladin's GPL question avoided |
| Themes other than `night` and `paper`; web workers; trail mode; zoom/pan | Scope |
| 3.0's page layout, HTML structure and CSS | Not allowed to be copied, and not wanted |
