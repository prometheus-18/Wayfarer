/**
 * Offline text translation via QVAC's Bergamot NMT models.
 *
 * Bergamot is English-pivot, so non-English → non-English requests are split
 * into two hops (X → EN → Y). Each hop streams tokens; only the final hop is
 * surfaced to the UI via `onToken`.
 */
import { translate as qvacTranslate } from '@qvac/sdk';
import { ensureTranslationModel, type ProgressListener } from './ModelManager';
import { enqueue } from './queue';
import { LIMITS, sanitizeText } from './security';
import { logEvent, raceStats } from './telemetry';

export interface TranslateRequest {
  text: string;
  /** Source language code, e.g. "en" or "es". */
  from: string;
  /** Target language code. */
  to: string;
  /** Model download progress (only fires while a model is being fetched). */
  onProgress?: ProgressListener;
  /** Streaming partial translation of the final hop. */
  onToken?: (partial: string) => void;
}

interface Hop {
  from: string;
  to: string;
}

/** A wedged worker job must surface as an error, not an endless spinner. */
const HOP_TIMEOUT_MS = 120_000;

function withTimeout<T>(task: Promise<T>): Promise<T> {
  return Promise.race([
    task,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Translation timed out — please try again.')),
        HOP_TIMEOUT_MS,
      ),
    ),
  ]);
}

/** Build the list of translation hops needed to get from `from` to `to`. */
export function routeFor(from: string, to: string): Hop[] {
  if (from === to) return [];
  if (from === 'en' || to === 'en') return [{ from, to }];
  // Pivot through English for non-English ↔ non-English pairs.
  return [
    { from, to: 'en' },
    { from: 'en', to },
  ];
}

export async function translateText(req: TranslateRequest): Promise<string> {
  const text = sanitizeText(req.text, LIMITS.translateChars);
  if (!text) return '';

  const hops = routeFor(req.from, req.to);
  if (hops.length === 0) return text;

  let current = text;
  for (let i = 0; i < hops.length; i += 1) {
    const hop = hops[i];
    const isFinalHop = i === hops.length - 1;

    const modelId = await ensureTranslationModel(hop.from, hop.to, req.onProgress);

    const hopStartedAt = Date.now();
    // The NMT engine replaces an in-flight job when a new one arrives, so
    // hops from concurrent callers are serialized through a FIFO queue.
    current = await enqueue('translate', () => withTimeout((async () => {
      const result = qvacTranslate({
        modelId,
        text: current,
        stream: true,
        modelType: 'nmtcpp-translation',
      });

      let accumulated = '';
      for await (const token of result.tokenStream) {
        accumulated += token;
        if (isFinalHop) req.onToken?.(accumulated);
      }

      // Telemetry must never block the result: stats settle off the critical
      // path with a wall-clock fallback so every hop still gets a log row.
      void raceStats(result.stats).then((stats) => {
        logEvent({
          kind: 'translate',
          model: `nmt:${hop.from}-${hop.to}`,
          prompt: text,
          tokens: stats?.totalTokens,
          ttftMs: stats?.timeToFirstToken,
          tokensPerSec: stats?.tokensPerSecond,
          totalMs: stats?.totalTime ?? Date.now() - hopStartedAt,
        });
      });

      return accumulated.trim();
    })()));
  }

  return current;
}
