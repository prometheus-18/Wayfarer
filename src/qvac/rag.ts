/**
 * Offline phrasebook retrieval via QVAC's RAG pipeline.
 *
 * The bundled travel phrasebook is embedded once (EmbeddingGemma) into a
 * dedicated on-device vector workspace; semantic search then surfaces the
 * most relevant phrases for a free-form query ("my bag was stolen" →
 * police/insurance phrases). Ingestion is persisted across launches with a
 * marker file so re-opens skip straight to search.
 */
import { ragCloseWorkspace, ragIngest, ragSearch } from '@qvac/sdk';
import { PHRASEBOOK_DOCUMENTS } from '../data/phrasebook';
import { ensureEmbeddingModel, type ProgressListener } from './ModelManager';
import { enqueue } from './queue';
import { sanitizeText } from './security';
import { logEvent } from './telemetry';

export interface PhraseHit {
  /** Phrasebook document id (falls back to the RAG-internal chunk id). */
  id: string;
  text: string;
  /** Similarity score as reported by the vector search (higher is closer). */
  score: number;
}

const WORKSPACE = 'phrasebook';
const EMBED_MODEL_LABEL = 'embed:gemma-300m';
/** Bump the suffix to force a re-ingest after phrasebook content changes. */
const MARKER_FILENAME = 'wayfarer-phrasebook-ingested-v1.json';
const MAX_QUERY_CHARS = 300;

/** Resolved embedding modelId, set once `ensurePhrasebookReady` succeeds. */
let embeddingModelId: string | null = null;
let ingested = false;
let inflightIngest: Promise<void> | null = null;

/**
 * Phrasebook entries are ingested as plain strings (the SDK assigns its own
 * chunk ids), so search results are mapped back to their source document ids
 * by exact text.
 */
const idByText = new Map<string, string>(
  PHRASEBOOK_DOCUMENTS.map((doc) => [doc.text.trim(), doc.id]),
);

function markerFile() {
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  return new File(Paths.document, MARKER_FILENAME);
}

function hasIngestMarker(): boolean {
  try {
    return markerFile().exists;
  } catch {
    return false;
  }
}

function writeIngestMarker(): void {
  try {
    markerFile().write(
      JSON.stringify({
        ingestedAt: new Date().toISOString(),
        documents: PHRASEBOOK_DOCUMENTS.length,
      }),
    );
  } catch {
    // Best-effort: worst case the phrasebook is re-ingested next launch.
  }
}

/**
 * Load the embedding model and ingest the bundled phrasebook into the
 * 'phrasebook' RAG workspace exactly once. Workspace data lives on disk, so
 * relaunches only pay for the model load (the marker file skips ingestion).
 * Safe to call concurrently; callers share one in-flight ingest.
 */
export async function ensurePhrasebookReady(onProgress?: ProgressListener): Promise<void> {
  if (ingested) return;
  if (inflightIngest) return inflightIngest;

  inflightIngest = (async () => {
    const modelId = await ensureEmbeddingModel(onProgress);

    if (hasIngestMarker()) {
      embeddingModelId = modelId;
      ingested = true;
      return;
    }

    const documents = PHRASEBOOK_DOCUMENTS.map((doc) => doc.text);
    if (documents.length === 0) {
      embeddingModelId = modelId;
      ingested = true;
      return;
    }

    const startedAt = Date.now();
    try {
      // Serialized with every other embedding job: the worker replaces an
      // in-flight job when a new request arrives for the same engine.
      const { processed, droppedIndices } = await enqueue('embed', () =>
        ragIngest({
          modelId,
          documents,
          // Entries are authored chunk-sized; chunking would only split
          // phrases away from their context labels.
          chunk: false,
          workspace: WORKSPACE,
        }),
      );

      const rejected =
        processed.filter((result) => result.status === 'rejected').length + droppedIndices.length;
      if (rejected >= documents.length) {
        throw new Error('every phrasebook entry was rejected by the vector store');
      }

      writeIngestMarker();
      embeddingModelId = modelId;
      ingested = true;

      logEvent({
        kind: 'rag',
        model: EMBED_MODEL_LABEL,
        totalMs: Date.now() - startedAt,
        extra: { phase: 'ingest', documents: documents.length, rejected },
      });
    } catch (error) {
      const message = String((error as Error)?.message ?? error);
      logEvent({
        kind: 'error',
        model: EMBED_MODEL_LABEL,
        totalMs: Date.now() - startedAt,
        extra: { phase: 'ingest', message },
      });
      throw new Error(
        `Couldn't prepare the offline phrasebook (${message}). ` +
          'Free up some storage or restart the app and try again.',
      );
    }
  })();

  try {
    return await inflightIngest;
  } finally {
    // Always clear so a failed ingest can be retried on the next call.
    inflightIngest = null;
  }
}

/** Semantic search over the bundled phrasebook. Returns up to `topK` hits. */
export async function searchPhrases(
  query: string,
  topK = 4,
  onProgress?: ProgressListener,
): Promise<PhraseHit[]> {
  const clean = sanitizeText(query, MAX_QUERY_CHARS);
  if (!clean) return [];

  await ensurePhrasebookReady(onProgress);
  const modelId = embeddingModelId ?? (await ensureEmbeddingModel(onProgress));

  const startedAt = Date.now();
  let results;
  try {
    results = await enqueue('embed', () =>
      ragSearch({ modelId, query: clean, topK, workspace: WORKSPACE }),
    );
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    throw new Error(`Phrasebook search failed (${message}). Please try again.`);
  }

  const hits: PhraseHit[] = results.map((result) => ({
    id: idByText.get(result.content.trim()) ?? result.id,
    text: result.content,
    score: result.score,
  }));

  logEvent({
    kind: 'rag',
    model: EMBED_MODEL_LABEL,
    prompt: clean,
    totalMs: Date.now() - startedAt,
    extra: { topK, topScore: hits[0]?.score },
  });

  return hits;
}

/**
 * Release the workspace's in-memory resources (data stays on disk, so a later
 * search transparently reopens it). Best-effort: never throws.
 */
export async function closePhrasebook(): Promise<void> {
  try {
    // Queued behind any in-flight embed/ingest so we never close mid-job.
    await enqueue('embed', () => ragCloseWorkspace({ workspace: WORKSPACE }));
  } catch {
    // The workspace may simply never have been opened this session.
  }
}
