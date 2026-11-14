# Credits and sources

Our own code is under the [MIT licence](LICENSE). Everything that is not ours is listed here **before** it is committed
(`node scripts/prepush_check.mjs` fails on an asset or a binary data file that this file does not name).

## People

- **mateibut**: author.
- **Ioonut**: contributor to SPHEREx Blink 3.0 (interface work: page structure, styles, the site header and page tests, two commits on 12 Nov 2026).
  No file of his is reused in 4.0, because 3.0's layout and CSS are not carried over; he is credited here for his part in the project this one grew from.
- Built **with AI assistance** (Claude Code, Anthropic). See the AI-use declaration in `docs/SUBMISSION.md`.

## Code reused from SPHEREx Blink 3.0 (same author, MIT)

Listed file by file in `frontend/js/core/REUSED.md` with the 3.0 commit and a SHA-256 of each file; a test fails if a reused file changes.

## Data

| What | Source | Licence / terms | Use |
|---|---|---|---|
| **Synthetic fields** in `frontend/data/edu/` (JSON, `.f32` float pixels, `.u8` masks) | Made by this project's code (`scripts/export_edu_bundle.mjs`, seeded) | Ours, MIT | The public demo. They are labelled SYNTHETIC everywhere; they are not observations and not AI-generated |
| **Golden fixtures** in `tests/fixtures/` | Derived numbers (digests, small JSON) from 3.0's benchmark and from our own generator | Ours, MIT | Regression checks |
| **SPHEREx images** (NASA/JPL-Caltech; distributed by NASA/IPAC IRSA, https://irsa.ipac.caltech.edu) | Not in this repository, not in the public demo | **Terms and acknowledgement wording [unverified]** (decision 4 in `WORKLOG.md`) | The `full` profile can process and serve them only after the author enables it; nothing here contains a SPHEREx pixel |
| **Real results quoted as numbers** (`frontend/data/edu/real_examples.json`) | Numbers measured by SPHEREx Blink 3.0 on real SPHEREx cutouts (its `docs/VALIDATION.md`); not re-run in 4.0 | Derived numbers, no pixels | Shown as "REAL · derived numbers" |

## Fonts, icons, images, sounds

None shipped. The interface uses system fonts and shapes drawn with CSS or on a canvas by our own code. No NASA or SPHEREx imagery is in the repository.

## Software

| Library | Version | Licence | Use |
|---|---|---|---|
| FastAPI | 0.162.7 | MIT | Backend routes |
| Uvicorn | 0.54.0 | BSD-3-Clause | Backend server |
| Starlette | 1.10.0 (installed with FastAPI) | BSD-3-Clause | Middleware, test client |
| Pydantic | 2.14.3 (installed with FastAPI) | MIT | Request validation inside FastAPI |
| NumPy | 2.5.4 | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 | Scientific processing (offline) |
| Astropy | 8.0.2 | BSD-3-Clause | FITS and WCS in scientific processing (offline). Cite as its authors ask: https://www.astropy.org/acknowledging.html |
| google-cloud-storage | 3.17.1 | Apache-2.0 | The Google Cloud Storage store of the `full` profile |
| pytest | 9.2.0 | MIT | Tests only |
| httpx | 0.28.1 | BSD-3-Clause | Tests only (the test client) |

Licences were read from the metadata of the installed packages on 2026-11-14 (`importlib.metadata`: `License-Expression`, or `License` and the
classifiers for google-cloud-storage and httpx); the licence texts themselves were not opened. No JavaScript library is used: the frontend is our own
ES modules, served as files.
