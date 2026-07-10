import { readFile } from "node:fs/promises";
import { analyzeSignal, parseWav } from "../dist/index.js";

const [, , inputPath] = process.argv;

if (!inputPath) {
  console.error("Usage: node scripts/evaluate-wav.mjs <file.wav>");
  process.exit(1);
}

const wavBytes = await readFile(inputPath);
const parsed = parseWav(wavBytes);
const frames = analyzeSignal(parsed.samples, {
  detector: {
    sampleRate: parsed.sampleRate,
  },
});

const summary = frames.map((frame) => ({
  frameIndex: frame.frameIndex,
  timestampSeconds: Number(frame.timestampSeconds.toFixed(3)),
  pitches: frame.pitches.map((pitch) => ({
    note: pitch.note,
    frequencyHz: Number(pitch.frequencyHz.toFixed(2)),
    confidence: Number(pitch.confidence.toFixed(3)),
  })),
}));

console.log(
  JSON.stringify(
    {
      sampleRate: parsed.sampleRate,
      channelCount: parsed.channelCount,
      frameCount: frames.length,
      frames: summary,
    },
    null,
    2,
  ),
);
