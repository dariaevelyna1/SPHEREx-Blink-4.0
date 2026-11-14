# AGENTS.md: instructions for anyone (human or agent) working on SPHEREx Blink 4.0

Read the first line of `WORKLOG.md` (the next step), then its last section, then `git status` and `git log`. The repository wins over any note.

## What this is

Two interfaces (Science workspace, Learn narrative) over one data contract (`docs/DATA_CONTRACT.md`) and one FastAPI codebase with two profiles
(`edu` static/synthetic, `full` processed real sequences from a store). Vanilla ES modules in `frontend/` (no build, no npm), Python in `backend/`.

## Rules that must not be broken

1. **Real or synthetic, always labelled**, in both views. Never present synthetic or model output as an observation. Never fall back silently from real to synthetic: show the failure.
2. **Real SPHEREx files and pixels are never committed or published.** `backend/data/` and caches are git-ignored. Public pages and the public backend show derived numbers only.
3. **No invented science**: no made-up FITS keywords, endpoints, units, catalogue matches or validation numbers. A number in a document comes from a command that can be re-run. A fact from memory is marked `[unverified]`. A candidate is a lead, never a discovery.
4. **Do not download FITS files and do not list, read or write any cloud bucket** without the author's explicit yes.
5. **Never `git push`**, force-push, delete branches, rewrite history, change visibility, deploy or publish. Commit locally only.
6. **Honest tests**: never mark an unrun test as passing; never weaken a check to make it pass.
7. **Secrets**: never write, print, log or ask for a password, key, token or service-account file. The repository holds only `.env.example`. No e-mail addresses in files.
8. Colours only through the CSS tokens in `frontend/css/tokens.css`. Analysis code is pure (no DOM, no network, `fetch` injectable).
9. The two views share data modules, never layout: `tests/test_structure.mjs` enforces it.
10. Files reused from 3.0 (`frontend/js/core/`) are not edited: `tests/test_reused.mjs` pins their SHA-256.
11. Every asset and library has a `CREDITS.md` entry before it is committed.
12. Keep **archive retrieval**, **scientific processing** and **storage** as three distinct things in code, documents and interface wording.

## Commands

```bash
node scripts/run_tests.mjs                              # all Node tests, then the prepush check
node scripts/prepush_check.mjs                          # the public-repository gate alone
backend/.venv/Scripts/python.exe -m pytest backend -q   # backend tests (py is the launcher; python is a broken alias on this machine)
py scripts/serve_frontend.py 8765                       # the site, no stale cache
node scripts/export_edu_bundle.mjs                      # remake the synthetic bundle (seeded; the output must not change unless meant)
```

## Conventions

- Interface text and documents in English; Learn also has a Romanian string table. The author chats in Romanian.
- New feature = code + tests + a line in `docs/FEATURE_STATUS.md` + limits in `docs/SCIENTIFIC_LIMITATIONS.md`; a measured claim goes in `docs/VALIDATION.md` with its command.
- Windows: write files with the editor tool, not shell heredocs.
- After each part: run the tests and the prepush check, update `WORKLOG.md`, one local commit.
