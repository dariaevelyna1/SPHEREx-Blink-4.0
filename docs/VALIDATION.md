# Validation: what was measured in 4.0, and what was not

Every number here comes from a command that can be re-run; the command is named. Nothing in 4.0 was validated on real SPHEREx data:
the real-data validation of the detector is 3.0's (`../SPHEREx-Blink-3.0/docs/VALIDATION.md`), and 4.0 only proves that it runs the same code.

## 1. The reused detector gives the same output as in 3.0

Command: `node tests/test_golden.mjs` (4 checks, all pass on 2026-11-14, Node v24.15.0, Windows).

3.0 recorded a digest (SHA-1 of the canonical output, numbers rounded to 5 significant digits) for three deterministic synthetic scenarios
(`scratch/benchmark_baseline.json`, made 2026-11-10). 4.0 re-creates two of them from its own copies of the code and gets the same digests:

| Scenario (3.0's name) | 3.0 digest | 4.0 digest | Same |
|---|---|---|---|
| detect: the dots of 30 images of 293 x 293 px | `637733ad2ffc4fcf` | `637733ad2ffc4fcf` | yes |
| movers: 18 images of 49 x 49 px, one mover among 14 stars | `f3233befc4a9e88f` | `f3233befc4a9e88f` | yes |
| distant: a body at 800 AU ... | `25881588be76572f` | not run | the parallax search is not carried over |

Also: `node tests/test_reused.mjs` checks that `movers.js`, `geometry.js` and `targets.js` are byte-identical to 3.0's (after normalising line
endings to LF), by SHA-256.

What this shows: the copy of the detector and of the injection helpers behaves exactly like 3.0's on those two scenarios, to 5 significant
digits. What it does not show: anything about real data, or about a change below the 5th digit.

## 2. The synthetic fields of the public bundle: the detector finds what was injected

Command: `node scripts/report_synth.mjs` (output of 2026-11-14):

| Field | Injected mover (px/yr) | Recovered (px/yr) | Position error (px) | Images | Significance | Chance lines expected | Other candidates |
|---|---|---|---|---|---|---|---|
| syn-a-d2 | (7.5, -4) | (7.47 ± 0.03, -3.99 ± 0.03) | 0.033 | 12 of 12 | 282 σ | 4e-13 | 0 |
| syn-b-d2 | (-1.9, 1.2) | (-1.92 ± 0.04, 1.15 ± 0.04) | 0.030 | 12 of 12 | 63 σ | 6e-12 | 0 |
| syn-c-d4 | (14, 6) | (14.01 ± 0.03, 5.98 ± 0.03) | 0.048 | 12 of 12 | 509 σ | 3e-12 | 0 |
| syn-c-d4 | (-2.6, -1.4) | (-2.58 ± 0.03, -1.46 ± 0.03) | 0.044 | 12 of 12 | 91 σ | 3e-12 | 0 |

`node tests/test_synth.mjs` asserts it (position within 0.5 px, each velocity component within 0.6 px/yr, no other candidate, the one-image
flash of field B is not a candidate).

**These are easy cases, on purpose.** White noise, a Gaussian PSF, bright movers (flux 90-160 noise units), and stars kept at least 4 px away
from every mover's path. The first draft of field A did not keep them away: its mover passed between two stars, its measured positions were
pulled up to 0.6 px off the line, and the detector did **not** link it (0 candidates). That is the blending limit 3.0 documents, reproduced here by
accident; the generator now avoids it and the limitation is written in `SCIENTIFIC_LIMITATIONS.md`. The significances above say how clean
the synthetic data is, not how good the detector is on the sky.

## 3. The static bundle is reproducible and self-consistent

Commands: `node scripts/export_edu_bundle.mjs --check` (PASS, 80 files) and `node tests/test_bundle.mjs` (24 checks): the committed files are
byte for byte what the code makes; every float file has the size of its grid and the SHA-256 recorded in its frame; only synthetic pixels.

## 4. The backend serves the same bytes

Command: `backend/.venv/Scripts/python.exe -m pytest backend -q` (16 passed on 2026-11-14): the `edu` profile returns float pixels whose SHA-256
equals `sha256Pixels`, lists only synthetic sequences, applies the pagination cap, the rate limit (429), the size caps and the CORS allow-list.

## Not measured in 4.0

- Nothing on real SPHEREx data. The numbers shown as "REAL · derived numbers" in the interface are quoted from 3.0 (`frontend/data/edu/real_examples.json` names its source).
- No completeness or false-alarm calibration; no timing benchmark.

## P6. The full profile with fakes (no real data, no cloud, no archive)

Command: `backend/.venv/bin/python -m pytest backend -q` -> 38 passed on 2026-11-14 (macOS, Python 3.12.10, Node 18.15.0).
`backend/tests/test_full.py` writes 12 small FITS files (90 x 90 px, rotated TAN WCS, 6.14″/px, IMAGE + FLAGS, 4 passes of 3 frames half a
year apart, 14 fixed stars and one mover at (+40, -25) ″/yr) in memory and passes them through the fake archive, retrieval, processing and
the reused detector: the recovered motion is within 3 ″/yr of the injected one (assertion); the stored pixel hashes match the served bytes.

Smoke test against a local full backend over a store built from the same synthetic FITS:
`node scripts/smoke_test_full.mjs http://127.0.0.1:8013 --sequence test-field-d2 --origin http://localhost:8774` -> 20 PASS, including
"the pixel route refuses (403)" and "rate limit answers 429 (after 60 requests)". This shows the checks work; it says nothing about a deployment.

The container (author's yes to pull `python:3.12.10-slim`, 2026-11-14): `docker build -t spherex-blink-api:p6 .` -> built, 286 MB; inside it
no `*.fits` and no `.env*`, `/srv/backend` holds only `app.py`, `approved_sequences.json`, `blink/`, `requirements-serve.txt`; the process
runs as uid 10001. Then:
- `docker run -p 8090:8080 spherex-blink-api:p6` (edu) and `node scripts/smoke_test_full.mjs http://127.0.0.1:8090 --expect-profile edu --sequence syn-a-d2 --skip-rate-limit` -> all smoke checks passed;
- the same image with `BLINK_PROFILE=full`, the scratchpad test store mounted read-only, `REAL_DATA_ENABLED=true`, and
  `node scripts/smoke_test_full.mjs http://127.0.0.1:8091 --sequence test-field-d2 --origin http://localhost:8774` -> all smoke checks passed
  (pixels refused with 403, rate limit 429).
Not tested: the image on Cloud Run, the GCS store from inside the container (no bucket, no credentials were used).
