import { useCallback, useState } from 'react';
import type { ModelProgressUpdate } from '@qvac/sdk';
import { formatBytes } from '../qvac/models';

export interface ModelLoadState {
  /** Whether a model load is in progress (download or warm-up). */
  active: boolean;
  /** 0–100 download progress; 0 means "warming up / no download needed". */
  percentage: number;
  /** Human detail, e.g. "42 MB / 98 MB" or "file 2/4". */
  detail?: string;
}

const IDLE: ModelLoadState = { active: false, percentage: 0 };

/**
 * Tracks model download/warm-up progress for the loading overlay. Call `begin()`
 * before awaiting a model-backed operation, pass `onProgress` into the QVAC
 * helper, and call `end()` in a `finally`.
 */
export function useModelLoader() {
  const [state, setState] = useState<ModelLoadState>(IDLE);

  const begin = useCallback(() => {
    setState({ active: true, percentage: 0 });
  }, []);

  const end = useCallback(() => {
    setState(IDLE);
  }, []);

  const onProgress = useCallback((progress: ModelProgressUpdate) => {
    let detail: string | undefined;
    if (progress.fileSetInfo) {
      const { fileIndex, totalFiles } = progress.fileSetInfo;
      detail = `file ${fileIndex + 1}/${totalFiles}`;
    } else if (progress.total > 0) {
      detail = `${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)}`;
    }
    setState({ active: true, percentage: progress.percentage ?? 0, detail });
  }, []);

  return { state, begin, end, onProgress };
}
