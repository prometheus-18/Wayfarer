import { useCallback, useRef, useState } from 'react';
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
  // Highest percentage seen this session — keeps the bar monotonic so it never
  // jumps backwards when the SDK moves on to the next file in a multi-file model.
  const peak = useRef(0);

  const begin = useCallback(() => {
    peak.current = 0;
    setState({ active: true, percentage: 0 });
  }, []);

  const end = useCallback(() => {
    peak.current = 0;
    setState(IDLE);
  }, []);

  const onProgress = useCallback((progress: ModelProgressUpdate) => {
    // Prefer the SDK's cumulative figures. `progress.percentage`/`downloaded`
    // are per-file and reset to 0 for each file in a multi-file model, which
    // makes a naive bar bounce around. The file set / shard carry the overall
    // numbers we actually want to show.
    const fileSet = progress.fileSetInfo;
    let percentage: number;
    let detail: string | undefined;

    if (fileSet && fileSet.overallTotal > 0) {
      percentage = (fileSet.overallDownloaded / fileSet.overallTotal) * 100;
      detail =
        `${formatBytes(fileSet.overallDownloaded)} / ${formatBytes(fileSet.overallTotal)}` +
        ` · file ${fileSet.fileIndex + 1}/${fileSet.totalFiles}`;
    } else if (progress.shardInfo) {
      percentage = progress.shardInfo.overallPercentage;
      detail = progress.total > 0 ? `${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)}` : undefined;
    } else {
      percentage = progress.percentage ?? 0;
      if (progress.total > 0) {
        detail = `${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)}`;
      }
    }

    // Clamp 0–100 and never go backwards.
    peak.current = Math.min(100, Math.max(peak.current, percentage));
    setState({ active: true, percentage: peak.current, detail });
  }, []);

  return { state, begin, end, onProgress };
}
