import type { CandidateLookup, DetectorOptions } from "../types";

export function buildFrequencyBins(
  sampleRate: number,
  fftSize: number,
): Float64Array {
  const bins = new Float64Array(fftSize / 2 + 1);
  const nyquist = sampleRate / 2;
  for (let i = 0; i < bins.length; i += 1) {
    bins[i] = (i * nyquist) / (bins.length - 1);
  }
  return bins;
}

export function buildCandidates(
  options: DetectorOptions,
  frequencies: Float64Array,
): CandidateLookup[] {
  const out: CandidateLookup[] = [];
  const ratio = Math.pow(2, options.candidateStepSemitones / 12);

  for (let f0 = options.minFrequency; f0 <= options.maxFrequency; f0 *= ratio) {
    const harmonicBins = new Int32Array(options.harmonics);
    for (let h = 1; h <= options.harmonics; h += 1) {
      const target = f0 * h;
      harmonicBins[h - 1] = nearestBin(frequencies, target);
    }
    out.push({
      frequencyHz: f0,
      harmonicBins,
    });
  }

  return out;
}

function nearestBin(frequencies: Float64Array, targetHz: number): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < frequencies.length; i += 1) {
    const d = Math.abs(frequencies[i] - targetHz);
    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = i;
    }
  }
  return bestIndex;
}
