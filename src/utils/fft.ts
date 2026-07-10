import FFT from "fft.js";

export function hannWindow(size: number): Float64Array {
  const w = new Float64Array(size);
  for (let n = 0; n < size; n += 1) {
    w[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (size - 1));
  }
  return w;
}

export function magnitudeSpectrum(
  frame: Float32Array,
  fftSize: number,
): Float64Array {
  const fft = new FFT(fftSize);
  const input = new Float64Array(fftSize);
  const output = new Float64Array(fftSize * 2);

  input.set(frame);
  fft.realTransform(output, input);
  fft.completeSpectrum(output);

  const half = fftSize / 2;
  const magnitude = new Float64Array(half + 1);
  for (let i = 0; i <= half; i += 1) {
    const re = output[2 * i];
    const im = output[2 * i + 1];
    magnitude[i] = Math.hypot(re, im) / (half + 1);
  }

  return magnitude;
}
