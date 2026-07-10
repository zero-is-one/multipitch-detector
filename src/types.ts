export interface DetectorOptions {
  sampleRate: number;
  frameSize: number;
  minFrequency: number;
  maxFrequency: number;
  maxPolyphony: number;
  harmonics: number;
  alpha: number;
  beta: number;
  cancellationFactor: number;
  stopExponent: number;
  candidateStepSemitones: number;
}

export interface PitchCandidate {
  frequencyHz: number;
  midi: number;
  note: string;
  confidence: number;
  salience: number;
}

export interface DetectionDebugMetrics {
  bestSalience: number;
  secondSalience: number;
  salienceMargin: number;
  bestToSecondRatio: number;
  rawConfidence: number;
}

export interface PitchFrameResult {
  pitches: PitchCandidate[];
  frameEnergy: number;
  debug?: DetectionDebugMetrics;
}

export interface CandidateLookup {
  frequencyHz: number;
  harmonicBins: Int32Array;
}
