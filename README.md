# multipitch detector

TypeScript library for browser-first multi-pitch detection inspired by Anssi Klapuri's 2006 harmonic summation method.

## Install

```bash
npm install multipitch-detector
yarn add multipitch-detector
pnpm add multipitch-detector
bun add multipitch-detector
```

## Browser Microphone Example

```ts
import { MicrophonePitchStream } from "multipitch-detector";

const mic = new MicrophonePitchStream({
  onFrame: (result) => {
    console.log(result.pitches);
  },
  onError: (error) => {
    console.error(error);
  },
  processingMode: "auto",
  workletModuleUrl: new URL("./capture.worklet.js", import.meta.url).toString(),
});

await mic.start();
console.log(mic.activeBackend);
// ... later
await mic.stop();
```

## Example

```ts
import { OfflineKlapuriDetector } from "multipitch-detector";

const detector = new OfflineKlapuriDetector({
  sampleRate: 44100,
  frameSize: 4096,
  maxPolyphony: 4,
});

const frame = new Float32Array(4096);
const result = detector.analyzeFrame(frame);
console.log(result.pitches);
```

## Streaming Example

```ts
import { StreamingKlapuriDetector } from "multipitch-detector";

const stream = new StreamingKlapuriDetector({
  detector: { sampleRate: 44100, frameSize: 2048 },
  hopSize: 512,
  onFrame: (result) => {
    console.log(result.pitches);
  },
});

// Call this from your audio callback with incoming PCM data.
stream.processSamples(new Float32Array(512));
```

## Demo Notes

- The demo is a lightweight static page that imports the built library from `dist/`.
- `processingMode: "auto"` prefers AudioWorklet and falls back to ScriptProcessor if unavailable.
- The package build now emits `dist/capture.worklet.js`, which is the default AudioWorklet module used by `MicrophonePitchStream`.
- The streaming detector now applies a light temporal smoother by default to reduce frame-to-frame pitch jitter in live use.
- If you change source files, rerun `npm run build` before refreshing the demo page.
- For GitHub Pages, the workflow publishes a prebuilt `site/` directory that contains both `demo/` and `dist/`.

## AI Disclaimer

The majority of this project was written by AI. The code, documentation, and implementation decisions should still be reviewed and validated by a human before use in production or other critical environments.
