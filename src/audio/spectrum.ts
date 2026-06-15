/**
 * Tiny, dependency-free audio spectrum helper for the live voice visualizer.
 *
 * Turns a chunk of 16 kHz mono int16 PCM into a small set of log-spaced
 * frequency-band magnitudes (0..1), cheap enough to run per audio buffer on
 * the JS thread. Uses an in-place iterative radix-2 FFT.
 */

const FFT_SIZE = 512; // power of two; ~32ms window at 16 kHz
const HALF = FFT_SIZE / 2;

// Precomputed bit-reversal + twiddle tables (built once).
const reversed = new Uint16Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i += 1) {
  let r = 0;
  for (let b = 0; b < 9; b += 1) r |= ((i >> b) & 1) << (8 - b); // 9 = log2(512)
  reversed[i] = r;
}
const cosT = new Float32Array(HALF);
const sinT = new Float32Array(HALF);
for (let i = 0; i < HALF; i += 1) {
  cosT[i] = Math.cos((-2 * Math.PI * i) / FFT_SIZE);
  sinT[i] = Math.sin((-2 * Math.PI * i) / FFT_SIZE);
}
// Hann window to reduce spectral leakage.
const hann = new Float32Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i += 1) {
  hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
}

const re = new Float32Array(FFT_SIZE);
const im = new Float32Array(FFT_SIZE);

function fft(): void {
  // bit-reversal permutation
  for (let i = 0; i < FFT_SIZE; i += 1) {
    const j = reversed[i];
    if (j > i) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let size = 2; size <= FFT_SIZE; size <<= 1) {
    const half = size >> 1;
    const step = FFT_SIZE / size;
    for (let i = 0; i < FFT_SIZE; i += size) {
      for (let k = 0; k < half; k += 1) {
        const ti = step * k;
        const c = cosT[ti];
        const s = sinT[ti];
        const a = i + k;
        const b = a + half;
        const xr = re[b] * c - im[b] * s;
        const xi = re[b] * s + im[b] * c;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}

/**
 * Compute `bandCount` log-spaced magnitudes (0..1) from int16 PCM samples.
 * Returns a fresh array; safe to store in React state.
 */
export function computeBands(samples: Int16Array, bandCount = 24): number[] {
  // Fill FFT input from the most recent FFT_SIZE samples (zero-pad if short).
  const n = samples.length;
  const start = Math.max(0, n - FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i += 1) {
    const idx = start + i;
    const v = idx < n ? samples[idx] / 32768 : 0;
    re[i] = v * hann[i];
    im[i] = 0;
  }
  fft();

  // Log-spaced bins across the lower ~half spectrum (speech lives low).
  const bands = new Array<number>(bandCount);
  const minBin = 1;
  const maxBin = HALF - 1;
  const logMin = Math.log(minBin);
  const logMax = Math.log(maxBin);
  for (let band = 0; band < bandCount; band += 1) {
    const lo = Math.floor(Math.exp(logMin + ((logMax - logMin) * band) / bandCount));
    const hi = Math.max(
      lo + 1,
      Math.floor(Math.exp(logMin + ((logMax - logMin) * (band + 1)) / bandCount)),
    );
    let mag = 0;
    for (let bin = lo; bin < hi && bin < HALF; bin += 1) {
      const m = Math.sqrt(re[bin] * re[bin] + im[bin] * im[bin]);
      if (m > mag) mag = m;
    }
    // Compress to a pleasing 0..1 range (sqrt + clamp).
    bands[band] = Math.min(1, Math.sqrt(mag) * 1.6);
  }
  return bands;
}

/** Root-mean-square loudness (0..1) of an int16 PCM chunk. */
export function rms(samples: Int16Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i] / 32768;
    sum += v * v;
  }
  return Math.sqrt(sum / Math.max(1, samples.length));
}
