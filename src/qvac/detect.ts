/**
 * On-device text language detection (QVAC's langdetect-text). Used to
 * auto-pick the source language from a voice transcript so the interpreter
 * doesn't need the speaker to choose it.
 */
import { detectOne } from '@qvac/langdetect-text';

/** Best-effort ISO 639-1 code for `text`; falls back when undetectable. */
export function detectLanguageCode(text: string, fallback = 'en'): string {
  const trimmed = text.trim();
  if (trimmed.length < 2) return fallback;
  try {
    const result = detectOne(trimmed);
    return (result?.code || fallback).toLowerCase();
  } catch {
    return fallback;
  }
}
