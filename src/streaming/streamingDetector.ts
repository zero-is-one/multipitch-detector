import { BALANCED_PRESET } from "../constants";
import { OfflineKlapuriDetector } from "../core/detector";
import type {
  DetectorOptions,
  PitchCandidate,
  PitchFrameResult,
} from "../types";

export interface StreamingDetectorOptions {
  detector?: Partial<DetectorOptions>;
  hopSize?: number;
  onFrame?: (result: PitchFrameResult) => void;
  smoothingFactor?: number;
  smoothingToleranceCents?: number;
}

export class StreamingKlapuriDetector {
  private readonly detector: OfflineKlapuriDetector;
  private readonly frameSize: number;
  private readonly hopSize: number;
  private readonly onFrame?: (result: PitchFrameResult) => void;
  private readonly buffer: Float32Array;
  private readonly smoothingFactor: number;
  private readonly smoothingToleranceCents: number;
  private writeIndex = 0;
  private bufferedSamples = 0;
  private totalSamples = 0;
  private previousPitches: PitchCandidate[] = [];

  constructor(options: StreamingDetectorOptions = {}) {
    const detectorOptions = {
      ...BALANCED_PRESET,
      ...(options.detector ?? {}),
    };

    this.detector = new OfflineKlapuriDetector(detectorOptions);
    this.frameSize = detectorOptions.frameSize;
    this.hopSize = options.hopSize ?? Math.floor(this.frameSize / 4);
    if (this.hopSize <= 0 || this.hopSize > this.frameSize) {
      throw new Error("hopSize must be in the range [1, frameSize]");
    }

    this.onFrame = options.onFrame;
    this.smoothingFactor = clamp(options.smoothingFactor ?? 0.35, 0, 0.95);
    this.smoothingToleranceCents = options.smoothingToleranceCents ?? 35;
    this.buffer = new Float32Array(this.frameSize * 2);
  }

  processSamples(chunk: Float32Array): PitchFrameResult[] {
    const results: PitchFrameResult[] = [];

    for (let i = 0; i < chunk.length; i += 1) {
      this.buffer[this.writeIndex] = chunk[i];
      this.writeIndex = (this.writeIndex + 1) % this.buffer.length;
      this.bufferedSamples = Math.min(
        this.bufferedSamples + 1,
        this.buffer.length,
      );
      this.totalSamples += 1;

      if (this.bufferedSamples < this.frameSize) {
        continue;
      }

      if ((this.totalSamples - this.frameSize) % this.hopSize === 0) {
        const frame = this.readLatestFrame();
        const result = this.smoothResult(this.detector.analyzeFrame(frame));
        results.push(result);
        this.onFrame?.(result);
      }
    }

    return results;
  }

  reset(): void {
    this.buffer.fill(0);
    this.writeIndex = 0;
    this.bufferedSamples = 0;
    this.totalSamples = 0;
    this.previousPitches = [];
  }

  private readLatestFrame(): Float32Array {
    const out = new Float32Array(this.frameSize);
    const start =
      (this.writeIndex - this.frameSize + this.buffer.length) %
      this.buffer.length;

    for (let i = 0; i < this.frameSize; i += 1) {
      out[i] = this.buffer[(start + i) % this.buffer.length];
    }

    return out;
  }

  private smoothResult(result: PitchFrameResult): PitchFrameResult {
    if (
      !result.pitches.length ||
      !this.previousPitches.length ||
      this.smoothingFactor <= 0
    ) {
      this.previousPitches = clonePitches(result.pitches);
      return result;
    }

    const used = new Set<number>();
    const smoothed = result.pitches.map((pitch) => {
      let matchIndex = -1;
      let matchDistance = Number.POSITIVE_INFINITY;

      for (let i = 0; i < this.previousPitches.length; i += 1) {
        if (used.has(i)) {
          continue;
        }
        const cents = centsDistance(
          pitch.frequencyHz,
          this.previousPitches[i].frequencyHz,
        );
        if (cents <= this.smoothingToleranceCents && cents < matchDistance) {
          matchDistance = cents;
          matchIndex = i;
        }
      }

      if (matchIndex === -1) {
        return { ...pitch };
      }

      used.add(matchIndex);
      const previous = this.previousPitches[matchIndex];
      const blend = this.smoothingFactor;
      return {
        ...pitch,
        frequencyHz:
          previous.frequencyHz * blend + pitch.frequencyHz * (1 - blend),
        confidence: clamp(
          previous.confidence * blend + pitch.confidence * (1 - blend),
          0,
          1,
        ),
        salience: previous.salience * blend + pitch.salience * (1 - blend),
      };
    });

    smoothed.sort((a, b) => a.frequencyHz - b.frequencyHz);
    this.previousPitches = clonePitches(smoothed);

    return {
      ...result,
      pitches: smoothed,
    };
  }
}

function clonePitches(pitches: PitchCandidate[]): PitchCandidate[] {
  return pitches.map((pitch) => ({ ...pitch }));
}

function centsDistance(aHz: number, bHz: number): number {
  return Math.abs(1200 * Math.log2(aHz / bHz));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
