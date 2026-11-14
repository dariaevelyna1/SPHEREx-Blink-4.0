# Code reused from SPHEREx Blink 3.0

Source: `SPHEREx-Blink-3.0` (same author, mateibut, MIT licence), commit `06ac378`. Copied on 2026-11-14.

## Reused unchanged (do not edit)

These files are the 3.0 files with only the line endings normalised to LF. `tests/test_reused.mjs` fails if their content changes; a change to
the science belongs in 3.0's validation process, not here.

| File here | File in 3.0 | SHA-256 (LF line endings) |
|---|---|---|
| `frontend/js/core/features/movers.js` | `frontend/js/features/movers.js` | `6f8c866251cf2daa6aeaef8e0900ffb2e73725e9af2a36bbbce60d6898db294c` |
| `frontend/js/core/geometry.js` | `frontend/js/geometry.js` | `fea8a9cbb0e932d831f25358d7783fb9957a55b1b3caed3668d7d46036c32566` |
| `frontend/js/core/targets.js` | `frontend/js/targets.js` | `ca53f2ae903035d1e9706c23643a3314b447df2e099499ca97520be40c368d5f` |

- `movers.js` (`VERSION = "movers-2"`): the mover detector validated in 3.0 on real SPHEREx cutouts (3.0 `docs/VALIDATION.md` sections 2, 10, 15, 20).
  4.0 has **not** re-run that validation; it only proves that the copy gives the same output as 3.0 on 3.0's own golden scenarios
  (`tests/test_golden.mjs`).
- `geometry.js`, `targets.js`: its two imports. `targets.js` holds the five test objects of the challenge with their SIMBAD references.

## Adapted

| File here | From 3.0 | What changed |
|---|---|---|
| `frontend/js/core/inject.js` | `scratch/lib_inject.mjs` (`erf`, `pixelCell`, `gaussianNoise`, `renderStar`) and `scratch/lib_real.mjs` (`mulberry32`) | The five functions are gathered in one browser-loadable module; their bodies are unchanged. Proof of equivalence: `tests/test_golden.mjs` reproduces 3.0's two golden digests, which depend on every one of them |

## Authorship

All of the above was written by mateibut (with AI assistance) in the 2.0/3.0 line. The 3.0 contributor **Ioonut** worked on interface files (HTML,
CSS, the site header, page tests); none of those is reused here.
