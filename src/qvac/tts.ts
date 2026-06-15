/**
 * Offline text-to-speech via QVAC's Supertonic (GGML) TTS model.
 *
 * `textToSpeech` returns raw int16 PCM samples; we wrap them in a minimal
 * mono 44.1 kHz WAV, write it to the cache directory, and play it back with
 * expo-audio. This is the "voice" half of voice-to-voice translation:
 * speak → Whisper → Bergamot → Supertonic.
 */
import { textToSpeech as qvacTextToSpeech } from '@qvac/sdk';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { ensureTtsModel, type ProgressListener } from './ModelManager';
import { enqueue } from './queue';
import { sanitizeText } from './security';
import { logEvent } from './telemetry';

/**
 * Languages Supertonic can actually speak on-device.
 *
 * The SDK's load-config schema *claims* en/de/es/it, but the native Supertonic
 * engine rejects de and it at synthesis time ("invalid Supertonic language")
 * — verified empirically on-device (see the `p-tts-langs` stress probe). We
 * only expose voice for the languages that genuinely synthesize, so the Listen
 * button never offers something QVAC can't deliver.
 */
export type TtsLanguage = 'en' | 'es';

const TTS_LANGUAGES: readonly TtsLanguage[] = ['en', 'es'];

/** True when a translation target language can also be spoken aloud. */
export function isTtsLanguage(code: string): code is TtsLanguage {
  return (TTS_LANGUAGES as readonly string[]).includes(code);
}

/**
 * Supertonic emits mono 16-bit PCM at 44.1 kHz. The rate isn't declared in
 * the SDK typings; it matches the SDK's own supertonic example.
 */
const SAMPLE_RATE = 44100;
/** Spoken phrases are short; cap defensively well below synthesis limits. */
const MAX_SPEAK_CHARS = 500;
/** Safety net so `speak()` can never hang if the finish event is lost. */
const PLAYBACK_TIMEOUT_MS = 60_000;
const CLIP_PREFIX = 'wayfarer-tts-';

/** Wrap raw int16 PCM samples in a 44-byte RIFF/WAVE header (PCM, mono). */
function pcmToWav(samples: number[], sampleRate: number): Uint8Array {
  const dataLength = samples.length * 2;
  const bytes = new Uint8Array(44 + dataLength);
  const view = new DataView(bytes.buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format: PCM
  view.setUint16(22, 1, true); // channels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (mono, 16-bit)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, 'data');
  view.setUint32(40, dataLength, true);

  new Int16Array(bytes.buffer, 44, samples.length).set(samples);
  return bytes;
}

/** Delete stale synthesized clips from the cache directory (best-effort). */
function cleanupOldClips(keepUri?: string): void {
  try {
    for (const entry of Paths.cache.list()) {
      if (
        entry instanceof File &&
        entry.name.startsWith(CLIP_PREFIX) &&
        entry.name.endsWith('.wav') &&
        entry.uri !== keepUri
      ) {
        try {
          entry.delete();
        } catch {
          // best-effort
        }
      }
    }
  } catch {
    // best-effort
  }
}

interface ActivePlayback {
  player: AudioPlayer;
  /** Idempotent: stops playback, releases the player, resolves `speak()`. */
  finish: () => void;
}

let active: ActivePlayback | null = null;

/** True while a synthesized clip is audibly playing (not during synthesis). */
export function isSpeaking(): boolean {
  return active !== null;
}

/** Stop the current utterance (best-effort); its `speak()` call resolves. */
export function stopSpeaking(): void {
  active?.finish();
}

/**
 * Play a WAV file and resolve when playback finishes (or is stopped). Only
 * one utterance plays at a time: starting a new one stops the previous.
 */
function playWav(uri: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const player = createAudioPlayer(uri);
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (active?.player === player) active = null;
      clearTimeout(timeout);
      subscription.remove();
      try {
        player.pause();
        player.remove();
      } catch {
        // best-effort: the player may already be released
      }
      resolve();
    };

    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) finish();
    });
    const timeout = setTimeout(finish, PLAYBACK_TIMEOUT_MS);

    active?.finish();
    active = { player, finish };
    player.play();
  });
}

/**
 * Synthesize `text` in `language` and play it through the speaker. Resolves
 * when playback completes (or `stopSpeaking()` is called). Rejects only on
 * synthesis/model failures — playback itself is best-effort.
 */
export async function speak(
  text: string,
  language: TtsLanguage,
  onProgress?: ProgressListener,
): Promise<void> {
  const cleaned = sanitizeText(text, MAX_SPEAK_CHARS);
  if (!cleaned) return;

  const startedAt = Date.now();
  const modelId = await ensureTtsModel(language, onProgress);
  // The TTS engine replaces an in-flight job when a new one arrives, so
  // concurrent utterances are serialized through a FIFO queue.
  const samples = await enqueue('tts', () =>
    qvacTextToSpeech({
      modelId,
      text: cleaned,
      inputType: 'text',
      stream: false,
    }).buffer,
  );

  logEvent({
    kind: 'tts',
    model: `tts:supertonic-${language}`,
    prompt: cleaned,
    totalMs: Date.now() - startedAt,
    extra: { chars: cleaned.length, samples: samples.length },
  });

  if (samples.length === 0) return;

  const clip = new File(Paths.cache, `${CLIP_PREFIX}${Date.now()}.wav`);
  clip.write(pcmToWav(samples, SAMPLE_RATE));
  cleanupOldClips(clip.uri);

  // Switch the audio session out of record mode before playback. If the mic
  // recorder left the session in record/communication mode, playback comes out
  // garbled ("blabber"). Force playback mode for a clean render.
  try {
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  } catch {
    // best-effort
  }

  try {
    await playWav(clip.uri);
  } finally {
    try {
      clip.delete();
    } catch {
      // best-effort
    }
  }
}
