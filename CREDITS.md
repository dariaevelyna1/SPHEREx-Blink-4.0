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
| (filled in as each dependency is added; pinned versions only) | | | |
