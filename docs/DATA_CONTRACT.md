# Data contract: the frame and sequence API of SPHEREx Blink 4.0

Contract version: `blink-4.0/1`. Both interfaces (Science and Learn) and both backend profiles (`edu`, `full`) speak this contract and nothing else.
It was agreed against the 3.0 backend (`../SPHEREx-Blink-3.0`, HEAD `06ac378`: `backend/app.py`, `backend/spherex/query.py`, `cutout.py`, `flags.py`,
`floatdata.py`, `docs/DATA_CHECKLIST.md`) **before** either interface was built. Section 12 lists every difference from 3.0 with its reason.

Words used in a fixed sense in this project (code, documents, interface):

| Word | Meaning |
|---|---|
| **Archive retrieval** | Copying original SPHEREx files from the archive (IRSA) into the store, each verified by SHA-256. Offline, command line, author only. |
| **Scientific processing** | Turning originals into products on one common grid: numerical pixels, masks, WCS, candidates, provenance. Offline job, not a public endpoint. |
| **Storage** | Where originals and products live (a local folder or a Google Cloud Storage bucket), behind one `DataStore` interface. Reading a bucket is storage only: it is not the real-data workflow. |
| **Serving** | Read-only public endpoints over processed, **approved** sequences. |
| **Sequence** | The ordered frames (by time) of **one field and one detector**, all on the same pixel grid. The unit the interfaces load and blink. |
| **Frame** | One exposure of the sequence, resampled onto the sequence grid. |
| **Field** | A place on the sky (centre and size) for which one or more sequences exist. |

## 1. Principles

1. **Numbers first.** A frame is its numerical pixels (float32), its mask, its grid (WCS), its unit, its time and its provenance. A picture
   (`imageUrl`) is a *derived display product*, optional, labelled as such, and never used for a measurement. Both interfaces draw their picture
   from the float pixels with a stretch that is named on screen.
2. **Real or synthetic, in the data itself.** Every sequence and every frame carries `dataKind` (`"synthetic"` or `"real"`). A response never mixes
   kinds inside one sequence. A client that cannot get real data shows the failure; it does not substitute synthetic data.
3. **Derived numbers by default.** With `pixelsServed: false` the frame still carries its metadata, statistics and candidates, and `dataUrl`,
   `maskUrl`, `imageUrl` are `null`. That is the default of the `full` profile (`SERVE_PIXELS=false`).
4. **Only what real headers justify.** Section 11 lists the header facts this contract relies on and where 3.0 confirmed them. No FITS keyword,
   unit or endpoint is invented here; what is unknown is `null` and says why.

## 2. Endpoints

All `GET`, all read-only. Errors have the shape `{"detail": "..."}` as in 3.0 (400 bad input, 403 refused, 404 unknown, 429 rate limit, 502 upstream,
503 store unreachable or the server is at its concurrency cap).

| Route | Returns | Notes |
|---|---|---|
| `/api/health` | `Health` (section 8) | What the backend badge shows |
| `/api/sequences?limit=&offset=` | `{ sequences: SequenceSummary[], total, limit, offset }` | Approved sequences only. `limit` is capped by the server (`MAX_PAGE_SIZE`) |
| `/api/sequences/{sequenceId}` | `Sequence` (section 3) with all its frames | 404 if unknown **or not approved** (the two are not distinguished) |
| `/api/sequences/{sequenceId}/frames/{frameId}/data` | raw float32 pixels (section 5) | 403 with a reason when pixels are not served |
| `/api/sequences/{sequenceId}/frames/{frameId}/mask` | raw uint8 mask (section 5) | same rule |
| `/api/sequences/{sequenceId}/candidates` | `CandidateSet` (section 7) | Made by the processing stage, not on request |
| `/api/cutouts?ra=&dec=&fov=&det=` | `{ frames: Frame[] }` | **Compatibility route with the 3.0 shape**: the frames of the approved sequence whose field contains (`ra`, `dec`) for detector `det`; `{ "frames": [] }` when there is none, as in 3.0 |
| `/api/admin/reload` (POST) | `{ reloaded: true, ... }` | Admin only (bearer token from the server's environment); re-reads the manifest and the allow-list |

There is **no** public endpoint that retrieves from the archive, processes, or writes to the store.

The same shapes are published as static files (the `edu` bundle, section 10), so the public site needs no server.

## 3. Sequence

```json
{
  "contractVersion": "blink-4.0/1",
  "sequenceId": "syn-kuiper-d2",
  "fieldId": "syn-kuiper",
  "title": "Synthetic field A: one slow mover",
  "dataKind": "synthetic",
  "detector": "D2",
  "center": { "raDeg": 136.5, "decDeg": 16.6, "frame": "ICRS" },
  "fovArcmin": 5.0,
  "grid": {
    "projection": "TAN", "orientation": "north up, east left", "rowOrder": "row 0 = north",
    "n": 49, "pixelScaleArcsec": 6.14,
    "crvalDeg": [136.5, 16.6], "crpix": [25.0, 25.0], "cdDeg": [[-0.0017055556, 0], [0, 0.0017055556]]
  },
  "unit": null,
  "pixelsServed": true,
  "frames": [ "Frame, section 4, in time order" ],
  "processing": {
    "steps": ["generate: seeded synthetic field", "detect+link: movers-2"],
    "codeVersion": "blink-4.0 synth-1",
    "processedAt": "2026-11-14T10:00:00Z",
    "reusedFrom": null
  },
  "truth": { "movers": [ { "x": 20.0, "y": 28.0, "vxPxPerYr": 1.7, "vyPxPerYr": -0.9, "flux": 120 } ], "mjdRef": 61106.55 },
  "terms": "Synthetic data made by this project's code. Not an observation."
}
```

| Field | Type | Meaning |
|---|---|---|
| `sequenceId` | string | Unique, stable, URL-safe (`[a-z0-9-]`). Convention: `<fieldId>-<detector lower case>` |
| `fieldId` | string | The field this sequence belongs to |
| `dataKind` | `"synthetic"` \| `"real"` | Never absent. `"real"` only for sequences processed from archive originals |
| `detector` | string | `"D1"`..`"D6"`, normalised as in 3.0 (`normalize_detector`) |
| `center`, `fovArcmin` | | The requested field centre (ICRS degrees) and size, as in the 3.0 query `ra`, `dec`, `fov` |
| `grid` | object | The one grid all frames share, exactly the 3.0 target grid (`cutout.target_wcs`): north-up TAN, `crval` = centre, `crpix` = (n+1)/2 (FITS 1-based), `cd` = [[-s,0],[0,s]] with s = scale in degrees, `n = max(8, ceil(fov*60/scale))` |
| `unit` | string \| null | The unit of the float pixels: the `BUNIT` of the originals (for SPHEREx `"MJy / sr"`), or null. Synthetic pixels are in units of the injected noise sigma and have no physical unit: null |
| `pixelsServed` | boolean | Whether `dataUrl`/`maskUrl` of the frames are present |
| `processing` | object | `steps` (ordered, human readable), `codeVersion`, `processedAt` (UTC), `reusedFrom` (the validated module and commit a step was reused from, or null) |
| `truth` | object \| absent | **Synthetic only**: the injected movers (the known answer). Never present on real data |
| `terms` | string | What may be done with this data. For real sequences: the acknowledgement text, `[unverified]` until decision 4 |

`SequenceSummary` (the list route) is the same object without `frames`, `truth` and `processing`, plus `frameCount`, `mjdFirst`, `mjdLast`,
`passCount` (survey passes: runs of frames less than 30 days apart, the rule of the mover search).

## 4. Frame

```json
{
  "frameId": "f003",
  "mjd": 60908.3, "dateISO": "2025-08-21T07:12:00Z", "timeKeyword": null,
  "detector": "D2",
  "wavelengthMinUm": 1.31, "wavelengthMaxUm": 1.35, "wavelengthSource": "synthetic",
  "pixelScaleArcsec": 6.14, "unit": null,
  "dataKind": "synthetic", "backgroundSubtracted": true, "pixelsServed": true,
  "dataUrl": "frames/f003.f32", "maskUrl": "frames/f003.mask.u8", "imageUrl": null, "flagsUrl": null,
  "sha256Pixels": "9f2c...", 
  "flags": { "anyFlagged": false, "fractionFlagged": 0.0 },
  "stats": { "validFraction": 1.0, "noiseSigma": 1.0, "min": -3.1, "max": 96.2 },
  "provenance": {
    "headerCheck": "synthetic",
    "origin": "generator",
    "generator": { "name": "synthField", "version": "synth-1", "seed": 202 },
    "archive": null
  }
}
```

| Field | 3.0 | Meaning |
|---|---|---|
| `frameId` | new | Unique inside the sequence, stable (`f000`, `f001`, ... in time order) |
| `mjd`, `dateISO` | same | Observation time. Real: from `MJD-OBS` (or `MJD-AVG`), as 3.0 `query.py`; `dateISO` is that instant written as UTC by astropy. **The time scale of `MJD-OBS` is not verified** (open in 3.0 `DATA_CHECKLIST.md` section 3): the contract carries the number as the header gives it |
| `timeKeyword` | new | The header keyword the time came from (`"MJD-OBS"`, `"MJD-AVG"`, ...), null for synthetic |
| `detector` | same | |
| `wavelengthMinUm`, `wavelengthMaxUm` | same | The band at the field centre |
| `wavelengthSource` | new | `"WCS-WAVE"` (per-frame, from the file's spectral WCS, recipe in section 11), `"nominal"` (the rough per-detector table of 3.0 `query.py`, an assumption) or `"synthetic"` |
| `pixelScaleArcsec`, `unit` | same | Repeated on each frame for 3.0 clients; equal to the sequence's |
| `dataKind` | new | Same value as the sequence |
| `backgroundSubtracted` | new | True when the per-frame median was subtracted from the float pixels (always true for 3.0-style products: `floatdata.float_cutout_bytes`) |
| `pixelsServed` | new | Whether the three URLs below are present |
| `dataUrl` | same, now nullable | The float pixels (section 5). Relative URLs resolve against the URL of the sequence document; the API returns absolute URLs |
| `maskUrl` | same, now nullable | The bad-pixel mask (section 5) |
| `imageUrl` | same, now nullable | A **derived display picture** (8-bit, stretched). Optional. Null in the `edu` bundle: the interfaces draw from the float pixels |
| `flagsUrl` | same | A derived picture of the mask, or null |
| `sha256Pixels` | new | SHA-256 (hex) of the float32 bytes exactly as served. Present even when pixels are not served, so two people can tell they hold the same product |
| `flags` | same | `{ anyFlagged, fractionFlagged }`: the share of valid pixels with a BAD flag bit; null when the original has no flags extension |
| `stats` | new | Derived numbers that do not reveal the image: `validFraction` (finite pixels), `noiseSigma` (robust, of the background), `min`, `max` |
| `provenance` | **changed**: string -> object | See section 6. The 3.0 string is kept as `provenance.headerCheck` |

## 5. Binary payloads (unchanged from 3.0)

- **Float pixels** (`dataUrl`): raw little-endian float32, `n*n` values, no header, row 0 = north (top), east to the left, the frame's median
  subtracted, `NaN` = no data. Exactly 3.0 `floatdata.float_cutout_bytes`. A client reads it with `new Float32Array(buffer)` and must check
  `byteLength === 4*n*n`.
- **Mask** (`maskUrl`): one byte per pixel, same orientation; 1 = at least one BAD flag bit, 0 = usable. BAD bits are 0, 1, 2, 4, 5, 6, 9, 10, 11
  (3.0 `flags.py`, from IRSA's documentation as recorded in 3.0 `docs/IRSA_FACTS.md` section 5; bits 12 and 21 are informative; 7, 14, 15, 17, 19 are
  undecided and not counted). Synthetic frames have an all-zero mask.
- Pixel coordinates used by every analysis: **edge coordinates**, x to the right (west), y down (south), the centre of pixel (0,0) is (0.5, 0.5),
  the field centre is (n/2, n/2). This is the convention of the reused detector (`movers.js`) and of `geometry.js`.
- Resampling (real data): NaN-aware bilinear onto the sequence grid, frames with under 50 % valid pixels dropped, the pixel scale is the median of
  the frames' scales (3.0 `cutout.py`, `app.py`). The served value is therefore **not** an original detector pixel and not calibrated photometry.

## 6. Provenance

Per frame:

| Field | Meaning |
|---|---|
| `headerCheck` | The 3.0 value: `"synthetic"` (the file says it is a test file, or the frame was generated), `"spherex_header"` (the header has `OBSID`, `SPS_TARGET` and `EXTTYPE`), `"unverified"`. A header check does not authenticate where a file came from: `archive.sha256` does that |
| `origin` | `"generator"` or `"archive"` |
| `generator` | `{ name, version, seed }` for synthetic frames, else null |
| `archive` | For real frames: `{ sourceUrl, fileName, obsId, sha256, sizeBytes, retrievedAt }`: the archive URL the original was retrieved from, its file name, the header's `OBSID`, the SHA-256 and size of the original file, and when it was retrieved (UTC). Null for synthetic |

Per sequence: `processing` (section 3). Per candidate set: `algorithm`, `settings`, `ranAt` (section 7).

A provenance record says what was used and when. It does not say that a result is right.

## 7. Candidates

```json
{
  "sequenceId": "syn-kuiper-d2", "dataKind": "synthetic",
  "algorithm": "movers-2", "settings": { "sigmaFloor": 1e-9, "register": true }, "ranAt": "2026-11-14T10:00:00Z",
  "stats": { "frames": 12, "passes": 4, "stillDots": 14 }, "reason": null,
  "candidates": [ {
      "candidateId": "c01",
      "x": 20.02, "y": 27.98, "mjdRef": 61106.55, "vx": 1.69, "vy": -0.91,
      "speedPx": 1.92, "motionPx": 2.1, "nDet": 12, "nFrames": 12, "rms": 0.11,
      "significance": 31.0, "snr": 24.0, "vErrPx": 0.06, "posErrPx": 0.03, "falseAlarm": 1e-9,
      "raDeg": 136.5087, "decDeg": 16.5949, "pmEastArcsecPerYr": -10.4, "pmNorthArcsecPerYr": 5.6,
      "points": [ { "frame": 0, "x": 19.1, "y": 28.4 } ]
  } ],
  "note": "A candidate is a lead with its evidence, never a discovery."
}
```

The numeric fields from `x` to `falseAlarm` and `points` are the output of the reused 3.0 detector (`findMoversInImages`, `VERSION = "movers-2"`):
position (px, edge coordinates) at `mjdRef`, velocity (px per year), the dots used, the fit's rms, the velocity error and `falseAlarm` (the number
of chance lines expected in the field, **not** a probability of being real). `raDeg`..`pmNorthArcsecPerYr` are derived with the flat-sky mapping of
`geometry.js` (east = -x). `reason` is the detector's own message when it cannot run (fewer than 3 survey passes).

## 8. Health

```json
{
  "contractVersion": "blink-4.0/1", "profile": "edu", "dataSource": "STATIC",
  "storeReachable": true, "manifestVersion": "edu-1", "realDataEnabled": false, "servePixels": true,
  "sequenceCount": 3, "time": "2026-11-14T10:00:00Z", "problem": null
}
```

`profile`: `edu` | `full`. `dataSource`: `STATIC` (files next to the site, no server), `LOCAL` (a folder on the server), `CLOUD` (a bucket).
`servePixels` is about what this backend hands out: the `edu` bundle is synthetic, so its pixels are served; the `full` profile defaults to false.
`problem` is a sentence when something is wrong (the store cannot be read, the manifest is invalid), else null. The interfaces show profile, data
source and status at all times, and show a failed health check as a failure.

## 9. Storage: layout, manifest, approved sequences (`full` profile)

```
<store root or gs://<bucket>/<prefix>/>
  fields/<fieldId>/manifest.json                      the originals of the field (written by archive retrieval or by the manifest builder)
  fields/<fieldId>/originals/<fileName>               archive files, byte-identical to the archive (never served, never committed)
  fields/<fieldId>/products/<sequenceId>/sequence.json     a Sequence document (section 3), dataUrl/maskUrl relative
  fields/<fieldId>/products/<sequenceId>/frames/<frameId>.f32, <frameId>.mask.u8
  fields/<fieldId>/products/<sequenceId>/candidates.json   a CandidateSet (section 7)
```

`manifest.json`:

```json
{
  "manifestVersion": "2026-11-14T10:00:00Z", "fieldId": "example-field",
  "center": { "raDeg": 0.0, "decDeg": 0.0, "frame": "ICRS" }, "fovArcmin": 5.0,
  "originals": [ {
      "frameId": "o000", "path": "originals/example.fits", "sizeBytes": 0, "sha256": "...",
      "detector": "D2", "mjd": 0.0,
      "archive": { "sourceUrl": "https://irsa.ipac.caltech.edu/...", "fileName": "example.fits", "obsId": "...", "retrievedAt": "..." }
  } ],
  "products": [ "example-field-d2" ]
}
```

Paths are relative to the field folder and may not contain `..` or start with `/`. `sha256` and `sizeBytes` are of the stored bytes;
retrieval refuses a file whose hash differs from the one the plan expects, and the manifest builder computes them from the files it finds.

**Approved sequences** (`backend/approved_sequences.json`, edited by the author, ships empty):

```json
{ "approved": [ { "sequenceId": "example-field-d2", "fieldId": "example-field", "approvedBy": "", "approvedOn": "", "termsChecked": false } ] }
```

The `full` profile serves a real sequence only if `REAL_DATA_ENABLED=true` **and** the sequence is in this list with `termsChecked: true`
**and** its product exists in the store. Everything else is 404.

## 10. The static `edu` bundle

`frontend/data/edu/` holds the same documents as files, so the public site works with no server, login, cloud or token:

```
frontend/data/edu/health.json                      Health with dataSource "STATIC"
frontend/data/edu/sequences.json                   { sequences: SequenceSummary[], total, limit, offset }
frontend/data/edu/sequences/<sequenceId>/sequence.json, candidates.json, frames/<frameId>.f32, frames/<frameId>.mask.u8
frontend/data/edu/real_examples.json               a few REAL results as derived numbers only (no pixel), each with its source
```

Only synthetic pixels are in the bundle. It is made by `node scripts/export_edu_bundle.mjs` (seeded, reproducible) and the `edu` backend profile
serves the very same folder through the routes of section 2.

## 11. Header and archive facts this contract relies on (and what it does not claim)

Confirmed in 3.0 (`docs/DATA_CHECKLIST.md`, update of 6-7 Nov 2026, and `docs/IRSA_FACTS.md`, read from IRSA's documentation; not re-checked for 4.0):

- A SPHEREx level-2 spectral image is a multi-extension FITS: HDU 1 `IMAGE` (2040 x 2040 float32, `BUNIT` "MJy / sr"), HDU 2 `FLAGS` (int32),
  further `VARIANCE`, `ZODI`, `PSF`, `WCS-WAVE`.
- Observation time: `MJD-OBS` (or `MJD-AVG`). `DATE` is the file's creation date and is not used.
- `DETECTOR` is a number; normalised to `D<n>`.
- Wavelength at a pixel: `WCS(header, fobj=hdul, key="W")`, `sip = None`, `pixel_to_world` gives (wavelength, bandwidth).
- Pixel scale about 6.14 arcsec per pixel on real files; the contract always carries the scale measured from the WCS, never a constant.
- A real header is recognised by `OBSID`, `SPS_TARGET`, `EXTTYPE` (3.0 `query.py`).
- Archive access as 3.0 used it: IRSA TAP (`spherex.plane`, `spherex.artifact`) to find files, the file URL with `?center=ra,dec&size=` for a
  server-side cutout. Table and collection names change between data releases (3.0's own warning).

Not claimed, not in the contract: the time scale of `MJD-OBS`; any quality keyword; the IRSA product id of a file (3.0 never had it: `obsId` is the
header's `OBSID`, nothing more); a physical unit for synthetic pixels; calibrated photometry; that a cutout's pixel is an original detector pixel.
**Data terms and the exact acknowledgement wording are [unverified]** (decision 4).

## 12. Differences from 3.0, each with its reason

| # | 3.0 | 4.0 | Reason |
|---|---|---|---|
| 1 | One implicit list: `/api/cutouts?ra&dec&fov&det` builds frames on request from whatever files are indexed | Explicit sequences with ids (`/api/sequences`, `/api/sequences/{id}`); `/api/cutouts` kept as a compatibility route | The public backend may only serve **approved, processed** sequences; building products on request is an expensive operation and is moved offline |
| 2 | `provenance` is a string | `provenance` is an object; the string is `provenance.headerCheck` | The task requires source URL, archive file name, SHA-256 of the original, generator and seed; a header check alone does not say where a file came from |
| 3 | No ids | `sequenceId`, `fieldId`, `frameId` | Stable addresses for frames, candidates and the allow-list |
| 4 | `dataUrl`, `maskUrl`, `imageUrl` always present with the backend | Nullable, with `pixelsServed` | `SERVE_PIXELS=false` by default: derived numbers only until the data terms are verified |
| 5 | `imageUrl` (PNG) is what the player shows | Display is drawn client-side from the float pixels; `imageUrl` optional and labelled derived | Numerical data first; no second copy of the pixels to keep consistent; smaller bundle |
| 6 | Synthetic frames have no float pixels (8-bit only) | Synthetic frames have float pixels like real ones | One code path for both kinds; the validated detector runs on floats in both |
| 7 | Grid implied by `ra`, `dec`, `fov`, `pixelScaleArcsec` | `Sequence.grid` written out (same grid) | WCS must be preserved explicitly |
| 8 | No processing record | `Sequence.processing`, `CandidateSet.algorithm/settings/ranAt` | Provenance of the products |
| 9 | - | `dataKind`, `timeKeyword`, `wavelengthSource`, `backgroundSubtracted`, `sha256Pixels`, `stats`, `truth` | Additive; say what 3.0 left implicit |
| 10 | `/api/health` lists indexed and unreadable files with paths | Health is profile, data source, reachability, manifest version, flags, time; no file names or paths | A public endpoint must not leak the store's layout |
| 11 | CORS `*` | CORS from an allow-list (`CORS_ALLOW_ORIGINS`) | Public deployment |
| 12 | `/api/photometry`, `/api/hips`, `/api/catalogue`, `/api/survey`, `/api/observations`, `/api/footprints` | **Not carried over** in the MVP | Out of scope of the two-interface MVP; listed in `WORKLOG.md` |

Unchanged on purpose: field meanings and names of `mjd`, `dateISO`, `detector`, `wavelengthMinUm`, `wavelengthMaxUm`, `pixelScaleArcsec`, `unit`,
`flags`; the float and mask byte formats; the grid; the BAD bit list; the error shape; the deep-link parameters `ra`, `dec`, `fov`, `det`, `api`.

A 3.0 client pointed at a 4.0 `/api/cutouts` reads the frames correctly except that it must tolerate `provenance` being an object (3.0's
`validateFrame` compares it with three strings). The matching change proposed for 3.0 is written in `WORKLOG.md`; 3.0 itself is not edited.
