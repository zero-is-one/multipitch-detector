import { MicrophonePitchStream } from "../dist/index.js";

const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const pauseButton = document.getElementById("pauseButton");
const statusValue = document.getElementById("statusValue");
const backendValue = document.getElementById("backendValue");
const frameCountValue = document.getElementById("frameCountValue");
const errorValue = document.getElementById("errorValue");
const debugMetricsToggle = document.getElementById("debugMetricsToggle");
const debugMetricsPanel = document.getElementById("debugMetricsPanel");
const debugRawConfidence = document.getElementById("debugRawConfidence");
const debugBestSalience = document.getElementById("debugBestSalience");
const debugSecondSalience = document.getElementById("debugSecondSalience");
const debugSalienceMargin = document.getElementById("debugSalienceMargin");
const debugBestSecondRatio = document.getElementById("debugBestSecondRatio");
const pitchList = document.getElementById("pitchList");
const logOutput = document.getElementById("logOutput");
const helpButtons = document.querySelectorAll("[data-help-topic]");
const controlsHelpDialog = document.getElementById("controlsHelpDialog");
const helpTopicTitle = document.getElementById("helpTopicTitle");
const helpTopicBody = document.getElementById("helpTopicBody");
const processingMode = document.getElementById("processingMode");
const frameSize = document.getElementById("frameSize");
const hopSize = document.getElementById("hopSize");
const maxPolyphony = document.getElementById("maxPolyphony");
const smoothingFactor = document.getElementById("smoothingFactor");
const smoothingFactorValue = document.getElementById("smoothingFactorValue");
const smoothingTolerance = document.getElementById("smoothingTolerance");
const smoothingToleranceValue = document.getElementById(
  "smoothingToleranceValue",
);

let stream = null;
let frameCount = 0;
let paused = false;
const recentFrames = [];
const helpContent = {
  "processing-mode": {
    title: "Processing mode",
    body: "This chooses how audio gets from the microphone into the detector. Auto tries the modern path first, audio-worklet usually gives smoother timing, and script-processor is the older fallback when worklets are not available.",
  },
  "frame-size": {
    title: "Frame size",
    body: "This is how much audio the detector listens to at one time before making a pitch decision. Larger frames usually make estimates steadier and more accurate, but they also add a bit more delay.",
  },
  "hop-size": {
    title: "Hop size",
    body: "This controls how often a new analysis frame starts. 256 gives the fastest updates and smoothest tracking, but it uses the most CPU. 512 is the middle-ground default: still responsive, with less processing cost. 1024 uses the least CPU, but updates arrive less often, so quick note changes can feel slower or more stepped.",
  },
  "max-polyphony": {
    title: "Max polyphony",
    body: "This sets the maximum number of simultaneous notes the detector is allowed to report. Higher values are better for fuller chords, but they can also make the detector keep weaker or less certain notes.",
  },
  "smoothing-factor": {
    title: "Smoothing factor",
    body: "This blends the newest result with recent results to reduce jitter. Lower values react faster to note changes, while higher values make the display more stable but can make it respond more slowly.",
  },
  "smoothing-tolerance": {
    title: "Smoothing tolerance (cents)",
    body: "This sets how close a new pitch must be to the previous one to be treated as the same continuing note during smoothing. Lower values avoid blending different notes but can look jumpy. Higher values smooth more aggressively, but can smear quick pitch changes or nearby notes.",
  },
};

syncSmoothingLabels();
smoothingFactor.addEventListener("input", syncSmoothingLabels);
smoothingTolerance.addEventListener("input", syncSmoothingLabels);
syncDebugPanelVisibility();
debugMetricsToggle.addEventListener("change", syncDebugPanelVisibility);

helpButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const topic = button.dataset.helpTopic;
    const content = helpContent[topic];

    if (!content) {
      return;
    }

    helpTopicTitle.textContent = content.title;
    helpTopicBody.textContent = content.body;
    controlsHelpDialog.showModal();
  });
});

controlsHelpDialog.addEventListener("click", (event) => {
  const bounds = controlsHelpDialog.getBoundingClientRect();
  const clickedBackdrop =
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom;

  if (clickedBackdrop) {
    controlsHelpDialog.close();
  }
});

pauseButton.addEventListener("click", () => {
  if (!stream) {
    return;
  }

  paused = !paused;
  pauseButton.textContent = paused ? "Resume updates" : "Pause updates";
  setStatus(paused ? "paused" : "running");
  if (paused) {
    clearError();
  }
});

startButton.addEventListener("click", async () => {
  if (stream) {
    return;
  }

  setStatus("starting");
  clearError();

  const selectedFrameSize = Number(frameSize.value);
  const selectedHopSize = Number(hopSize.value);
  const selectedPolyphony = Number(maxPolyphony.value);
  const selectedSmoothingFactor = Number(smoothingFactor.value);
  const selectedSmoothingTolerance = Number(smoothingTolerance.value);

  stream = new MicrophonePitchStream({
    processingMode: processingMode.value,
    hopSize: selectedHopSize,
    smoothingFactor: selectedSmoothingFactor,
    smoothingToleranceCents: selectedSmoothingTolerance,
    detector: {
      frameSize: selectedFrameSize,
      maxPolyphony: selectedPolyphony,
    },
    onFrame: (result) => {
      if (paused) {
        return;
      }

      frameCount += 1;
      frameCountValue.textContent = String(frameCount);
      updatePitchList(result.pitches);
      updateDebugMetrics(result.debug);
      recentFrames.unshift({
        frame: frameCount,
        pitches: result.pitches.map((pitch) => ({
          note: pitch.note,
          hz: Number(pitch.frequencyHz.toFixed(2)),
          confidence: Number(pitch.confidence.toFixed(3)),
        })),
        debug: result.debug
          ? {
              rawConfidence: Number(result.debug.rawConfidence.toFixed(3)),
              bestSalience: Number(result.debug.bestSalience.toFixed(3)),
              secondSalience: Number(result.debug.secondSalience.toFixed(3)),
              salienceMargin: Number(result.debug.salienceMargin.toFixed(3)),
              bestToSecondRatio: Number(
                result.debug.bestToSecondRatio.toFixed(3),
              ),
            }
          : null,
      });
      recentFrames.splice(8);
      logOutput.textContent = JSON.stringify(recentFrames, null, 2);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      errorValue.textContent = message;
    },
  });

  try {
    await stream.start();
    backendValue.textContent = stream.activeBackend ?? "-";
    paused = false;
    pauseButton.textContent = "Pause updates";
    setStatus("running");
    startButton.disabled = true;
    stopButton.disabled = false;
    pauseButton.disabled = false;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errorValue.textContent = message;
    stream = null;
    setStatus("idle");
  }
});

stopButton.addEventListener("click", async () => {
  if (!stream) {
    return;
  }

  await stream.stop();
  stream = null;
  backendValue.textContent = "-";
  setStatus("idle");
  resetDebugMetrics();
  paused = false;
  pauseButton.textContent = "Pause updates";
  startButton.disabled = false;
  stopButton.disabled = true;
  pauseButton.disabled = true;
});

function setStatus(value) {
  statusValue.textContent = value;
}

function clearError() {
  errorValue.textContent = "";
}

function syncSmoothingLabels() {
  smoothingFactorValue.textContent = Number(smoothingFactor.value).toFixed(2);
  smoothingToleranceValue.textContent = String(
    Number(smoothingTolerance.value),
  );
}

function syncDebugPanelVisibility() {
  debugMetricsPanel.hidden = !debugMetricsToggle.checked;
}

function updateDebugMetrics(debug) {
  if (!debug) {
    resetDebugMetrics();
    return;
  }

  debugRawConfidence.textContent = formatNumber(debug.rawConfidence);
  debugBestSalience.textContent = formatNumber(debug.bestSalience);
  debugSecondSalience.textContent = formatNumber(debug.secondSalience);
  debugSalienceMargin.textContent = formatNumber(debug.salienceMargin);
  if (!Number.isFinite(debug.bestToSecondRatio)) {
    debugBestSecondRatio.textContent = "inf";
  } else {
    debugBestSecondRatio.textContent = formatNumber(debug.bestToSecondRatio);
  }
}

function resetDebugMetrics() {
  debugRawConfidence.textContent = "-";
  debugBestSalience.textContent = "-";
  debugSecondSalience.textContent = "-";
  debugSalienceMargin.textContent = "-";
  debugBestSecondRatio.textContent = "-";
}

function formatNumber(value) {
  return Number(value).toFixed(3);
}

function updatePitchList(pitches) {
  if (!pitches.length) {
    pitchList.className = "pitch-list empty";
    pitchList.textContent = "No pitch candidates in this frame";
    return;
  }

  pitchList.className = "pitch-list";
  pitchList.innerHTML = pitches
    .map(
      (pitch) => `
        <article class="pitch-card">
          <strong>${pitch.note}</strong>
          <span>${pitch.frequencyHz.toFixed(2)} Hz</span>
          <span>confidence ${pitch.confidence.toFixed(3)}</span>
        </article>
      `,
    )
    .join("");
}
