import { describe, expect, it } from "vitest";
import { OfflineKlapuriDetector } from "../src/core/detector";

function sineFrame(
  freqHz: number,
  sampleRate: number,
  frameSize: number,
  amp = 1,
): Float32Array {
  const out = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i += 1) {
    out[i] = amp * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return out;
}

function sumFrames(frames: Float32Array[]): Float32Array {
  const n = frames[0].length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    let v = 0;
    for (const f of frames) {
      v += f[i];
    }
    out[i] = v;
  }
  return out;
}

describe("OfflineKlapuriDetector", () => {
  it("detects a strong monophonic tone", () => {
    const detector = new OfflineKlapuriDetector({
      frameSize: 4096,
      sampleRate: 44100,
      minFrequency: 55,
      maxFrequency: 880,
      maxPolyphony: 4,
    });

    const frame = sineFrame(220, 44100, 4096);
    const result = detector.analyzeFrame(frame);

    expect(result.pitches.length).toBeGreaterThan(0);
    expect(result.pitches[0].frequencyHz).toBeGreaterThan(200);
    expect(result.pitches[0].frequencyHz).toBeLessThan(240);
  });

  it("returns two pitches for a dyad", () => {
    const detector = new OfflineKlapuriDetector({
      frameSize: 4096,
      sampleRate: 44100,
      minFrequency: 55,
      maxFrequency: 880,
      maxPolyphony: 4,
    });

    const frame = sumFrames([
      sineFrame(220, 44100, 4096, 0.8),
      sineFrame(329.63, 44100, 4096, 0.8),
    ]);

    const result = detector.analyzeFrame(frame);

    expect(result.pitches.length).toBeGreaterThanOrEqual(2);

    const hz = result.pitches.map((p) => p.frequencyHz);
    const has220 = hz.some((f) => Math.abs(f - 220) < 20);
    const has330 = hz.some((f) => Math.abs(f - 329.63) < 25);
    expect(has220).toBe(true);
    expect(has330).toBe(true);
  });
});
