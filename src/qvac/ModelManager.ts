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
import { bergamotDescriptor, OCR_MODELS, ASSISTANT_MODELS, TRANSCRIBE_MODEL } from './models';
import { logEvent } from './telemetry';

export type ProgressListener = (progress: ModelProgressUpdate) => void;

type Group = 'translate' | 'ocr' | 'assistant' | 'transcribe';
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
    if (HEAVY_GROUPS.includes(group)) {
      await unloadOtherHeavyModels(key);
    }
    const startedAt = Date.now();
    const modelId = await load((p) => onProgress?.(p));
    loaded.set(key, { modelId, group });
    logEvent({ kind: 'model_load', model: key, totalMs: Date.now() - startedAt });
    return modelId;
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
        modelConfig: {
          langList: ['en'],
          detectorModelSrc: OCR_MODELS.detector,
        },
        onProgress: op,
      }),
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
        modelConfig: {
          ctx_size: 4096,
          projectionModelSrc: ASSISTANT_MODELS.projection,
        },
        onProgress: op,
      }),
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
