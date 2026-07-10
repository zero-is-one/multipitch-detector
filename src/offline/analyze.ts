import { BALANCED_PRESET } from "../constants";
import {
  StreamingKlapuriDetector,
  type StreamingDetectorOptions,
} from "../streaming/streamingDetector";
import type { DetectorOptions, PitchFrameResult } from "../types";

export interface OfflineAnalysisOptions {
  detector?: Partial<DetectorOptions>;
  hopSize?: number;
  smoothingFactor?: number;
  smoothingToleranceCents?: number;
}

export interface TimedPitchFrameResult extends PitchFrameResult {
  frameIndex: number;
  timestampSeconds: number;
}

export function analyzeSignal(
  samples: Float32Array,
  options: OfflineAnalysisOptions = {},
): TimedPitchFrameResult[] {
  const detectorOptions = {
    ...BALANCED_PRESET,
    ...(options.detector ?? {}),
  };
  const hopSize = options.hopSize ?? Math.floor(detectorOptions.frameSize / 4);

  const streamingOptions: StreamingDetectorOptions = {
    detector: detectorOptions,
    hopSize,
    smoothingFactor: options.smoothingFactor,
    smoothingToleranceCents: options.smoothingToleranceCents,
  };

  const streaming = new StreamingKlapuriDetector(streamingOptions);
  const frames = streaming.processSamples(samples);

  return frames.map((frame, frameIndex) => ({
    ...frame,
    frameIndex,
    timestampSeconds: (frameIndex * hopSize) / detectorOptions.sampleRate,
  }));
}
