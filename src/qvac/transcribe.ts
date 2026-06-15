/**
 * Offline speech-to-text via QVAC's Whisper model.
 *
 * The recorder (expo-audio) writes an .m4a file; we hand its path to QVAC's
 * `transcribe`, which runs entirely on-device and auto-detects the language.
 */
import { transcribe as qvacTranscribe, transcribeStream as qvacTranscribeStream } from '@qvac/sdk';
import { File, Paths } from 'expo-file-system';
import { ensureTranscribeModel, type ProgressListener } from './ModelManager';
import { toModelPath } from './image';
import { pcmToWav } from '../audio/wav';
import { enqueue } from './queue';
import { logEvent } from './telemetry';

export interface TranscribeRequest {
  /** file:// URI of the recorded audio clip. */
  audioUri: string;
  /** Model download progress (only fires while the model is being fetched). */
  onProgress?: ProgressListener;
  /** Streaming partial transcript — text appears as the model decodes. */
  onPartial?: (partial: string) => void;
}

/** Transcribe a recorded audio clip to text. Returns trimmed transcript. */
export async function transcribeAudio(req: TranscribeRequest): Promise<string> {
  const modelId = await ensureTranscribeModel('en', req.onProgress);

  const startedAt = Date.now();
  const audioChunk = toModelPath(req.audioUri);

  // When a partial-callback is supplied, stream decoded chunks so the text
  // appears progressively; otherwise fall back to a single blocking call.
  const text = await enqueue('transcribe', async () => {
    if (!req.onPartial) {
      return qvacTranscribe({ modelId, audioChunk });
    }
    let acc = '';
    for await (const chunk of qvacTranscribeStream({ modelId, audioChunk })) {
      acc += chunk;
      req.onPartial(acc.trim());
    }
    return acc;
  });

  const transcript = (text ?? '').trim();
  logEvent({
    kind: 'transcribe',
    model: 'whisper:base',
    prompt: transcript,
    totalMs: Date.now() - startedAt,
    extra: { source: 'voice', chars: transcript.length },
  });

  return transcript;
}

/**
 * Transcribe a buffer of captured mono int16 PCM. Writes a temp WAV and runs
 * the file-based `transcribe()` (the proven decode path), so the live mic
 * capture (expo-audio stream) can be turned into text reliably.
 */
export async function transcribePcm(
  pcm: Int16Array,
  sampleRate: number,
  language = 'en',
  onProgress?: ProgressListener,
): Promise<string> {
  if (pcm.length === 0) return '';
  console.log('[STT] ensureModel lang=', language);
  const modelId = await ensureTranscribeModel(language, onProgress);
  console.log('[STT] model ready, writing wav + transcribing…');
  const clip = new File(Paths.cache, `wayfarer-stt-${Date.now()}.wav`);
  clip.write(pcmToWav(pcm, sampleRate));
  try {
    const startedAt = Date.now();
    const text = await enqueue('transcribe', () =>
      qvacTranscribe({ modelId, audioChunk: toModelPath(clip.uri) }),
    );
    console.log('[STT] transcribe returned');
    const transcript = (text ?? '').trim();
    logEvent({
      kind: 'transcribe',
      model: 'whisper:base',
      prompt: transcript,
      totalMs: Date.now() - startedAt,
      extra: { source: 'voice-live', samples: pcm.length },
    });
    return transcript;
  } finally {
    try {
      clip.delete();
    } catch {
      // best-effort
    }
  }
}

/** A live, push-PCM transcription session for the voice interpreter. */
export interface LiveTranscription {
  /** Feed a chunk of 16 kHz mono int16 PCM. */
  writePcm(bytes: Uint8Array): void;
  /** Stop accepting audio; returns the final trimmed transcript. */
  finish(): Promise<string>;
}

/**
 * Open a streaming Whisper session. Audio is pushed in via `writePcm`; the
 * running transcript is reported through `onText`. The caller drives start /
 * stop (e.g. via silence detection) and awaits `finish()` for the final text.
 */
export async function startLiveTranscription(opts: {
  onProgress?: ProgressListener;
  /** Running transcript (already trimmed). */
  onText?: (text: string) => void;
}): Promise<LiveTranscription> {
  const modelId = await ensureTranscribeModel('en', opts.onProgress);
  const session = await qvacTranscribeStream({ modelId });

  let acc = '';
  let ended = false;
  const drained = (async () => {
    try {
      for await (const chunk of session) {
        acc += chunk;
        opts.onText?.(acc.trim());
      }
    } catch {
      // session ended mid-stream — expected on finish()
    }
  })();

  return {
    writePcm: (bytes) => {
      if (ended) return;
      try {
        session.write(bytes);
      } catch {
        // session closed between the silence check and this write
      }
    },
    finish: async () => {
      if (!ended) {
        ended = true;
        try {
          session.end();
        } catch {
          // already closed
        }
      }
      await drained;
      const transcript = acc.trim();
      logEvent({
        kind: 'transcribe',
        model: 'whisper:base',
        prompt: transcript,
        extra: { source: 'voice-live', chars: transcript.length },
      });
      return transcript;
    },
  };
}
