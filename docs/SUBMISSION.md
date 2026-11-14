# Submission draft: SPHEREx Blink 4.0

Final pack for the author (P8, 2026-11-14). Every claim below points to a test or a run in `docs/VALIDATION.md` / `WORKLOG.md`. Requirements below are from the organisers' slides as quoted in the task: **re-verify each against the official
Space Apps guide** before submitting. Nothing here has been submitted, pushed or deployed by the agent.

| Requirement (from the slides, [re-verify]) | Where it is / what is missing |
|---|---|
| Project name, summary, challenge | Below ("Project page text") |
| Demo: max 7 slides OR a 30-second video, English | Both drafted below; the author picks one and makes it |
| At least one NASA dataset/resource | SPHEREx (NASA/IPAC IRSA) is the subject; the public demo uses **synthetic** fields; the real results shown are derived numbers from the author's 3.0 runs on SPHEREx cutouts. Data terms and acknowledgement wording: **unverified** (decision 4) |
| Public links to demo and code, no login | Code: `https://github.com/mateibut/SPHEREx-Blink-4.0` after the author pushes. Demo: **not decided by the author**; the natural choice is a static host of `frontend/` (e.g. GitHub Pages): the static `edu` bundle needs no server, no login, no cloud. Nothing is public until the author pushes and enables it |
| AI use declared | Below |
| AI-generated images/videos watermarked | None in the repository. If the author makes any for slides/video, add a visible watermark and list it in `CREDITS.md` and here |
| Deadline | Sunday 15 Nov 2026, 16:00 local; final check 15:45-16:00 |

## Project page text

**Name:** SPHEREx Blink

**Challenge:** Planet X and SPHEREx

**Summary (≈ 120 words):**
SPHEREx photographs the whole sky again and again, months apart. Anything in our Solar System, or a nearby brown dwarf, shifts between those
visits while the stars stay put. SPHEREx Blink lets you "blink" the pictures of one place so a mover jumps out, and runs a tested mover search
(a straight-line track across at least three visits) that reports each candidate with its motion, uncertainty, chance of a false line and
provenance. It has two interfaces over the same data: **Science**, a workspace with every number on screen, and **Learn**, an 8-step story in
English and Romanian with a "hunt the mover" game for classrooms. Every picture says whether it is REAL or SYNTHETIC; a candidate is a lead,
never a discovery.

**What works today (checked by tests, see `docs/FEATURE_STATUS.md`):**
- The two interfaces (Science workspace, Learn story in EN/RO with the game and a printable classroom worksheet) on synthetic fields with known
  movers, from the static `edu` bundle (no server).
- The reused 3.0 mover search (`movers-2`), byte-identical and reproducing 3.0's golden outputs; it recovers every injected mover of the bundle.
- The FastAPI backend, `edu` and `full` profiles: 38 pytest tests. The `full` profile's retrieval, processing and Google Cloud Storage store are
  tested with a **fake archive, a fake bucket client and synthetic FITS** only.
- The serving Docker image builds and passes the deployment smoke test **locally** in both profiles.

**What the live demo uses:** the static `edu` bundle (synthetic fields) in the browser. **No cloud backend is used in the demo**; nothing was
deployed. The real results shown are numbers quoted from 3.0's validation on real SPHEREx cutouts, not re-run in 4.0.

**Cloud readiness, in the only words allowed:** "The Dockerfile builds and the image passes our smoke test locally; a step-by-step Google Cloud
guide exists (`docs/DEPLOY_FULL.md`); it has not been deployed, and the Google Cloud Storage code is tested only against a fake client."

## 30-second video storyboard (English)

| Time | Picture | Voice / caption |
|---|---|---|
| 0-4 s | Learn, step 3: two sky pictures blinking, label SYNTHETIC | "Stars stay put. Things that move, jump." |
| 4-10 s | Learn, step 4: a finger taps the mover, "Hit! 100 points" | "Hunt the mover: a game for classrooms, in English and Romanian." |
| 10-16 s | Learn, step 6: the is-it-a-planet checklist, one item "not checked" | "A moving dot is a lead, not a discovery." |
| 16-25 s | Science: Difference mode, candidate ring, the inspector with motion ± error and provenance | "Science view: the same search, every number, its error and where the data came from." |
| 25-30 s | Science: real-results table labelled REAL · numbers only | "Tested on real SPHEREx cutouts of fast stars. SPHEREx Blink." |

Caption on screen for the whole video: "Pictures: SYNTHETIC test fields made by our code."

## 7-slide outline (alternative)

1. **The question.** Is there an unknown world out there? Movers betray themselves by moving.
2. **SPHEREx.** A NASA telescope revisiting the whole sky; one pixel ≈ 6″ (value measured in 3.0 on real files).
3. **Blink.** Two pictures, one place: the mover jumps (live demo, Learn steps 3-4).
4. **The search.** Straight-line tracks across ≥ 3 visits, motion with uncertainty, chance of a false line (Science view).
5. **Honesty.** REAL vs SYNTHETIC on every picture; real pixels never published; a candidate is a lead.
6. **For classrooms.** Romanian and English story, game, checklist, a printable one-page worksheet with a teacher's key. Not yet tried in a class; no school or partner is named [decision 6].
7. **What next.** The real-data path is built and tested with fakes (retrieval, processing, a private bucket, numbers only by default); it is switched on only after the data terms are checked (decisions 1, 4, 8).

## Pitch script (3-4 minutes, English)

1. (20 s) "In 1930 [unverified: Clyde Tombaugh] someone found Pluto by flipping between two photographs. SPHEREx now
   photographs the whole sky again and again [unverified: about every six months]. We built a tool that does that flipping for anyone."
2. (60 s) Live: Learn. Steps 3 and 4: blink, tap the mover, score. Step 6: the checklist, and why "not a known asteroid" is not checked here.
3. (60 s) Live: Science. Field A: Difference mode, the candidate row c01, motion and its error, the false-line chance, provenance
   (generator, seed, SHA-256). Press "Run the search": same answer in the browser.
4. (30 s) The real numbers table: Barnard's Star and Epsilon Indi B recovered on real SPHEREx cutouts (from 3.0's validation; quoted, not re-run).
5. (20 s) Honesty and next steps: synthetic labelled everywhere, real pixels never published; the real-data backend is built and tested with fakes, its container passes our smoke test locally, and it stays off until the data terms are checked.

## Q&A sheet

- *Is this real data?* The live pictures are synthetic test fields with known answers. The real results are numbers from our earlier runs on
  SPHEREx cutouts (3.0 validation), quoted with their source.
- *How do you know the search works?* It is the same file as in 3.0 (SHA-256 pinned) and reproduces 3.0's golden outputs (`tests/test_golden.mjs`);
  on synthetic fields it finds the injected movers (`tests/test_synth.mjs`, `tests/test_science_model.mjs`).
- *Could it find Planet X?* A distant planet would move very slowly; this MVP finds straight-line movers. The parallax search of 3.0 is not
  carried over. Any candidate would be a lead needing follow-up.
- *Why not show the real pictures?* We have not verified the data terms for republishing SPHEREx pixels, so we publish derived numbers only.
- *Is it in the cloud?* Not deployed. The container builds and passes our smoke test locally; the deploy guide is written; the bucket code is tested with a fake client.
- *Why two interfaces?* Pupils need one idea at a time; a scientist needs every number at once. Same data and detector, different structure (`tests/test_structure.mjs`).
- *Did you use AI?* Yes; see the declaration below.

## AI-use declaration (draft)

- Code, tests and documents were written with AI coding assistants (Claude models by Anthropic, via Claude Code) under the author's direction;
  the author reviews and decides what is pushed and submitted. Commit messages carry a `Co-Authored-By` line.
- No AI-generated images, video or audio are in the repository. Sky pictures are drawn by the project's own code from synthetic numbers.
- Start dates: the 2.0/3.0 line began on 2026-11-05 (before the hackathon weekend); this 4.0 repository began on 2026-11-14 and reuses seven
  modules from 3.0 unchanged with attribution (three JavaScript, four Python; `CREDITS.md`, `frontend/js/core/REUSED.md`). Eligibility of earlier work is the author's question for the organisers (decision 5).

## Not run

- The `submission-check` skill from the author's Windows setup is not available in this session; not run.
- Not verified: the official Space Apps rules (this table quotes slides); the SPHEREx data terms; any deployment; a real phone, Safari, Firefox,
  a screen reader; printing the worksheet on one A4 page; `prefers-reduced-motion` in a browser.
