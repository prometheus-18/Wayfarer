/**
 * Wrap raw mono int16 PCM samples in a 44-byte RIFF/WAVE header so the bytes
 * can be written to a file and handed to QVAC's `transcribe()` (or any decoder).
 */
export function pcmToWav(samples: Int16Array | number[], sampleRate: number): Uint8Array {
  const n = samples.length;
  const dataLength = n * 2;
  const bytes = new Uint8Array(44 + dataLength);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (mono, 16-bit)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, dataLength, true);

  const out = new Int16Array(bytes.buffer, 44, n);
  if (samples instanceof Int16Array) {
    out.set(samples);
  } else {
    for (let i = 0; i < n; i += 1) out[i] = samples[i];
  }
  return bytes;
}
