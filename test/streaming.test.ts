import { describe, expect, it } from "vitest";
import { StreamingKlapuriDetector } from "../src/streaming/streamingDetector";

function sineWave(
  frequencyHz: number,
  sampleRate: number,
  length: number,
  amp = 1,
): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    out[i] = amp * Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate);
  }
  return out;
}

describe("StreamingKlapuriDetector", () => {
  it("emits stable frame detections from chunked input", () => {
    const sampleRate = 44100;
    const frameSize = 2048;
    const hopSize = 512;

    const detector = new StreamingKlapuriDetector({
      detector: {
        sampleRate,
        frameSize,
        minFrequency: 55,
        maxFrequency: 880,
        maxPolyphony: 4,
      },
      hopSize,
    });

    const signal = sineWave(220, sampleRate, sampleRate);
    const chunkSizes = [317, 911, 128, 777, 2048, 300, 1280, 64, 512];

    const results = [] as number[];
    let cursor = 0;
    let chunkIndex = 0;
    while (cursor < signal.length) {
      const chunkSize = chunkSizes[chunkIndex % chunkSizes.length];
      const end = Math.min(signal.length, cursor + chunkSize);
      const chunk = signal.slice(cursor, end);
      const frames = detector.processSamples(chunk);
      for (const frame of frames) {
        if (frame.pitches.length > 0) {
          results.push(frame.pitches[0].frequencyHz);
        }
      }
      cursor = end;
      chunkIndex += 1;
    }

    expect(results.length).toBeGreaterThan(40);

    const near220 = results.filter((hz) => Math.abs(hz - 220) < 18).length;
    const ratio = near220 / results.length;
    expect(ratio).toBeGreaterThan(0.75);
  });

  it("matches callback emissions to returned frames across hop boundaries", () => {
    const sampleRate = 44100;
    const frameSize = 1024;
    const hopSize = 256;
    const callbackFrequencies: number[] = [];

    const detector = new StreamingKlapuriDetector({
      detector: {
        sampleRate,
        frameSize,
        minFrequency: 55,
        maxFrequency: 880,
        maxPolyphony: 4,
      },
      hopSize,
      onFrame: (result) => {
        callbackFrequencies.push(result.pitches[0]?.frequencyHz ?? 0);
      },
    });

    const signalLength = frameSize + hopSize * 6;
    const signal = sineWave(220, sampleRate, signalLength);
    const returnedFrames = detector.processSamples(signal);

    expect(returnedFrames).toHaveLength(7);
    expect(callbackFrequencies).toHaveLength(returnedFrames.length);

    const returnedFrequencies = returnedFrames.map(
      (frame) => frame.pitches[0]?.frequencyHz ?? 0,
    );
    expect(callbackFrequencies).toEqual(returnedFrequencies);
  });

  it("restarts cleanly after reset", () => {
    const sampleRate = 44100;
    const frameSize = 1024;
    const hopSize = 256;
    const detector = new StreamingKlapuriDetector({
      detector: {
        sampleRate,
        frameSize,
        minFrequency: 55,
        maxFrequency: 880,
        maxPolyphony: 4,
      },
      hopSize,
    });

    const signalLength = frameSize + hopSize * 3;
    const signal = sineWave(220, sampleRate, signalLength);

    const firstPass = detector.processSamples(signal);
    detector.reset();
    const secondPass = detector.processSamples(signal);

    expect(secondPass).toHaveLength(firstPass.length);
    expect(
      secondPass.map((frame) => frame.pitches[0]?.frequencyHz ?? 0),
    ).toEqual(firstPass.map((frame) => frame.pitches[0]?.frequencyHz ?? 0));
  });

  it("smooths small frequency jitter between adjacent frames", () => {
    const sampleRate = 44100;
    const frameSize = 2048;
    const hopSize = 512;

    const withoutSmoothing = new StreamingKlapuriDetector({
      detector: {
        sampleRate,
        frameSize,
        minFrequency: 55,
        maxFrequency: 880,
        maxPolyphony: 4,
      },
      hopSize,
      smoothingFactor: 0,
    });

    const withSmoothing = new StreamingKlapuriDetector({
      detector: {
        sampleRate,
        frameSize,
        minFrequency: 55,
        maxFrequency: 880,
        maxPolyphony: 4,
      },
      hopSize,
      smoothingFactor: 0.6,
      smoothingToleranceCents: 250,
    });

    const signalA = sineWave(220, sampleRate, frameSize + hopSize * 2);
    const signalB = sineWave(246.94, sampleRate, frameSize + hopSize * 2);

    const raw = [
      ...withoutSmoothing.processSamples(signalA),
      ...withoutSmoothing.processSamples(signalB),
    ];
    const smooth = [
      ...withSmoothing.processSamples(signalA),
      ...withSmoothing.processSamples(signalB),
    ];

    const rawDominant = raw.map(
      (frame) => frame.pitches.at(-1)?.frequencyHz ?? 0,
    );
    const smoothDominant = smooth.map(
      (frame) => frame.pitches.at(-1)?.frequencyHz ?? 0,
    );

    const rawVariation = totalVariation(rawDominant);
    const smoothVariation = totalVariation(smoothDominant);

    expect(smoothVariation).toBeLessThan(rawVariation);
    expect(smoothDominant.at(-1) ?? 0).toBeGreaterThan(220);
  });
});

function totalVariation(values: number[]): number {
  let total = 0;
  for (let i = 1; i < values.length; i += 1) {
    total += Math.abs(values[i] - values[i - 1]);
  }
  return total;
}
