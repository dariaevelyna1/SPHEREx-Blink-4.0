# SPHEREx Blink 4.0

A blink comparator and mover finder for SPHEREx infrared images, with two interfaces: **Science** (a dense workspace) and **Learn** (a guided
story with a "hunt the mover" game). NASA Space Apps Challenge 2026, Cluj-Napoca, challenge "Planet X and SPHEREx".

> **Honesty notice.** The public demo runs on **synthetic** fields made by this project's code and labelled SYNTHETIC on every screen. No SPHEREx
> pixel is in this repository. A candidate is a lead, never a discovery. The 2.0/3.0 line of this project was started on 2026-11-05, before the
> hackathon weekend; this repository was started from an empty folder on 2026-11-14 and reuses a few scientific modules from 3.0 (see `CREDITS.md`).

Status: under construction. `WORKLOG.md` says what is done, what was tested and what remains.

## Run it

```bash
py scripts/serve_frontend.py 8765      # Windows; on macOS/Linux: python3 scripts/serve_frontend.py 8765
```

Then open `http://localhost:8765/` (`?view=science` or `?view=learn`). No build step, no install: vanilla ES modules.

## Test it

```bash
node scripts/run_tests.mjs
```

## Documents

- `docs/DATA_CONTRACT.md`: the frame and sequence API shared by both interfaces and both backend profiles.
- `docs/DESIGN_BRIEF.md`: the two structures, as wireframes.
- `WORKLOG.md`: the log of the work, part by part.
- `CREDITS.md`: everything that is not ours.
