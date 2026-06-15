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
import { enqueue } from './queue';
import { logEvent } from './telemetry';

export type ProgressListener = (progress: ModelProgressUpdate) => void;

type Group = 'translate' | 'ocr' | 'assistant' | 'transcribe' | 'tts' | 'embed';
const HEAVY_GROUPS: Group[] = ['ocr', 'assistant'];
/**
 * Translation pairs are tiny (~35 MB) but a long session pivoting across many
 * languages accumulates them in worker RAM. Keep only the most-recently-used
 * few resident (LRU); the rest reload from the on-disk cache in ~1 s.
 */
const MAX_TRANSLATE_RESIDENT = 4;

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
      if (group === 'translate') void evictExcessTranslationModels(key);
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

/** Evict least-recently-loaded translation models beyond the resident cap. */
async function evictExcessTranslationModels(keepKey: string): Promise<void> {
  // Map preserves insertion order; oldest translate entries come first.
  const translate = [...loaded.entries()].filter(([, m]) => m.group === 'translate');
  const excess = translate.length - MAX_TRANSLATE_RESIDENT;
  for (let i = 0; i < excess; i += 1) {
    const [key, model] = translate[i];
    if (key === keepKey) continue;
    try {
      await unloadModel({ modelId: model.modelId });
    } catch {
      // best-effort
    }
    loaded.delete(key);
    logEvent({ kind: 'model_unload', model: key, extra: { reason: 'translate_lru' } });
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

// Whisper is loaded with an EXPLICIT spoken-language code so it transcribes in
// that language's script (e.g. 'hi' → Devanagari). 'auto' is NOT used — it
// returns empty transcripts on this QVAC build (verified on-device). The worker
// reuses a model by modelSrc, so to actually change the language we unload the
// previous instance first.
let whisperModelId: string | null = null;
let whisperLang: string | null = null;
let whisperInflight: Promise<string> | null = null;
let whisperInflightLang: string | null = null;

// Whisper-small still leans toward Latin/Urdu for some non-Latin languages; a
// short script sample as initial_prompt biases the decoder to the right script.
const SCRIPT_HINT_PROMPTS: Record<string, string> = {
  hi: 'नमस्ते। यह एक हिन्दी बातचीत है।',
};

/** Load (or reuse) Whisper for a specific spoken language (ISO code). */
export function ensureTranscribeModel(
  language = 'en',
  onProgress?: ProgressListener,
): Promise<string> {
  if (whisperModelId && whisperLang === language) return Promise.resolve(whisperModelId);
  if (whisperInflight && whisperInflightLang === language) return whisperInflight;

  whisperInflightLang = language;
  // Run the unload+load on the SAME 'transcribe' FIFO as the decode, so a
  // language switch can never tear down a model while a transcription is
  // in-flight (both screens share this single Whisper slot).
  whisperInflight = enqueue('transcribe', async () => {
    // A queued load for this language may have already landed by the time this
    // slot runs — reuse it instead of unloading and reloading needlessly.
    if (whisperModelId && whisperLang === language) return whisperModelId;
    // Drop any model loaded for a different language so the new one applies.
    if (whisperModelId) {
      try {
        await unloadModel({ modelId: whisperModelId });
      } catch {
        // best-effort
      }
      whisperModelId = null;
      whisperLang = null;
    }
    const startedAt = Date.now();
    const hint = SCRIPT_HINT_PROMPTS[language];
    const id = await loadModel({
      modelSrc: TRANSCRIBE_MODEL,
      modelType: 'whispercpp-transcription',
      modelConfig: { language, translate: false, ...(hint ? { initial_prompt: hint } : {}) },
      onProgress,
    } as unknown as LoadModelOptions);
    whisperModelId = id;
    whisperLang = language;
    logEvent({ kind: 'model_load', model: `whisper:${language}`, totalMs: Date.now() - startedAt });
    return id;
  });
  return whisperInflight.finally(() => {
    whisperInflight = null;
    whisperInflightLang = null;
  });
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
        // Pass the raw `src` string, not the descriptor object: a descriptor
        // with a literal `engine` narrows modelConfig to that engine's strict
        // schema and rejects voice/outputSampleRate/etc. The string keeps
        // modelConfig permissive (matches the SDK supertonic example).
        modelSrc: descriptor.src,
        modelType: 'tts-ggml',
        // Supertonic needs a speaker `voice` (e.g. "F1"); without it the engine
        // emits garbled babble. Match the SDK's supertonic example config.
        // Exactly the keys the SDK's supertonic load schema accepts. `voice` is
        // the missing piece that caused babble; `outputSampleRate` is NOT a
        // valid load-config key (strict schema rejects it).
        modelConfig: {
          ttsEngine: 'supertonic',
          language,
          voice: 'F1',
          ttsSpeed: 1.05,
          ttsNumInferenceSteps: 5,
        },
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
  isTranscribeLoaded: () => whisperModelId !== null,
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
