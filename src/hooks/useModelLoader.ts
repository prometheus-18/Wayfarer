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
    const { percentage, detail } = readProgress(progress);
    // Clamp 0–100 and never go backwards.
    peak.current = Math.min(100, Math.max(peak.current, percentage));
    setState({ active: true, percentage: peak.current, detail });
  }, []);

  return { state, begin, end, onProgress };
}

/**
 * Normalize an SDK progress update to overall percentage + human detail.
 * Prefers cumulative figures: `progress.percentage`/`downloaded` are per-file
 * and reset for each file of a multi-file model, which makes a naive bar
 * bounce around.
 */
function readProgress(progress: ModelProgressUpdate): { percentage: number; detail?: string } {
  const fileSet = progress.fileSetInfo;
  if (fileSet && fileSet.overallTotal > 0) {
    return {
      percentage: (fileSet.overallDownloaded / fileSet.overallTotal) * 100,
      detail:
        `${formatBytes(fileSet.overallDownloaded)} / ${formatBytes(fileSet.overallTotal)}` +
        ` · file ${fileSet.fileIndex + 1}/${fileSet.totalFiles}`,
    };
  }
  if (progress.shardInfo) {
    return {
      percentage: progress.shardInfo.overallPercentage,
      detail:
        progress.total > 0
          ? `${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)}`
          : undefined,
    };
  }
  return {
    percentage: progress.percentage ?? 0,
    detail: progress.total > 0 ? `${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)}` : undefined,
  };
}

export interface DownloadState {
  visible: boolean;
  percentage: number;
  detail?: string;
}

const DOWNLOAD_IDLE: DownloadState = { visible: false, percentage: 0 };

/**
 * Non-blocking download indicator: becomes visible ONLY when real download
 * progress arrives (and survives a 300 ms grace period), so warm model loads
 * and plain inference never flash any chrome. This replaces the full-screen
 * modal on hot paths — a modal costs ~600 ms of enter/exit animation per
 * operation, which users read as the app being slow.
 */
export function useDownloadProgress() {
  const [state, setState] = useState<DownloadState>(DOWNLOAD_IDLE);
  const peak = useRef(0);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<DownloadState | null>(null);
  const visibleRef = useRef(false);

  const reset = useCallback(() => {
    peak.current = 0;
    latest.current = null;
    visibleRef.current = false;
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    setState(DOWNLOAD_IDLE);
  }, []);

  const onProgress = useCallback((progress: ModelProgressUpdate) => {
    const { percentage, detail } = readProgress(progress);
    peak.current = Math.min(100, Math.max(peak.current, percentage));
    // A finished/instant load (≥99.5%) with nothing shown yet isn't a download.
    if (!visibleRef.current && peak.current >= 99.5) return;

    const next: DownloadState = { visible: true, percentage: peak.current, detail };
    latest.current = next;
    if (visibleRef.current) {
      setState(next);
      return;
    }
    if (!showTimer.current) {
      showTimer.current = setTimeout(() => {
        showTimer.current = null;
        if (latest.current) {
          visibleRef.current = true;
          setState(latest.current);
        }
      }, 300);
    }
  }, []);

  return { state, onProgress, reset };
}
