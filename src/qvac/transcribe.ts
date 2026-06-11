/**
 * Offline speech-to-text via QVAC's Whisper model.
 *
 * The recorder (expo-audio) writes an .m4a file; we hand its path to QVAC's
 * `transcribe`, which runs entirely on-device and auto-detects the language.
 */
import { transcribe as qvacTranscribe, transcribeStream as qvacTranscribeStream } from '@qvac/sdk';
import { ensureTranscribeModel, type ProgressListener } from './ModelManager';
import { toModelPath } from './image';
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
  const modelId = await ensureTranscribeModel(req.onProgress);

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
