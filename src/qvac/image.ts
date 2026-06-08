/**
 * QVAC's native worker reads images (for OCR) and chat attachments (for the
 * multimodal model) from an absolute filesystem path. expo-image-picker and
 * expo-camera hand us `file://` URIs, so we normalise them to plain paths.
 */
export function toModelPath(uri: string): string {
  if (uri.startsWith('file://')) {
    return decodeURIComponent(uri.slice('file://'.length));
  }
  return uri;
}
