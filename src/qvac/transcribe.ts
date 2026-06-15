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
  /** Spoken-language ISO code so Whisper decodes in the right script. */
  language?: string;
  /** Model download progress (only fires while the model is being fetched). */
  onProgress?: ProgressListener;
  /** Streaming partial transcript — text appears as the model decodes. */
  onPartial?: (partial: string) => void;
}

/** Transcribe a recorded audio clip to text. Returns trimmed transcript. */
export async function transcribeAudio(req: TranscribeRequest): Promise<string> {
  const language = req.language ?? 'en';
  const modelId = await ensureTranscribeModel(language, req.onProgress);

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
    model: `whisper:${language}`,
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
  const modelId = await ensureTranscribeModel(language, onProgress);
  const clip = new File(Paths.cache, `wayfarer-stt-${Date.now()}.wav`);
  clip.write(pcmToWav(pcm, sampleRate));
  try {
    const startedAt = Date.now();
    const text = await enqueue('transcribe', () =>
      qvacTranscribe({ modelId, audioChunk: toModelPath(clip.uri) }),
    );
    const transcript = (text ?? '').trim();
    logEvent({
      kind: 'transcribe',
      model: `whisper:${language}`,
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
