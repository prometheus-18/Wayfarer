/**
 * On-device inference audit log.
 *
 * The QVAC hackathon requires an auditable, structured log capturing model
 * loads/unloads and per-inference performance (prompt, tokens, TTFT,
 * tokens/sec) for a demo run. We keep this entirely on-device (in memory) and
 * let the user export it from the Privacy sheet — nothing is uploaded.
 *
 * Privacy note: prompts are truncated to a short preview so a shared log never
 * leaks full user content.
 */

export type InferenceKind =
  | 'model_load'
  | 'model_unload'
  | 'translate'
  | 'ocr'
  | 'assistant'
  | 'benchmark';

export interface InferenceLogEntry {
  /** ISO timestamp. */
  ts: string;
  kind: InferenceKind;
  /** Logical model / feature label. */
  model?: string;
  /** Short, privacy-safe preview of the input. */
  promptPreview?: string;
  /** Output/processed token count when reported by the SDK. */
  tokens?: number;
  /** Time to first token (ms). */
  ttftMs?: number;
  /** Throughput (tokens/sec). */
  tokensPerSec?: number;
  /** Total wall time for the call (ms). */
  totalMs?: number;
  /** Any extra structured detail. */
  extra?: Record<string, number | string | boolean | undefined>;
}

const MAX_ENTRIES = 500;
const entries: InferenceLogEntry[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

/** Subscribe to log changes (returns an unsubscribe fn). */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function preview(text: string | undefined, max = 60): string | undefined {
  if (!text) return undefined;
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/**
 * Resolve the SDK's stats promise without ever blocking or hanging the
 * caller: settles with `undefined` after `ms` (or on error) so audit-log
 * rows are still written with wall-clock fallbacks if the SDK never
 * delivers stats. Telemetry must stay off the request path.
 */
export function raceStats<T>(stats: Promise<T> | undefined, ms = 3000): Promise<T | undefined> {
  if (!stats) return Promise.resolve(undefined);
  return Promise.race([
    stats.catch(() => undefined),
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms)),
  ]);
}

export function logEvent(entry: Omit<InferenceLogEntry, 'ts'> & { prompt?: string }): void {
  const { prompt, promptPreview, ...rest } = entry;
  entries.push({
    ts: new Date().toISOString(),
    ...rest,
    promptPreview: promptPreview ?? preview(prompt),
  });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  notify();
}

export function getEntries(): InferenceLogEntry[] {
  return [...entries];
}

export function clear(): void {
  entries.length = 0;
  notify();
}

export function toJSON(): string {
  return JSON.stringify(
    {
      app: 'Wayfarer',
      exportedAt: new Date().toISOString(),
      onDevice: true,
      remoteInferenceCalls: 0,
      entries,
    },
    null,
    2,
  );
}

const CSV_COLUMNS: (keyof InferenceLogEntry)[] = [
  'ts',
  'kind',
  'model',
  'promptPreview',
  'tokens',
  'ttftMs',
  'tokensPerSec',
  'totalMs',
];

export function toCSV(): string {
  const header = CSV_COLUMNS.join(',');
  const rows = entries.map((entry) =>
    CSV_COLUMNS.map((column) => {
      const value = entry[column];
      if (value === undefined || value === null) return '';
      const text = String(value).replace(/"/g, '""');
      return /[",\n]/.test(text) ? `"${text}"` : text;
    }).join(','),
  );
  return [header, ...rows].join('\n');
}
