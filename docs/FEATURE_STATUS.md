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
| Science workspace (`science.html`): sequence list, Blink/Difference/Stack/Trail, playback, stretch, timeline by pass, inspector (image, pointer, provenance), candidate table with injected-truth match, in-browser search, real results as numbers, badges, keyboard, failures shown | works | `tests/test_science_model.mjs` (numbers); manual browser run 2026-11-14 (Chrome pane, 1440x900 and 800x600) |
| Learn narrative (`learn.html`): 8-step stepper with `?step=`, one question per step, hunt-the-mover game with score and 3 tries, detector result vs your tap, is-it-a-planet checklist (unchecked items said so), which-is-farther, free explore, glossary dialog, EN and RO strings, SYNTHETIC on every picture, reduced motion stops auto-blink | works | `tests/test_learn.mjs`; manual browser run 2026-11-14 at 375x812 (EN and RO, game hit/miss, steps 5-8, glossary) |
| Backend `full` profile: Google Cloud Storage store, archive retrieval, processing | not built yet | - |
| Dockerfile, deployment smoke test | not built yet: **no cloud readiness is claimed** | - |
