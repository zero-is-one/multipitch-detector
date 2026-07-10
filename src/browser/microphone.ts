import type { DetectorOptions, PitchFrameResult } from "../types";
import {
  StreamingKlapuriDetector,
  type StreamingDetectorOptions,
} from "../streaming/streamingDetector";
import {
  getDefaultCaptureWorkletModuleUrl,
  getCaptureProcessorName,
} from "./workletSource";

export type MicrophoneBackend = "audio-worklet" | "script-processor";
export type MicrophoneProcessingMode = MicrophoneBackend | "auto";

export interface MicrophoneDetectorOptions {
  detector?: Partial<DetectorOptions>;
  hopSize?: number;
  onFrame: (result: PitchFrameResult) => void;
  onError?: (error: unknown) => void;
  fftBufferSize?: number;
  processingMode?: MicrophoneProcessingMode;
  workletModuleUrl?: string;
  smoothingFactor?: number;
  smoothingToleranceCents?: number;
}

export class MicrophonePitchStream {
  private readonly options: MicrophoneDetectorOptions;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private monitorGainNode: GainNode | null = null;
  private streaming: StreamingKlapuriDetector | null = null;
  private backend: MicrophoneBackend | null = null;

  constructor(options: MicrophoneDetectorOptions) {
    this.options = options;
  }

  get activeBackend(): MicrophoneBackend | null {
    return this.backend;
  }

  async start(): Promise<void> {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      throw new Error(
        "MicrophonePitchStream is only available in browser environments",
      );
    }

    if (this.audioContext) {
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    const audioContext = new AudioContext();

    const streamingOptions: StreamingDetectorOptions = {
      detector: {
        ...(this.options.detector ?? {}),
        sampleRate:
          this.options.detector?.sampleRate ?? audioContext.sampleRate,
      },
      hopSize: this.options.hopSize,
      onFrame: this.options.onFrame,
      smoothingFactor: this.options.smoothingFactor,
      smoothingToleranceCents: this.options.smoothingToleranceCents,
    };

    const sourceNode = audioContext.createMediaStreamSource(stream);
    const fftBufferSize = this.options.fftBufferSize ?? 2048;
    const streaming = new StreamingKlapuriDetector(streamingOptions);

    const mode = this.options.processingMode ?? "auto";
    const initialized = await this.initializePreferredBackend(
      mode,
      audioContext,
      sourceNode,
      streaming,
      fftBufferSize,
    );

    if (!initialized) {
      throw new Error(
        "Unable to initialize a browser audio processing backend",
      );
    }

    this.stream = stream;
    this.audioContext = audioContext;
    this.sourceNode = sourceNode;
    this.streaming = streaming;
  }

  async stop(): Promise<void> {
    this.workletNode?.port.close();
    this.workletNode?.disconnect();
    this.processorNode?.disconnect();
    this.monitorGainNode?.disconnect();
    this.sourceNode?.disconnect();

    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
    }

    if (this.audioContext) {
      await this.audioContext.close();
    }

    this.streaming?.reset();
    this.stream = null;
    this.audioContext = null;
    this.sourceNode = null;
    this.processorNode = null;
    this.workletNode = null;
    this.monitorGainNode = null;
    this.streaming = null;
    this.backend = null;
  }

  private async initializePreferredBackend(
    mode: MicrophoneProcessingMode,
    audioContext: AudioContext,
    sourceNode: MediaStreamAudioSourceNode,
    streaming: StreamingKlapuriDetector,
    fftBufferSize: number,
  ): Promise<boolean> {
    if (mode !== "script-processor") {
      try {
        await this.initializeAudioWorklet(audioContext, sourceNode, streaming);
        this.backend = "audio-worklet";
        return true;
      } catch (error) {
        if (mode === "audio-worklet") {
          throw error;
        }
        this.options.onError?.(error);
      }
    }

    this.initializeScriptProcessor(
      audioContext,
      sourceNode,
      streaming,
      fftBufferSize,
    );
    this.backend = "script-processor";
    return true;
  }

  private async initializeAudioWorklet(
    audioContext: AudioContext,
    sourceNode: MediaStreamAudioSourceNode,
    streaming: StreamingKlapuriDetector,
  ): Promise<void> {
    if (!audioContext.audioWorklet) {
      throw new Error("AudioWorklet is not available in this browser");
    }

    const moduleUrl =
      this.options.workletModuleUrl ?? getDefaultCaptureWorkletModuleUrl();
    await audioContext.audioWorklet.addModule(moduleUrl);

    const workletNode = new AudioWorkletNode(
      audioContext,
      getCaptureProcessorName(),
      {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
      },
    );
    const monitorGainNode = audioContext.createGain();
    monitorGainNode.gain.value = 0;

    workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
      try {
        streaming.processSamples(event.data);
      } catch (error) {
        this.options.onError?.(error);
      }
    };

    sourceNode.connect(workletNode);
    workletNode.connect(monitorGainNode);
    monitorGainNode.connect(audioContext.destination);

    this.workletNode = workletNode;
    this.monitorGainNode = monitorGainNode;
  }

  private initializeScriptProcessor(
    audioContext: AudioContext,
    sourceNode: MediaStreamAudioSourceNode,
    streaming: StreamingKlapuriDetector,
    fftBufferSize: number,
  ): void {
    const processorNode = audioContext.createScriptProcessor(
      fftBufferSize,
      1,
      1,
    );

    processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
      try {
        const channel = event.inputBuffer.getChannelData(0);
        streaming.processSamples(new Float32Array(channel));
      } catch (error) {
        this.options.onError?.(error);
      }
    };

    sourceNode.connect(processorNode);
    processorNode.connect(audioContext.destination);

    this.processorNode = processorNode;
  }
}
