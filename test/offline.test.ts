import { describe, expect, it } from "vitest";
import { analyzeSignal } from "../src/offline/analyze";
import { parseWav } from "../src/offline/wav";

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

function encodeMono16BitWav(
  samples: Float32Array,
  sampleRate: number,
): Uint8Array {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  writeTag(bytes, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeTag(bytes, 8, "WAVE");
  writeTag(bytes, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeTag(bytes, 36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(value * 32767), true);
  }

  return bytes;
}

function writeTag(bytes: Uint8Array, offset: number, tag: string): void {
  for (let i = 0; i < 4; i += 1) {
    bytes[offset + i] = tag.charCodeAt(i);
  }
}

describe("offline analysis", () => {
  it("parses PCM wav bytes and analyzes note frames", () => {
    const sampleRate = 44100;
    const signal = sineWave(220, sampleRate, sampleRate);
    const wav = encodeMono16BitWav(signal, sampleRate);

    const parsed = parseWav(wav);
    expect(parsed.sampleRate).toBe(sampleRate);
    expect(parsed.channelCount).toBe(1);
    expect(parsed.samples.length).toBe(signal.length);

    const frames = analyzeSignal(parsed.samples, {
      detector: {
        sampleRate: parsed.sampleRate,
        frameSize: 2048,
        minFrequency: 55,
        maxFrequency: 880,
      },
      hopSize: 512,
    });

    expect(frames.length).toBeGreaterThan(40);
    const firstPitch = frames.find((frame) => frame.pitches.length > 0)
      ?.pitches[0];
    expect(firstPitch).toBeDefined();
    expect(Math.abs(firstPitch!.frequencyHz - 220)).toBeLessThan(18);
    expect(firstPitch!.confidence).toBeGreaterThan(0);
  });
});
