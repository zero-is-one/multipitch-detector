const PROCESSOR_NAME = "multipitch-capture-processor";

export function getCaptureProcessorName(): string {
  return PROCESSOR_NAME;
}

export function getDefaultCaptureWorkletModuleUrl(): string {
  return new URL("./capture.worklet.js", import.meta.url).toString();
}
