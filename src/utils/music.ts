const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

export function hzToMidi(frequencyHz: number): number {
  return 69 + 12 * Math.log2(frequencyHz / 440);
}

export function midiToNoteName(midi: number): string {
  const rounded = Math.round(midi);
  const note = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${note}${octave}`;
}

export function toPowerSpectrumMagnitude(
  complexMagnitudes: Float64Array,
): Float64Array {
  const out = new Float64Array(complexMagnitudes.length);
  for (let i = 0; i < complexMagnitudes.length; i += 1) {
    const value = complexMagnitudes[i];
    out[i] = value * value;
  }
  return out;
}
