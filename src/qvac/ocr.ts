/**
 * On-device OCR via QVAC's ONNX pipeline (CRAFT detector + Latin recognizer).
 * Extracts text blocks (with bounding boxes + confidence) from a local image.
 */
import { ocr as qvacOcr, type OCRTextBlock } from '@qvac/sdk';
import { ensureOcrModel, type ProgressListener } from './ModelManager';
import { toModelPath } from './image';

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

  const { blocks } = qvacOcr({
    modelId,
    image: toModelPath(imageUri),
    options: { paragraph: true },
  });

  const recognized = await blocks;
  const text = recognized
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  return { blocks: recognized, text };
}
