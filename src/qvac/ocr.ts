/**
 * On-device OCR via QVAC's ONNX pipeline (CRAFT detector + Latin recognizer).
 * Extracts text blocks (with bounding boxes + confidence) from a local image.
 */
import { ocr as qvacOcr, type OCRTextBlock } from '@qvac/sdk';
import { ensureOcrModel, type ProgressListener } from './ModelManager';
import { toReadablePath } from './image';
import { enqueue } from './queue';
import { logEvent, raceStats } from './telemetry';

/** A stalled worker stream must never freeze the Scan screen forever. */
const OCR_TIMEOUT_MS = 60_000;

export interface OcrResult {
  /** Raw recognized blocks, in reading order. */
  blocks: OCRTextBlock[];
  /** Convenience: all block text joined by newlines. */
  text: string;
}

export async function scanImage(
  imageUri: string,
  onProgress?: ProgressListener,
): Promise<OcrResult> {
  const modelId = await ensureOcrModel(onProgress);
  const image = await toReadablePath(imageUri);

  const startedAt = Date.now();
  // Serialized: the worker replaces in-flight jobs for the same engine.
  const { recognized, stats } = await enqueue('ocr', async () => {
    const { blocks, stats: s } = qvacOcr({
      modelId,
      image,
      options: { paragraph: true },
    });
    // The SDK's OCR client never surfaces worker-side errors on this stream —
    // a failure just means `blocks` never resolves. Bound it.
    const result = await Promise.race([
      blocks,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Scan timed out — try a smaller or clearer photo.')),
          OCR_TIMEOUT_MS,
        ),
      ),
    ]);
    return { recognized: result, stats: s };
  });
  const text = recognized
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  // Telemetry off the critical path: never let a hung stats promise block
  // (or hide) the scan result. Wall-clock fallback keeps the audit log complete.
  void raceStats(stats).then((ocrStats) => {
    logEvent({
      kind: 'ocr',
      model: 'ocr:latin',
      tokens: recognized.length,
      totalMs: ocrStats?.totalTime ?? Date.now() - startedAt,
      extra: {
        blocks: recognized.length,
        chars: text.length,
        detectionMs: ocrStats?.detectionTime,
        recognitionMs: ocrStats?.recognitionTime,
      },
    });
  });

  return { blocks: recognized, text };
}
