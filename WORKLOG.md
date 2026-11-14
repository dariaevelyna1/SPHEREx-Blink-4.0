NEXT STEP: do P1 (copy the reused 3.0 modules into frontend/js/core with a pinned SHA-256, the synthetic field generator, scripts/export_edu_bundle.mjs, the edu backend profile, tests).

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

Filled in by P1 (the list of reused modules with their sha256) and kept current. See also `CREDITS.md`.

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
