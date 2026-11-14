NEXT STEP: do P2 (Science workspace: frontend/science.html, css/tokens.css + science.css, js/science/; load a sequence, blink, candidate table, inspector, badges) then P3 (Learn).

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
