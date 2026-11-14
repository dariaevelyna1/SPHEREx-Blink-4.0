# Scientific limitations

A candidate is a lead with its evidence, never a discovery. Nothing this application has produced is an unknown object.
Numbers and their commands: [VALIDATION.md](VALIDATION.md).

## Data

- The public demo runs on **synthetic** fields made by this project's code. They are not observations, not simulations of a real place on the
  sky, and not AI-generated. No SPHEREx pixel is in the repository or in the public site.
- The real-data path (`full` profile) is off by default and has never been run against the archive or a cloud bucket. SPHEREx data terms and
  acknowledgement wording are **[unverified]**.
- "REAL · derived numbers" in the interface are four results quoted from SPHEREx Blink 3.0's validation (two fast stars, tuned-on fields): a
  check that the search recovers known motions, not a survey.

## The synthetic fields (what is simplified)

- White noise of the same level in every image; a Gaussian PSF of one width (0.4 px), integrated over pixels; no bad pixels (masks are all zero).
- The same brightness at every wavelength. Through SPHEREx's variable filter a real source changes brightness from image to image.
- Movers go in straight lines at constant speed, with no parallax. Real Solar System bodies loop (the Earth moves).
- All images sit on one perfect grid apart from a jitter of 0.05 px; real exposures differ by up to about 0.7 px (3.0 measured it).
- **Stars are kept at least 4 px away from every mover's path.** Without that, a mover that passes within a couple of pixels of a star blends
  with it, its measured position is pulled off the line (up to 0.6 px here) and the detector does not link it. So the bundle's fields are easy
  cases, and a real field is not.
- Pixel values are in units of the noise: they have no physical unit (`unit` is null), and the interface says so.
- Wavelengths of synthetic frames are drawn inside a rough band per detector (3.0's nominal table, itself an assumption) so that the interface has
  something to show; they mean nothing physically.

## The mover search (reused from 3.0 unchanged, `movers-2`)

- Uses **positions only**, never brightness.
- Needs images from at least 3 survey passes (runs of images less than 30 days apart); motion below about 0.8 px over the whole period looks like a still star.
- Misses a mover that blends with a star, and one faster than 60 px per year.
- "Chance lines expected" is the number of lines chance alone would make in the field; it is not a probability of being real. A large significance
  (σ) is not evidence that a line is real.
- Its validation on real data is 3.0's; 4.0 did not repeat it (4.0 proves only that the code is the same and gives the same output on 3.0's golden scenarios).

## Coordinates

- Sky positions use the flat-sky mapping of `geometry.js`, not the exact TAN projection of the grid. 3.0 measured the difference at a field corner:
  0.002 px for a 5 arcmin field at Dec 5°, 0.035 px at Dec 60°. Fine for the 5 arcmin fields used here.
- Motions in arcsec per year are the pixel velocity times the pixel scale (east = -x, north = -y); the error is the detector's velocity error times the scale.
- The time of a real frame is the header's `MJD-OBS` as given; its time scale is not verified.

## Display

- Every picture is a **derived display product**: an asinh stretch of the float pixels, drawn by the browser. It is never used for a measurement.
- Difference and stack are pictures made from several images; no single pixel value belongs to them.

## The game (Learn view)

- The score measures how close a tap is to where the **injected** mover is in the image shown. It is a game on synthetic data, not a measurement.

## Backend

- The rate limit is per client address and in memory: it resets when the server restarts and is per instance if several run.
- A provenance record says what was used and when; it does not say the result is right. A header check does not authenticate where a file came from; the SHA-256 of the original does.

## Science workspace

- The pointer's RA/Dec uses the flat-sky mapping of the grid (`pixelToSky`); it is not a full WCS of an original exposure.
- The picture is an asinh-stretched display product; the pointer value and every measurement read the float pixels, never the picture.
- Difference mode subtracts the mean of the other survey passes; a mover that stays put within one pass is not subtracted away by its own pass, but a mover that crosses its own position in another pass leaves a residual.
