export interface WhiteningConfig {
  centerBands: Float64Array;
}

export function makeCriticalBands(): Float64Array {
  const cb = new Float64Array(32);
  for (let i = 0; i < 32; i += 1) {
    const b = i + 1;
    cb[i] = 229 * (Math.pow(10, b / 21.4) - 1);
  }
  return cb;
}

export function whitenSpectrum(
  magnitude: Float64Array,
  freqs: Float64Array,
  config: WhiteningConfig,
): Float64Array {
  const out = new Float64Array(magnitude.length);
  const cb = config.centerBands;

  const gammas = new Float64Array(cb.length - 2);
  for (let i = 1; i < cb.length - 1; i += 1) {
    let weightedEnergy = 0;
    let count = 0;
    for (let k = 0; k < freqs.length; k += 1) {
      const w = triangle(freqs[k], cb[i - 1], cb[i], cb[i + 1]);
      if (w > 0) {
        weightedEnergy += w * magnitude[k] * magnitude[k];
        count += 1;
      }
    }
    const std = Math.sqrt(weightedEnergy / Math.max(1, count));
    gammas[i - 1] = Math.pow(Math.max(std, 1e-12), -0.67);
  }

  const gammaByBin = new Float64Array(freqs.length);
  for (let k = 0; k < freqs.length; k += 1) {
    const f = freqs[k];
    gammaByBin[k] = interpolateGamma(f, cb, gammas);
    out[k] = magnitude[k] * gammaByBin[k];
  }

  return out;
}

function triangle(freq: number, lo: number, mid: number, hi: number): number {
  if (freq < lo || freq > hi) {
    return 0;
  }
  if (freq <= mid) {
    return (freq - lo) / Math.max(1e-12, mid - lo);
  }
  return (hi - freq) / Math.max(1e-12, hi - mid);
}

function interpolateGamma(
  freq: number,
  cb: Float64Array,
  gammas: Float64Array,
): number {
  if (freq <= cb[1]) {
    return gammas[0];
  }
  if (freq >= cb[cb.length - 2]) {
    return gammas[gammas.length - 1];
  }

  for (let i = 1; i < cb.length - 2; i += 1) {
    const left = cb[i];
    const right = cb[i + 1];
    if (freq >= left && freq <= right) {
      const t = (freq - left) / Math.max(1e-12, right - left);
      return gammas[i - 1] + (gammas[i] - gammas[i - 1]) * t;
    }
  }

  return gammas[gammas.length - 1];
}
