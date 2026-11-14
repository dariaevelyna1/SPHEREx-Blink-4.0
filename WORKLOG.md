NEXT STEP: do P8 (final submission pack: update docs/SUBMISSION.md with what really works, final report to the author in Romanian).

# WORKLOG: SPHEREx Blink 4.0

Factual log of the rebuild. One section per part (P0..P8). A new session reads the first line, then the last section, then `git status` and `git log`.
The repository wins over this file: if they disagree, check.

- Project: SPHEREx Blink 4.0, NASA Space Apps 2026 (Cluj-Napoca), challenge "Planet X and SPHEREx". Author: mateibut.
- Deadline: Sunday 15 Nov 2026, 16:00 (local).
- Real start dates (decision 5, stated honestly): the 2.0/3.0 line was started on 2026-11-05 as a practice project, before the hackathon weekend
  (source: 3.0 `CREDITS.md`). This 4.0 repository was started on 2026-11-14 (hackathon Saturday) from an empty folder; it reuses a few scientific
  modules from 3.0, listed below with attribution.
- Remote `origin` = `https://github.com/mateibut/SPHEREx-Blink-4.0` (public). **Nothing is pushed by the agent, ever.** The author pushes.
- Read-only references: `../SPHEREx-Blink-3.0` (HEAD `06ac378`) and `../../SPHEREx-Blink-2.0`. Never edited.

## Decisions that belong to the author (not decided here, defaults in force)

| # | Decision | Default in force |
|---|---|---|
| 1 | Show/serve real pixels, enable the real-data path | NO (`REAL_DATA_ENABLED=false`, `SERVE_PIXELS=false`) |
| 2 | Cloud provider | Decided: Google Cloud, project `spherex-blink`. The public link does not depend on it |
| 3 | Repository | Decided: this one. Unification with 2.0/3.0 is open |
| 4 | Verified SPHEREx data terms / acknowledgement wording; are bucket copies allowed | [unverified]; real-data path stays off |
| 5 | Eligibility of work begun before the hackathon | Start dates stated above; the author decides what to declare |
| 6 | Romania/Cluj local-impact claims | Nobody named, no partnership claimed |
| 7 | Final push and any deploy | Author only, after a fresh yes |
| 8 | Google Cloud region, bucket name/prefix, how data got there, readers, approved sequences | Placeholders; `approved_sequences.json` ships empty; bucket assumed private |

Open point: the task asks for the commit trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`, while the model doing the work is
Claude Fable 5.2. The author's line is used as written; the author can amend it.

## Reused from 3.0 (with attribution) and what is NOT carried over

Reused (details and SHA-256 in `frontend/js/core/REUSED.md`; all written by mateibut in 3.0, commit `06ac378`):

| 4.0 file | 3.0 file | How |
|---|---|---|
| `frontend/js/core/features/movers.js` | `frontend/js/features/movers.js` (`movers-2`) | unchanged, SHA-256 pinned by `tests/test_reused.mjs` |
| `frontend/js/core/geometry.js` | `frontend/js/geometry.js` | unchanged, pinned |
| `frontend/js/core/targets.js` | `frontend/js/targets.js` | unchanged, pinned |
| `frontend/js/core/inject.js` | `scratch/lib_inject.mjs` + `mulberry32` of `scratch/lib_real.mjs` | adapted (gathered in one module, bodies unchanged); equivalence = 3.0's golden digests reproduced by `tests/test_golden.mjs` |

Rewritten modules: none so far. Nothing by the 3.0 contributor Ioonut is reused (his commits touch interface files only); he is credited in `CREDITS.md`.

NOT carried over from 3.0 (MVP scope): the Planet X / parallax search and its lab (and its golden scenario), *Find everything* and the
catalogue cross-match, SkyBoT, spectra and the photometry endpoint, the sky map (Aladin Lite), survey coverage, the sky explorer, the
solar-system simulator, the explainer, dossiers and exports, the reproducibility bundle, web workers, zoom/pan, themes other than two,
the results page, the endpoints `/api/photometry`, `/api/hips`, `/api/catalogue`, `/api/survey`, `/api/observations`, `/api/footprints`,
and 3.0's whole page layout, HTML and CSS (not allowed to be copied).

## P0 setup

- 2026-11-14 11:55-12:40 (local). Status: DONE. Commit: the first commit of the repository ("P0 setup").
- WHAT: `WORKLOG.md` (created first), `docs/DATA_CONTRACT.md`, `docs/DESIGN_BRIEF.md`, `README.md`, `AGENTS.md`, `CREDITS.md`, `LICENSE` (MIT),
  `.gitignore`, `.env.example`, `scripts/prepush_check.mjs`, `scripts/run_tests.mjs`, `scripts/serve_frontend.py`, `tests/_t.mjs`, `tests/test_prepush.mjs`.
- HOW: read in 3.0: `docs/SCIENTIFIC_LIMITATIONS.md`, `docs/DATA_CHECKLIST.md`, `CREDITS.md`, `backend/app.py`, `backend/spherex/query.py`,
  `cutout.py`, `flags.py`, `floatdata.py`, `frontend/js/geometry.js`, `scratch/benchmark.mjs`, `scratch/benchmark_baseline.json`,
  `scratch/lib_inject.mjs`, parts of `frontend/js/features/movers.js` (header, the candidate shape), the first 70 lines of `docs/ARCHITECTURE.md`,
  the first 120 lines of `docs/IRSA_FACTS.md`. **Not read in full**: `docs/VALIDATION.md` (only its section headings; 1055 lines),
  `docs/CODEX_PROGRESS.md`, `docs/FEATURE_STATUS.md`. 3.0's `AGENTS.md` was taken from the copy in the parent folder.
  Tests run: `node scripts/run_tests.mjs` -> `test_prepush.mjs` 29 passed, 0 failed; prepush check PASS (14 files). No backend exists yet, so no pytest.
- WHY: the contract keeps 3.0's field names and byte formats and adds explicit sequences, because a public backend may only serve approved,
  processed sequences (building cutouts on request is the expensive operation). The prepush check also refuses e-mail addresses (only the
  no-reply address of the commit trailer and `example.com` placeholders pass) and any binary data file whose folder `CREDITS.md` does not name.
- WHAT REMAINS: everything from P1 on.

### Proposal for 3.0 (not applied; 3.0 is read-only)

`frontend/js/data/getCutouts.js` `validateFrame` should accept `provenance` as either the 3.0 string or the 4.0 object (reading
`provenance.headerCheck`), and treat `imageUrl`, `dataUrl`, `maskUrl` as optional. With that one change a 3.0 page can read a 4.0 `/api/cutouts`.

## P1 core: shared scientific modules, edu profile, static bundle

- 2026-11-14 12:40-13:25 (local). Status: DONE. Commit: "P1 core" (see `git log`).
- WHAT: `frontend/js/core/` (reused 3.0 modules + `REUSED.md`), `frontend/js/shared/` (`contract.js`, `synthField.js`, `analysis.js`,
  `dataClient.js`, `urlState.js`), `scripts/export_edu_bundle.mjs`, `scripts/report_synth.mjs`, `frontend/data/edu/` (80 generated files,
  470 KB, plus the hand-written `real_examples.json`), `backend/` (`app.py`, `blink/config.py`, `catalog.py`, `approved.py`, `limits.py`,
  `store/base.py`, `local.py`, `memory.py`, `approved_sequences.json` (empty), `requirements*.txt`, `pytest.ini`, `tests/test_edu.py`),
  `tests/test_reused|golden|synth|contract|client|bundle.mjs`, `tests/fixtures/golden_3_0.json`, `docs/VALIDATION.md`,
  `docs/SCIENTIFIC_LIMITATIONS.md`, `docs/FEATURE_STATUS.md`, `.gitattributes` (LF line endings, `.f32`/`.u8` binary).
- HOW: the three 3.0 files were copied with `tr -d '\r'` (3.0's working copy has CRLF) and their SHA-256 pinned. A Python venv was made in
  `backend/.venv` (git-ignored) and the libraries installed from PyPI (FastAPI 0.162.7, Uvicorn 0.54.0, NumPy 2.5.4, Astropy 8.0.2,
  google-cloud-storage 3.17.1, pytest 9.2.0, httpx 0.28.1); versions pinned in `backend/requirements*.txt`, licences read from package metadata.
  Tests run at the end of the part:
  - `node scripts/run_tests.mjs`: 7 files, all pass (bundle 24, client 39, contract 30, golden 4, prepush 29, reused 6, synth 58 checks); prepush check PASS.
  - `backend/.venv/Scripts/python.exe -m pytest backend -q`: 16 passed.
  - `node scripts/export_edu_bundle.mjs --check`: PASS (80 files).
  NOT run: anything in a browser (no page exists yet); nothing against a network, a cloud or the archive.
- WHY:
  - The detector is reused byte for byte instead of rewritten: it is the validated part, and "same file + same golden digests" is a stronger
    statement than any re-implementation with tolerances.
  - Synthetic frames carry float pixels like real ones (3.0's had only 8-bit pictures), so one code path serves both kinds and the picture is
    always a derived product drawn in the browser.
  - The static bundle is the same documents the API returns, so the public site needs no server; the `edu` backend serves that very folder.
  - A first draft of field A sent its mover between two stars: blended positions (up to 0.6 px off) and 0 candidates. The test was not weakened;
    the generator now keeps stars 4 px away from a mover's path, and the limitation is written down (`VALIDATION.md` section 2).
  - Starlette's test client warns that `httpx` is deprecated in favour of `httpx2`; the warning is filtered in `pytest.ini`, the tests pass.
- WHAT REMAINS: P2 onward. The `full` profile's stores/catalog paths exist in `catalog.py` but are untested until P6 (GcsStore, cache,
  retrieval, processing are not written yet; `app.make_store` imports them only when `GCS_BUCKET` is set).

## Environment change (2026-11-14, afternoon)

- The work moved from the author's Windows machine to a Mac (`~/Downloads/SPHEREx-Blink-4.0`, unpacked from the author's `nasa.zip`; history intact:
  `c5fb445` P0, `fabdacd` P1, plus the untracked P2 start). The Windows-only `backend/.venv` was not unpacked.
- Node on this Mac is 18.15 (the project asks for 22+). Two adaptations, neither changes behaviour on Node 22: `frontend/package.json` with
  `"type": "module"` (Node 18 does not detect ES modules in `.js` files), and the tests are run with `NODE_OPTIONS=--experimental-global-webcrypto`
  (Node 18 has no global `crypto.subtle`). With these, all P1 tests pass with the P1 counts (bundle 24, client 39, contract 30, golden 4,
  prepush 29, reused 6, synth 58); `export_edu_bundle.mjs --check` PASS (80 files).
- Python on this Mac is 3.11.7; the pinned NumPy 2.5.4 needs Python >= 3.12, so `pip install -r backend/requirements-dev.txt` fails and
  **pytest was NOT run on this machine** after P1. The backend was not changed in P2.

## P2 Science workspace MVP

- 2026-11-14 (local). Status: DONE. Commit: "P2 Science workspace" (see `git log`).
- WHAT: `frontend/science.html`, `css/tokens.css`, `css/base.css`, `css/science.css`, `js/science/model.js` (pure), `js/science/main.js` (DOM),
  `js/shared/siteHeader.js`, `js/shared/skyCanvas.js`, `frontend/package.json`, `tests/test_science_model.mjs`.
- HOW: model.js holds every number on screen and is tested against the static bundle (36 checks, incl. that the in-browser search reproduces the
  stored candidates). Browser run (Claude desktop browser pane, Chromium, served by `scripts/serve_frontend.py 8774`): field A loads with the
  SYNTHETIC badge and `edu · STATIC · ok`; keys right-arrow, D, 1 work; "Run the search" -> 1 candidate in 17 ms; `?api=http://localhost:9`
  -> "backend · unreachable", NO DATA, the failure sentence, no sequence listed (no fallback); `?seq=nope` -> "There is no sequence "nope" here.";
  no console errors. Tests: `node scripts/run_tests.mjs` all pass; prepush PASS. NOT run: Firefox/Safari, screen reader, pytest (see above).
- WHY: four panels in one CSS grid with named areas (controls `nav`, viewer `main`, inspector `aside`, timeline section), so selection in one
  panel updates the others and nothing is hidden behind a step; the layout was designed fresh (3.0 layout/CSS not copied).
- WHAT REMAINS: P3 onward. Not in P2: zoom/pan, admin token entry (P6), a colour/contrast test for the tokens (planned for P4 as `tests/test_theme.mjs`).

## P3 Learn narrative MVP (with Romanian strings)

- 2026-11-14 (local). Status: DONE. Commit: "P3 Learn narrative" (see `git log`).
- WHAT: `frontend/learn.html`, `css/learn.css`, `js/learn/model.js` (pure: steps, game, checklist, farther mover, progress), `js/learn/strings.js`
  (EN + RO tables, same keys), `js/learn/main.js` (DOM), `tests/test_learn.mjs`; fix in `css/base.css`: the on-picture REAL/SYNTHETIC label had
  zero height (the sky frame has `line-height: 0`), so its colour did not show; it now has its own line height (affects both views).
- HOW: `tests/test_learn.mjs` 28 checks (one test point was wrong on the first run: a "far" miss at (2,2) is only 14 px from mover A in field C;
  the point was moved to (2,45), the check itself was not changed). Browser run at 375x812 (Claude browser pane): step 4 game: a far tap ->
  "Not there: far away.", a tap on mover B -> "Hit! 82 points, 2 tap(s)."; RO steps 5-8 load with the SINTETIC label on each picture,
  checklist verdicts "trecut | trecut | trecut | neverificat…", farther = B; glossary opens with 7 entries; URL keeps `?lang=ro&step=8`;
  no console errors. `node scripts/run_tests.mjs` all pass; prepush PASS. NOT run: a real phone, a screen reader, Safari/Firefox.
- WHY: a separate shell (header + stepper `nav` with `ol` + `main` with one `section` + footer nav + `dialog`), built step by step, so the
  navigation model is a sequence and not panels; Romanian was written now with the English (cheap, and part of local impact), ahead of P7.
- WHAT REMAINS: the shared header badges are English in both languages (RO page shows "SYNTHETIC" in the header and "SINTETIC" on the picture);
  the worksheet (P7); scoring by time is not implemented (score = distance and tries only).

## P4 View switch, badges, structural test, audits

- 2026-11-14 (local). Status: DONE. Commit: "P4 view switch and structural test" (see `git log`).
- WHAT: `frontend/index.html` + `js/shared/entry.js` (chooses the view: `?view=`, then remembered, then width < 900 px -> Learn; keeps the
  deep-link parameters; two plain links without JS), `tests/test_structure.mjs`, `tests/test_theme.mjs`, README run line for macOS.
  The header switch and both badges were already in both shells (P2/P3), driven by `siteHeader.js` and `contract.badgeModel`.
- HOW: `test_structure.mjs` 23 checks and `test_theme.mjs` 45 checks pass; both were shown to FAIL on purpose (an `aside` added to learn.html;
  `color: #fff` added to learn.css) and the files were restored from a copy (git status clean for them afterwards).
  End-to-end run in the Claude browser pane (iframe driven by JS, 1300x800): `index.html?view=learn&seq=syn-b-d2` -> `learn.html?seq=syn-b-d2&step=1&lang=ro`;
  `index.html?view=science&seq=syn-b-d2` -> `science.html?seq=syn-b-d2`; `science.html?seq=syn-c-d4&theme=paper` -> paper theme; every page:
  badges `SYNTHETIC` + `edu · STATIC · ok`, one `h1`, one `main`, no duplicate ids, no control without an accessible name.
  Failure path (P2): `?api=http://localhost:9` -> "backend · unreachable", NO DATA, nothing substituted.
  NOT run: an automated accessibility engine (axe is not installed; no npm in this repo), a screen reader, keyboard-only walkthrough of
  Learn, Firefox/Safari, the Playwright suite of 3.0 (not carried over).
- WHY: a link between two documents (not a class toggle) is the switch, so the two structures cannot drift into one page; the tests read the
  shells as text so they run in Node with no browser.
- WHAT REMAINS: an axe run when a browser tool is available; header badges in Romanian.

## P5 Submission draft

- 2026-11-14 (local). Status: DONE (draft). Commit: "P5 submission draft" (see `git log`).
- WHAT: `docs/SUBMISSION.md`: requirement table (from the organisers' slides as quoted in the task, marked re-verify), project page text,
  30-second storyboard, 7-slide outline, 3-4 minute pitch script, Q&A sheet, AI-use declaration draft.
- HOW: written from FEATURE_STATUS and this log; every claim points to a test or is marked [unverified]. NOT run: the `submission-check` skill
  (it lives in the author's Windows `.claude/skills`, not available here). The public demo URL is not decided (author).
- WHY: done before P6 so that a submission exists if the session ends.
- WHAT REMAINS: the author picks video or slides and makes it; P8 updates the text with what really works.

## Environment: Python 3.12 on the Mac (2026-11-14)

- The author installed Python 3.12.10 from python.org (`python-3.12.10-macos11.pkg`, Apple-notarized; the last 3.12 release with a macOS
  installer). `backend/.venv` recreated with `/usr/local/bin/python3.12 -m venv backend/.venv` and `pip install -r backend/requirements-dev.txt`
  (all pins installed). `backend/.venv/bin/python -m pytest backend -q` -> **16 passed** (same count as P1 on Windows).

## P6 Full profile: storage, retrieval, processing, serving, Dockerfile

- 2026-11-14 (local). Status: DONE (tested with fakes only). Commit: "P6 full profile" (see `git log`).
- WHAT: `backend/blink/store/gcs.py` (GcsStore), `store/cache.py` (CachedStore), `blink/archive/` (retrieval CLI, HttpsArchive, FakeArchive),
  `blink/manifest.py` (manifest builder), `blink/processing/` (`job.py`, `headers.py`, `reused/` = four 3.0 modules unchanged),
  `scripts/candidates_for_product.mjs`, `backend/tests/test_full.py` (22 tests), `app.py` (admin reload also clears the cache),
  `backend/requirements-serve.txt`, `Dockerfile`, `.dockerignore`, `docs/DEPLOY_FULL.md`, `scripts/smoke_test_full.mjs`.
- HOW: pytest 38 passed (16 edu + 22 full). Corrections during the part, all to tests, not to the code: (1) the CLI dry-run test looked the
  module up by attribute and got the function of the same name; (2) the noise check expected sigma 0.7-1.4 after resampling and got 0.67:
  bilinear interpolation smooths noise, so the expectation was wrong; the bound is 0.5-1.05 with the reason in the test and in
  SCIENTIFIC_LIMITATIONS; (3) the prepush check flagged `user:pw@host` in a test URL as an e-mail address; the URL is now built from pieces.
  Smoke test: a local `full` backend (uvicorn, port 8013) over a store built in the scratchpad from the tests' synthetic FITS through the
  fake archive: 20/20 checks. The Science view with `?api=http://127.0.0.1:8013` shows `full · LOCAL · ok`, REAL, "no pixels to show",
  candidate c01 and the archive provenance; right after the smoke test's burst it showed the 429 failure in words and nothing in its place.
  NOTE: in that local test the label REAL sits on synthetic files passed through the fake archive; none of it is in the repository.
  NOT run: `docker build` (pulling the base image is a download; asked the author), anything against Google Cloud, IRSA or a real bucket,
  the processing job on real SPHEREx files in 4.0.
- WHY: retrieval, processing and storage are three modules with three commands, so reading a bucket is never mistaken for the workflow; the
  science of processing is 3.0's code unchanged (no rewrite, so no equivalence question); candidates come from the same JS detector the
  browser runs, through Node, so stored and in-browser results agree; the serving image has no NumPy/Astropy because serving never processes.
- WHAT REMAINS: an admin-token entry in the page (the admin route exists, nothing in the frontend uses it yet); building the image; the
  author's deployment (DEPLOY_FULL.md). Cloud readiness may be claimed only as "Dockerfile and smoke test exist; image not built; not deployed".

### P6 addendum: the Docker image (2026-11-14)

- The author said yes to pulling `python:3.12.10-slim`. Docker Desktop was started (`open -a Docker`). `docker build -t spherex-blink-api:p6 .`
  -> built (286 MB); no FITS or `.env` inside; non-root user (uid 10001).
- Smoke test against the container: `edu` profile -> all checks passed; `full` profile over the scratchpad test store (mounted read-only,
  synthetic FITS through the fake archive) -> all checks passed, including the 403 on pixels and the 429 rate limit.
- So the claim allowed now is: "Dockerfile builds; the image passes the smoke test locally in both profiles; not deployed; the GCS store is
  tested only with a fake client". The image was not pushed anywhere.

## P7 Polish: Romanian badges, worksheet, local impact, QA

- 2026-11-14 (local). Status: DONE. Commit: "P7 polish" (see `git log`).
- WHAT: `siteHeader.js` takes an optional `translate` (badge words only; the kind/status attributes that carry the colours never change);
  `learn/strings.js` `translateBadge` + `ui.worksheet`; `learn-worksheet.html`, `css/worksheet.css`, `js/learn/worksheet.js`,
  `js/learn/worksheetStrings.js`; Learn step 8 links the worksheet; `docs/EDUCATION.md` (what exists, what is NOT claimed: no partner,
  no curriculum link, decision 6).
- HOW: `tests/test_learn.mjs` now 36 checks (badge translation; worksheet keys EN = RO, SYNTHETIC note, [unverified] history, the
  worksheet's 8.5 px/yr, 6.1″/px and 52.0″/yr match field A's stored candidate). All Node tests and pytest (38) pass; prepush PASS.
  QA in the Claude browser pane: worksheet RO at 794x1123 (A4 width), no console errors, 1155 px tall on screen; Learn RO at 375x812:
  data badge "SINTETIC" (kind still synthetic), aria-label in Romanian, links to Science and the worksheet keep `lang=ro`, no horizontal scroll;
  Learn RO with `?api=http://localhost:9`: "server · inaccesibil", "FĂRĂ DATE", failure shown, nothing substituted; Science at 375x812:
  SYNTHETIC, 2 candidate rows, 40 px timeline targets, no horizontal scroll. Both profiles: P6 (edu + full, in the container).
  NOT run: printing (one-page fit is not verified; the print style uses 9.5 pt and 12 mm margins), `prefers-reduced-motion` in a browser
  (the code path: Learn does not auto-blink, Science starts at 1 image/s; not observed), a screen reader, Safari/Firefox, a real phone.
- WHY: translating only the words keeps the honesty signal (colour and kind) identical in both languages.
- WHAT REMAINS: failure sentences from the data client are English inside the Romanian page; local-impact facts need the author (decision 6).
