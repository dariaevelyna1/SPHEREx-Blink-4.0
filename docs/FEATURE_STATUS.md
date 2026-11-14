# Feature status

What works, checked by which command. "Works" means the named test passes; nothing here has been deployed.

| Feature | Status | Checked by |
|---|---|---|
| Data contract `blink-4.0/1` (sequences, frames, candidates, health), validators | works | `tests/test_contract.mjs` |
| Reused 3.0 mover detector (`movers-2`), byte-identical, same golden output | works | `tests/test_reused.mjs`, `tests/test_golden.mjs` |
| Synthetic fields with known movers (seeded generator) | works | `tests/test_synth.mjs` |
| Static `edu` bundle (3 synthetic sequences, stored candidates, real results as numbers) | works | `tests/test_bundle.mjs`, `node scripts/export_edu_bundle.mjs --check` |
| Data client: static bundle or `?api=` backend, failures shown, no fallback | works | `tests/test_client.mjs` |
| Deep links `ra`, `dec`, `fov`, `det`, `api`, `seq`; `?view=`; remembered view | works (logic) | `tests/test_client.mjs` |
| Backend `edu` profile: health, sequences, pixels, masks, candidates, `/api/cutouts` compatibility | works | `backend/tests/test_edu.py` |
| Backend limits: rate limit, concurrency cap, time cap, size caps, pagination cap, CORS allow-list, admin token | works | `backend/tests/test_edu.py` |
| Storage interface: `LocalDirStore`, `MemoryStore` (fake) | works | `backend/tests/test_edu.py` |
| Public-repository gate (no FITS, secrets, e-mail addresses, uncredited assets) | works | `tests/test_prepush.mjs`, `node scripts/prepush_check.mjs` |
| Entry page `index.html`: `?view=`, remembered view, screen width; keeps deep-link parameters; plain links without JS | works | manual browser run 2026-11-14 (`index.html?view=learn&seq=syn-b-d2` -> learn.html with `seq` kept; same for science) |
| Classroom worksheet `learn-worksheet.html` (EN/RO, printable A4, teacher's key), linked from Learn step 8 | works on screen; printing to one A4 page not verified | `tests/test_learn.mjs` (keys, SYNTHETIC note, numbers match field A); browser run 2026-11-14 at 794x1123 |
| Romanian header badges in Learn (SINTETIC, FĂRĂ DATE, server · inaccesibil) | works | `tests/test_learn.mjs`; browser run at 375x812 |
| Structural difference of the two views (different shells, landmarks, navigation model, stylesheets, scripts) | works | `tests/test_structure.mjs` (23 checks; shown to fail when an `aside` is added to learn.html) |
| Colours only through tokens; contrast in `night` and `paper` | works | `tests/test_theme.mjs` (45 checks; shown to fail on a colour literal in learn.css) |
| Science workspace (`science.html`): sequence list, Blink/Difference/Stack/Trail, playback, stretch, timeline by pass, inspector (image, pointer, provenance), candidate table with injected-truth match, in-browser search, real results as numbers, badges, keyboard, failures shown | works | `tests/test_science_model.mjs` (numbers); manual browser run 2026-11-14 (Chrome pane, 1440x900 and 800x600) |
| Learn narrative (`learn.html`): 8-step stepper with `?step=`, one question per step, hunt-the-mover game with score and 3 tries, detector result vs your tap, is-it-a-planet checklist (unchecked items said so), which-is-farther, free explore, glossary dialog, EN and RO strings, SYNTHETIC on every picture, reduced motion stops auto-blink | works | `tests/test_learn.mjs`; manual browser run 2026-11-14 at 375x812 (EN and RO, game hit/miss, steps 5-8, glossary) |
| Storage: `GcsStore` (google-cloud-storage, ADC, prefix, streamed reads), `CachedStore` (read-through, LRU size cap, cleared by admin reload) | works with a FAKE client | `backend/tests/test_full.py`; never run against a real bucket |
| Archive retrieval CLI (`python -m blink.archive.retrieve`): allow-list, https + IRSA host only, size cap, SHA-256 check, refuses synthetic test files, writes the manifest; dry run by default | works with a FAKE archive | `backend/tests/test_full.py`; never run against IRSA |
| Manifest builder (`python -m blink.manifest`) for local originals | works | `backend/tests/test_full.py` |
| Processing job (`python -m blink.processing.job`): 3.0's resampling, mask and float modules reused unchanged, originals checked by SHA-256, candidates by movers-2 through Node | works on synthetic FITS made by the tests | `backend/tests/test_full.py` (mover recovered within 3″/yr); never run on real files in 4.0 |
| `full` profile serving: allow-list, `REAL_DATA_ENABLED` + `termsChecked` gate, `SERVE_PIXELS=false` by default (403 on pixel routes), health LOCAL/CLOUD | works | `backend/tests/test_full.py`; Science view with `?api=http://127.0.0.1:8013` |
| `Dockerfile` (serving image), `docs/DEPLOY_FULL.md`, `scripts/smoke_test_full.mjs` | image built locally (Docker Desktop, 286 MB, runs as a non-root user, no FITS or .env inside); smoke test passes against the container in both profiles; **nothing was deployed** | `docker build -t spherex-blink-api:p6 .`, then `scripts/smoke_test_full.mjs` against the container (`docs/VALIDATION.md` P6) |
