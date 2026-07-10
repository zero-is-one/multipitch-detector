# multi-pitch detector

TypeScript library for browser-first multi-pitch detection inspired by Anssi Klapuri's 2006 harmonic summation method.

## Current status

This repository currently provides an offline frame analyzer:

- `OfflineKlapuriDetector` in `src/core/detector.ts`
- Frame-wise output with `frequencyHz`, `midi`, `note`, `confidence`, and salience
- Iterative salience + cancellation loop with configurable max polyphony
- `StreamingKlapuriDetector` for chunked real-time sample processing
- `MicrophonePitchStream` for browser microphone integration
- AudioWorklet-first microphone backend with ScriptProcessor fallback for older browsers

## Install

```bash
npm install multipitch-detector
```

With other package managers:

```bash
yarn add multipitch-detector
pnpm add multipitch-detector
bun add multipitch-detector
```

## Development Setup

```bash
npm install
```

## Build

```bash
npm run build
```

## Demo

```bash
npm run demo
```

Then open `http://localhost:4173/demo/` in a browser with microphone permission enabled.

## GitHub Pages Demo

The repository now includes a GitHub Pages deployment workflow. After you enable Pages in the repository settings, each push to `main` will publish a static build of the demo.

The deployed URLs will be:

- Repository landing page: `https://<your-user>.github.io/<your-repo>/`
- Demo page: `https://<your-user>.github.io/<your-repo>/demo/`

To build the Pages artifact locally:

```bash
npm run pages:build
```

That generates a `site/` folder containing the static files that GitHub Pages deploys.

## Test

```bash
npm test
```

## Offline Wav Evaluation

```bash
npm run evaluate:wav -- path/to/file.wav
```

This prints frame-by-frame JSON with timestamps and detected pitches. The wav reader currently supports PCM integer wav files and 32-bit float wav files, and downmixes multichannel audio to mono before analysis.

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

## Demo Notes

- The demo is a lightweight static page that imports the built library from `dist/`.
- `processingMode: "auto"` prefers AudioWorklet and falls back to ScriptProcessor if unavailable.
- The package build now emits `dist/capture.worklet.js`, which is the default AudioWorklet module used by `MicrophonePitchStream`.
- The streaming detector now applies a light temporal smoother by default to reduce frame-to-frame pitch jitter in live use.
- If you change source files, rerun `npm run build` before refreshing the demo page.
- For GitHub Pages, the workflow publishes a prebuilt `site/` directory that contains both `demo/` and `dist/`.
