import type { DetectorOptions } from "./types";

export const BALANCED_PRESET: DetectorOptions = {
  sampleRate: 44100,
  frameSize: 4096,
  minFrequency: 55,
  maxFrequency: 1760,
  maxPolyphony: 4,
  harmonics: 20,
  alpha: 52,
  beta: 320,
  cancellationFactor: 0.89,
  stopExponent: 0.7,
  candidateStepSemitones: 0.5,
};

export function mergeOptions(
  overrides: Partial<DetectorOptions> = {},
): DetectorOptions {
  return {
    ...BALANCED_PRESET,
    ...overrides,
  };
}
