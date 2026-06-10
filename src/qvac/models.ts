/**
 * Maps Wayfarer's features to concrete QVAC model descriptors.
 *
 * Every constant referenced here is a real export of `@qvac/sdk@0.12.x`
 * (verified against the installed package). Descriptors carry their own
 * companion files (vocab/lex/projection), so a single `loadModel({ modelSrc })`
 * pulls everything needed.
 */
import * as Qvac from '@qvac/sdk';
import {
  BERGAMOT_EN_ES,
  EMBEDDINGGEMMA_300M_Q4_0,
  OCR_LATIN_RECOGNIZER_1,
  OCR_CRAFT_DETECTOR,
  SMOLVLM2_500M_MULTIMODAL_Q8_0,
  MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0,
  TTS_EN_SUPERTONIC_Q4_0,
  TTS_MULTILINGUAL_SUPERTONIC2_Q4_0,
  WHISPER_BASE_Q8_0,
} from '@qvac/sdk';

/** The shape of a QVAC model descriptor constant (e.g. `BERGAMOT_EN_ES`). */
export type QvacModel = typeof BERGAMOT_EN_ES;

const MODELS = Qvac as unknown as Record<string, QvacModel | undefined>;

/**
 * Resolve the Bergamot descriptor for a single translation hop, e.g.
 * `("en", "es")` → `BERGAMOT_EN_ES`. Throws if the pair isn't shipped.
 */
export function bergamotDescriptor(from: string, to: string): QvacModel {
  const name = `BERGAMOT_${from.toUpperCase()}_${to.toUpperCase()}`;
  const descriptor = MODELS[name];
  if (!descriptor) {
    throw new Error(`No offline translation model for ${from} → ${to} (looked for ${name}).`);
  }
  return descriptor;
}

/** Approximate on-disk/download size (bytes), used purely for nicer progress UI. */
export const SIZES = {
  /** A single Bergamot direction (model + lex + vocab). */
  bergamotPair: 36 * 1024 * 1024,
  /** OCR recognizer + CRAFT detector. */
  ocr: 98 * 1024 * 1024,
  /** SmolVLM2-500M + its F16 projection. */
  assistant: 900 * 1024 * 1024,
  /** Whisper base (multilingual) speech-to-text. */
  transcribe: 82 * 1024 * 1024,
  /** Supertonic TTS (per variant). */
  tts: 132 * 1024 * 1024,
  /** EmbeddingGemma-300M Q4 for the RAG phrasebook. */
  embedding: 278 * 1024 * 1024,
} as const;

/** Multilingual Whisper model used for voice → text on the Translate screen. */
export const TRANSCRIBE_MODEL = WHISPER_BASE_Q8_0;

export const OCR_MODELS = {
  recognizer: OCR_LATIN_RECOGNIZER_1,
  detector: OCR_CRAFT_DETECTOR,
} as const;

export const ASSISTANT_MODELS = {
  vlm: SMOLVLM2_500M_MULTIMODAL_Q8_0,
  projection: MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0,
} as const;

/** Supertonic speech synthesis: a fast English variant + a multilingual one. */
export const TTS_MODELS = {
  en: TTS_EN_SUPERTONIC_Q4_0,
  multilingual: TTS_MULTILINGUAL_SUPERTONIC2_Q4_0,
} as const;

/** Embedding model backing the offline RAG phrasebook. */
export const EMBEDDING_MODEL = EMBEDDINGGEMMA_300M_Q4_0;

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}
