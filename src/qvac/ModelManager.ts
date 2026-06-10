/**
 * Loads QVAC models on demand and keeps mobile RAM under control.
 *
 * Strategy:
 *  - Translation (Bergamot) models are tiny (~35 MB) so we keep every loaded
 *    direction cached for instant reuse.
 *  - OCR (~98 MB) and the multimodal assistant (~900 MB) are "heavy" and
 *    mutually exclusive: loading one unloads any other heavy model first, so we
 *    never hold two large models in memory at once.
 *  - Concurrent requests for the same model share a single in-flight promise.
 */
import { loadModel, unloadModel, type LoadModelOptions, type ModelProgressUpdate } from '@qvac/sdk';
import {
  bergamotDescriptor,
  OCR_MODELS,
  ASSISTANT_MODELS,
  TRANSCRIBE_MODEL,
  TTS_MODELS,
  EMBEDDING_MODEL,
} from './models';
import type { TtsLanguage } from './tts';
import { logEvent } from './telemetry';

export type ProgressListener = (progress: ModelProgressUpdate) => void;

type Group = 'translate' | 'ocr' | 'assistant' | 'transcribe' | 'tts' | 'embed';
const HEAVY_GROUPS: Group[] = ['ocr', 'assistant'];

interface LoadedModel {
  modelId: string;
  group: Group;
}

const loaded = new Map<string, LoadedModel>();
const inflight = new Map<string, Promise<string>>();

function isLoaded(key: string): boolean {
  return loaded.has(key);
}

async function unloadOtherHeavyModels(keepKey: string): Promise<void> {
  for (const [key, model] of [...loaded.entries()]) {
    if (key !== keepKey && HEAVY_GROUPS.includes(model.group)) {
      try {
        await unloadModel({ modelId: model.modelId });
      } catch {
        // Best-effort: even if unload fails we drop our reference.
      }
      loaded.delete(key);
      logEvent({ kind: 'model_unload', model: key });
    }
  }
}

/**
 * Evict every model except `keepKey`. Used before loading the assistant VLM:
 * its tensor allocation aborts the whole process on low memory (observed
 * SIGABRT in llama.cpp's create_backend_buffers on the 8 GB demo phone), so
 * it must load into the emptiest worker we can give it.
 */
async function unloadEverythingExcept(keepKey: string): Promise<void> {
  for (const [key, model] of [...loaded.entries()]) {
    if (key === keepKey) continue;
    try {
      await unloadModel({ modelId: model.modelId });
    } catch {
      // Best-effort: even if unload fails we drop our reference.
    }
    loaded.delete(key);
    logEvent({ kind: 'model_unload', model: key, extra: { reason: 'free_ram_for_assistant' } });
  }
}

/**
 * Core loader: returns a cached modelId if present, otherwise loads it once
 * (deduping concurrent callers) and caches the result.
 */
async function ensure(
  key: string,
  group: Group,
  load: (onProgress: ProgressListener) => Promise<string>,
  onProgress?: ProgressListener,
): Promise<string> {
  const existing = loaded.get(key);
  if (existing) return existing.modelId;

  const pending = inflight.get(key);
  if (pending) return pending;

  const task = (async () => {
    if (group === 'assistant') {
      await unloadEverythingExcept(key);
    } else if (HEAVY_GROUPS.includes(group)) {
      await unloadOtherHeavyModels(key);
    }
    const startedAt = Date.now();
    try {
      const modelId = await load((p) => onProgress?.(p));
      loaded.set(key, { modelId, group });
      logEvent({ kind: 'model_load', model: key, totalMs: Date.now() - startedAt, extra: { group } });
      return modelId;
    } catch (error) {
      // A failed load must leave an audit trail (and not poison the cache).
      logEvent({
        kind: 'error',
        model: key,
        totalMs: Date.now() - startedAt,
        extra: { phase: 'model_load', message: String((error as Error)?.message ?? error) },
      });
      throw error;
    }
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

/** Load (or reuse) the Bergamot model for one translation direction. */
export function ensureTranslationModel(
  from: string,
  to: string,
  onProgress?: ProgressListener,
): Promise<string> {
  const descriptor = bergamotDescriptor(from, to);
  return ensure(
    `nmt:${from}-${to}`,
    'translate',
    (op) =>
      loadModel({
        modelSrc: descriptor,
        // Bergamot NMT models are direction-specific: the SDK requires the
        // engine + language pair in modelConfig (the descriptor alone carries
        // only `addon: "nmt"`, not the direction), and a literal modelType.
        modelType: 'nmtcpp-translation',
        modelConfig: { engine: 'Bergamot', from, to },
        onProgress: op,
      } as unknown as LoadModelOptions),
    onProgress,
  );
}

/** Load (or reuse) the multilingual Whisper model for voice → text. */
export function ensureTranscribeModel(onProgress?: ProgressListener): Promise<string> {
  return ensure(
    'whisper:base',
    'transcribe',
    (op) =>
      loadModel({
        modelSrc: TRANSCRIBE_MODEL,
        modelType: 'whispercpp-transcription',
        modelConfig: {},
        onProgress: op,
      } as unknown as LoadModelOptions),
    onProgress,
  );
}

/** Load (or reuse) the ONNX OCR pipeline (Latin recognizer + CRAFT detector). */
export function ensureOcrModel(onProgress?: ProgressListener): Promise<string> {
  return ensure(
    'ocr:latin',
    'ocr',
    (op) =>
      loadModel({
        modelSrc: OCR_MODELS.recognizer,
        // Explicit for parity with the SDK's own OCR example; the inferred
        // type from the descriptor is the same ('onnx-ocr').
        modelType: 'onnx-ocr',
        modelConfig: {
          langList: ['en'],
          detectorModelSrc: OCR_MODELS.detector,
        },
        onProgress: op,
      } as unknown as LoadModelOptions),
    onProgress,
  );
}

/** Load (or reuse) the SmolVLM2 multimodal assistant + its vision projection. */
export function ensureAssistantModel(onProgress?: ProgressListener): Promise<string> {
  return ensure(
    'vlm:smolvlm2-500m',
    'assistant',
    (op) =>
      loadModel({
        modelSrc: ASSISTANT_MODELS.vlm,
        modelType: 'llamacpp-completion',
        modelConfig: {
          // 2048 halves the KV-cache footprint vs 4096 (history is capped at
          // 10 turns in assistant.ts, so 2048 is comfortable).
          ctx_size: 2048,
          // The SDK defaults to device:"gpu"/gpu_layers:99; allocating the
          // ~550 MB VLM on this phone's Mali GPU returns a null buffer and
          // the process SIGSEGVs in create_backend_buffers. CPU is reliable.
          device: 'cpu',
          gpu_layers: 0,
          projectionModelSrc: ASSISTANT_MODELS.projection,
        },
        onProgress: op,
      } as unknown as LoadModelOptions),
    onProgress,
  );
}

/** Load (or reuse) the Supertonic TTS voice for spoken translations. */
export function ensureTtsModel(
  language: TtsLanguage,
  onProgress?: ProgressListener,
): Promise<string> {
  // One fast English-only variant; everything else uses the multilingual one.
  const descriptor = language === 'en' ? TTS_MODELS.en : TTS_MODELS.multilingual;
  return ensure(
    `tts:${language}`,
    'tts',
    (op) =>
      loadModel({
        modelSrc: descriptor,
        modelType: 'tts-ggml',
        modelConfig: { ttsEngine: 'supertonic', language },
        onProgress: op,
      } as unknown as LoadModelOptions),
    onProgress,
  );
}

/** Load (or reuse) the embedding model backing the RAG phrasebook. */
export function ensureEmbeddingModel(onProgress?: ProgressListener): Promise<string> {
  return ensure(
    'embed:gemma-300m',
    'embed',
    (op) =>
      loadModel({
        modelSrc: EMBEDDING_MODEL,
        modelType: 'llamacpp-embedding',
        // CPU for the same reason as the assistant: GPU buffer allocation
        // for llama-family models is unreliable on this device class.
        modelConfig: { device: 'cpu', gpu_layers: 0 },
        onProgress: op,
      } as unknown as LoadModelOptions),
    onProgress,
  );
}

export const ModelStatus = {
  isTranslationLoaded: (from: string, to: string) => isLoaded(`nmt:${from}-${to}`),
  isOcrLoaded: () => isLoaded('ocr:latin'),
  isAssistantLoaded: () => isLoaded('vlm:smolvlm2-500m'),
  isTranscribeLoaded: () => isLoaded('whisper:base'),
};

/** Free everything (e.g. on a hard reset). */
export async function unloadAll(): Promise<void> {
  for (const [key, model] of [...loaded.entries()]) {
    try {
      await unloadModel({ modelId: model.modelId });
    } catch {
      // ignore
    }
    loaded.delete(key);
    logEvent({ kind: 'model_unload', model: key });
  }
}
