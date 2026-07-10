import type { CandidateLookup, DetectorOptions } from "../types";

export interface SalienceResult {
  values: Float64Array;
}

export function computeSalience(
  whitened: Float64Array,
  freqs: Float64Array,
  candidates: CandidateLookup[],
  options: DetectorOptions,
): SalienceResult {
  const out = new Float64Array(candidates.length);

  for (let c = 0; c < candidates.length; c += 1) {
    const bins = candidates[c].harmonicBins;
    let sum = 0;
    for (let h = 0; h < bins.length; h += 1) {
      const bin = bins[h];
      const f = freqs[bin];
      const harmonicIndex = h + 1;
      const weight =
        (options.sampleRate * f + options.alpha) /
        (harmonicIndex * options.sampleRate * f + options.beta);
      sum += weight * whitened[bin];
    }
    out[c] = sum;
  }

  return { values: out };
}

export function argMax(values: Float64Array): number {
  let index = 0;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] > max) {
      max = values[i];
      index = i;
    }
  }
  return index;
}
