/**
 * Offline speech-to-text via QVAC's Whisper model.
 *
 * The recorder (expo-audio) writes an .m4a file; we hand its path to QVAC's
 * `transcribe`, which runs entirely on-device and auto-detects the language.
 */
import { transcribe as qvacTranscribe } from '@qvac/sdk';
import { ensureTranscribeModel, type ProgressListener } from './ModelManager';
import { toModelPath } from './image';
import { logEvent } from './telemetry';

export interface TranscribeRequest {
  /** file:// URI of the recorded audio clip. */
  audioUri: string;
  /** Model download progress (only fires while the model is being fetched). */
  onProgress?: ProgressListener;
}

/** Transcribe a recorded audio clip to text. Returns trimmed transcript. */
export async function transcribeAudio(req: TranscribeRequest): Promise<string> {
  const modelId = await ensureTranscribeModel(req.onProgress);

  const startedAt = Date.now();
  const text = await qvacTranscribe({
    modelId,
    audioChunk: toModelPath(req.audioUri),
  });

  const transcript = (text ?? '').trim();
  logEvent({
    kind: 'translate',
    model: 'whisper:base',
    prompt: transcript,
    totalMs: Date.now() - startedAt,
    extra: { source: 'voice', chars: transcript.length },
  });

  return transcript;
}
