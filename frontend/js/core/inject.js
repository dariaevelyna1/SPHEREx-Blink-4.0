// inject.js: a seeded random generator and injected point sources (a pixel-integrated Gaussian PSF on white noise).
//
// ADAPTED FROM SPHEREx Blink 3.0 (commit 06ac378, same author, MIT): scratch/lib_inject.mjs (erf, pixelCell, gaussianNoise, renderStar) and
// scratch/lib_real.mjs (mulberry32). The function bodies are unchanged; they are only gathered in one module the browser can load.
// tests/test_golden.mjs proves the equivalence: it reproduces 3.0's golden digests, which depend on every function here. See REUSED.md.
//
// The PSF of SPHEREx is smaller than a pixel (FWHM 5.15" in D2 against 6.14"/px, i.e. sigma 0.356 px), so a star is NOT a smooth bump sampled at the pixel
// centres: each pixel holds the INTEGRAL of the PSF over it. That is what renderStar draws, with the error function.

/** Small seeded random generator (mulberry32): the same seed gives the same experiment. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The error function (Abramowitz & Stegun 7.1.26, absolute error below 1.5e-7). */
export function erf(x) {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
}

/** The part of a 1-D Gaussian (centre x0, width sigma) that falls in pixel i, that is in [i, i + 1). */
export const pixelCell = (i, x0, sigma) => 0.5 * (erf((i + 1 - x0) / (sigma * Math.SQRT2)) - erf((i - x0) / (sigma * Math.SQRT2)));

/** A standard normal number from a uniform generator (Box-Muller). */
export function gaussianNoise(rng) {
  const u = Math.max(1e-12, rng()), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * An n x n image (Float32Array) with a star of total flux `flux` (in units of the pixel noise) at (x0, y0) (edge coordinates: the centre of pixel 0 is 0.5),
 * PSF sigma `sigma` px, on white noise of standard deviation `noise` (0 = no noise). `extra` = more stars [{ x, y, flux }] drawn the same way.
 */
export function renderStar(n, x0, y0, flux, sigma, rng, { noise = 1, extra = [] } = {}) {
  const img = new Float32Array(n * n);
  for (const s of [{ x: x0, y: y0, flux }, ...extra]) {
    const px = new Float64Array(n), py = new Float64Array(n);
    for (let i = 0; i < n; i++) { px[i] = pixelCell(i, s.x, sigma); py[i] = pixelCell(i, s.y, sigma); }
    for (let j = 0; j < n; j++) { if (py[j] < 1e-9) continue; for (let i = 0; i < n; i++) img[j * n + i] += s.flux * px[i] * py[j]; }
  }
  if (noise > 0) for (let k = 0; k < img.length; k++) img[k] += noise * gaussianNoise(rng);
  return img;
}
