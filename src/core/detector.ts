import { mergeOptions } from "../constants";
import type {
  CandidateLookup,
  DetectionDebugMetrics,
  DetectorOptions,
  PitchCandidate,
  PitchFrameResult,
} from "../types";
import { hannWindow, magnitudeSpectrum } from "../utils/fft";
import { hzToMidi, midiToNoteName } from "../utils/music";
import { buildCandidates, buildFrequencyBins } from "./candidates";
import { argMax, computeSalience } from "./salience";
import { makeCriticalBands, whitenSpectrum } from "./whitening";

export class OfflineKlapuriDetector {
  private readonly options: DetectorOptions;
  private readonly fftSize: number;
  private readonly frequencies: Float64Array;
  private readonly window: Float64Array;
  private readonly candidates: CandidateLookup[];
  private readonly centerBands: Float64Array;

  constructor(overrides: Partial<DetectorOptions> = {}) {
    this.options = mergeOptions(overrides);
    this.fftSize = this.options.frameSize * 2;
    this.frequencies = buildFrequencyBins(
      this.options.sampleRate,
      this.fftSize,
    );
    this.window = hannWindow(this.options.frameSize);
    this.candidates = buildCandidates(this.options, this.frequencies);
    this.centerBands = makeCriticalBands();
  }

  analyzeFrame(input: Float32Array): PitchFrameResult {
    if (input.length !== this.options.frameSize) {
      throw new Error(
        `Expected frameSize=${this.options.frameSize}, received=${input.length}`,
      );
    }

    const windowed = new Float32Array(input.length);
    let frameEnergy = 0;
    for (let i = 0; i < input.length; i += 1) {
      const sample = input[i] * this.window[i];
      windowed[i] = sample;
      frameEnergy += sample * sample;
    }

    const magnitude = magnitudeSpectrum(windowed, this.fftSize);
    const whitened = whitenSpectrum(magnitude, this.frequencies, {
      centerBands: this.centerBands,
    });

    const selected: PitchCandidate[] = [];
    const residual = new Float64Array(whitened);
    const explained = new Float64Array(whitened.length);
    let bestPolyphonyScore = Number.NEGATIVE_INFINITY;
    let debug: DetectionDebugMetrics | undefined;

    for (let p = 1; p <= this.options.maxPolyphony; p += 1) {
      const salience = computeSalience(
        residual,
        this.frequencies,
        this.candidates,
        this.options,
      ).values;
      const bestIndex = argMax(salience);
      const bestSalience = salience[bestIndex];
      const secondSalience = secondBest(salience, bestIndex);
      const rawConfidence = confidence(bestSalience, secondSalience);

      if (p === 1) {
        debug = {
          bestSalience,
          secondSalience,
          salienceMargin: bestSalience - secondSalience,
          bestToSecondRatio:
            secondSalience > 0 ? bestSalience / secondSalience : Infinity,
          rawConfidence,
        };
      }

      const cand = this.candidates[bestIndex];
      selected.push({
        frequencyHz: cand.frequencyHz,
        midi: hzToMidi(cand.frequencyHz),
        note: midiToNoteName(hzToMidi(cand.frequencyHz)),
        confidence: rawConfidence,
        salience: bestSalience,
      });

      cancelCandidate(
        residual,
        explained,
        cand,
        this.frequencies,
        this.options,
      );

      let explainedSum = 0;
      for (let i = 0; i < explained.length; i += 1) {
        explainedSum += explained[i];
      }
      const score = explainedSum / Math.pow(p, this.options.stopExponent);
      if (score > bestPolyphonyScore) {
        bestPolyphonyScore = score;
      } else {
        selected.pop();
        break;
      }
    }

    selected.sort((a, b) => a.frequencyHz - b.frequencyHz);

    return {
      pitches: selected,
      frameEnergy,
      debug,
    };
  }
}

function cancelCandidate(
  residual: Float64Array,
  explained: Float64Array,
  cand: CandidateLookup,
  freqs: Float64Array,
  options: DetectorOptions,
): void {
  for (let h = 0; h < cand.harmonicBins.length; h += 1) {
    const harmonic = h + 1;
    const centerBin = cand.harmonicBins[h];
    for (let offset = -1; offset <= 1; offset += 1) {
      const bin = centerBin + offset;
      if (bin < 0 || bin >= residual.length) {
        continue;
      }
      const f = freqs[bin];
      const weight =
        (options.sampleRate * f + options.alpha) /
        (harmonic * options.sampleRate * f + options.beta);
      explained[bin] += weight * residual[bin];
      const cancelled =
        residual[bin] - explained[bin] * options.cancellationFactor;
      residual[bin] = cancelled > 0 ? cancelled : 0;
    }
  }
}

function secondBest(values: Float64Array, bestIndex: number): number {
  let out = 0;
  for (let i = 0; i < values.length; i += 1) {
    if (i === bestIndex) {
      continue;
    }
    out = Math.max(out, values[i]);
  }
  return out;
}

function confidence(best: number, second: number): number {
  if (best <= 0) {
    return 0;
  }
  const ratio = (best - second) / best;
  return Math.max(0, Math.min(1, ratio));
}
