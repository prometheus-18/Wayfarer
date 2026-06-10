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

/**
 * Like `toModelPath`, but also handles `content://` URIs that some OEM
 * pickers return: those aren't readable as filesystem paths, so we copy the
 * content into our cache dir first (the legacy FileSystem API is the one
 * that accepts content:// sources on Android).
 */
export async function toReadablePath(uri: string, fallbackExt = 'jpg'): Promise<string> {
  if (uri.startsWith('file://') || uri.startsWith('/')) return toModelPath(uri);
  const Legacy = await import('expo-file-system/legacy');
  const ext = /\.(\w{2,4})(\?|$)/.exec(uri)?.[1] ?? fallbackExt;
  const target = `${Legacy.cacheDirectory}qvac-input-${Date.now()}.${ext}`;
  await Legacy.copyAsync({ from: uri, to: target });
  return toModelPath(target);
}
