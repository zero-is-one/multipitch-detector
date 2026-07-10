export interface ParsedWav {
  sampleRate: number;
  channelCount: number;
  bitDepth: number;
  formatCode: number;
  samples: Float32Array;
}

export function parseWav(buffer: ArrayBuffer | Uint8Array): ParsedWav {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  assertTag(bytes, 0, "RIFF");
  assertTag(bytes, 8, "WAVE");

  let offset = 12;
  let formatCode = 0;
  let channelCount = 0;
  let sampleRate = 0;
  let bitDepth = 0;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= bytes.length) {
    const chunkId = readTag(bytes, offset);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;

    if (chunkId === "fmt ") {
      formatCode = view.getUint16(chunkDataOffset, true);
      channelCount = view.getUint16(chunkDataOffset + 2, true);
      sampleRate = view.getUint32(chunkDataOffset + 4, true);
      bitDepth = view.getUint16(chunkDataOffset + 14, true);
    } else if (chunkId === "data") {
      dataOffset = chunkDataOffset;
      dataSize = chunkSize;
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (
    !formatCode ||
    !channelCount ||
    !sampleRate ||
    !bitDepth ||
    dataOffset < 0
  ) {
    throw new Error("Incomplete WAV file: missing fmt or data chunk");
  }

  const bytesPerSample = bitDepth / 8;
  const frameCount = Math.floor(dataSize / (bytesPerSample * channelCount));
  const mono = new Float32Array(frameCount);

  for (let frame = 0; frame < frameCount; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sampleOffset =
        dataOffset + (frame * channelCount + channel) * bytesPerSample;
      sum += readSample(view, sampleOffset, formatCode, bitDepth);
    }
    mono[frame] = sum / channelCount;
  }

  return {
    sampleRate,
    channelCount,
    bitDepth,
    formatCode,
    samples: mono,
  };
}

function readSample(
  view: DataView,
  offset: number,
  formatCode: number,
  bitDepth: number,
): number {
  if (formatCode === 3 && bitDepth === 32) {
    return view.getFloat32(offset, true);
  }

  if (formatCode !== 1) {
    throw new Error(`Unsupported WAV format code ${formatCode}`);
  }

  switch (bitDepth) {
    case 8:
      return (view.getUint8(offset) - 128) / 128;
    case 16:
      return view.getInt16(offset, true) / 32768;
    case 24:
      return readInt24(view, offset) / 8388608;
    case 32:
      return view.getInt32(offset, true) / 2147483648;
    default:
      throw new Error(`Unsupported PCM bit depth ${bitDepth}`);
  }
}

function readInt24(view: DataView, offset: number): number {
  const a = view.getUint8(offset);
  const b = view.getUint8(offset + 1);
  const c = view.getUint8(offset + 2);
  const value = a | (b << 8) | (c << 16);
  return value & 0x800000 ? value | ~0xffffff : value;
}

function assertTag(bytes: Uint8Array, offset: number, expected: string): void {
  if (readTag(bytes, offset) !== expected) {
    throw new Error(`Invalid WAV file: expected ${expected}`);
  }
}

function readTag(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3],
  );
}
