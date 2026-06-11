/**
 * "Prepare for offline" — bulk-download model weights ahead of time so the
 * traveler never waits (or needs signal) mid-trip.
 *
 * Uses the SDK's `downloadAsset`, which fetches a model's files to the on-disk
 * cache WITHOUT loading them into RAM — so we can pull the entire translation
 * stack (every language pair + Whisper voice-in + Supertonic voice-out) in one
 * pass without memory pressure. Already-cached assets resolve instantly, so
 * this is safe to re-run and resumes where a cancelled run left off.
 */
import { downloadAsset, type ModelProgressUpdate } from '@qvac/sdk';
import { ALL_LANGUAGES } from '../data/languages';
import { bergamotDescriptor, TRANSCRIBE_MODEL, TTS_MODELS } from './models';
import { logEvent } from './telemetry';

export interface PrefetchProgress {
  /** Assets finished so far. */
  done: number;
  /** Total assets in this run. */
  total: number;
  /** Human label of the asset currently downloading. */
  label: string;
  /** Overall 0–100 across the whole run (counts in-flight asset progress). */
  percentage: number;
}

export interface PrefetchOptions {
  onProgress?: (p: PrefetchProgress) => void;
  /** Polled between assets; return true to stop early (no error). */
  isCancelled?: () => boolean;
}

interface Asset {
  label: string;
  // The SDK descriptor object (accepted directly as assetSrc).
  src: unknown;
}

/** The full offline translation stack: voice-in, voice-out, every direction. */
function translationAssets(): Asset[] {
  const assets: Asset[] = [
    { label: 'Voice input (Whisper)', src: TRANSCRIBE_MODEL },
    { label: 'Voice output (English)', src: TTS_MODELS.en },
    { label: 'Voice output (multilingual)', src: TTS_MODELS.multilingual },
  ];
  // Both directions for every supported language (English-pivot covers the rest).
  for (const lang of ALL_LANGUAGES) {
    if (lang.code === 'en') continue;
    assets.push({ label: `${lang.label} → English`, src: bergamotDescriptor(lang.code, 'en') });
    assets.push({ label: `English → ${lang.label}`, src: bergamotDescriptor('en', lang.code) });
  }
  return assets;
}

/** Total number of assets a full translation prefetch will download. */
export function translationAssetCount(): number {
  return translationAssets().length;
}

/**
 * Download the entire offline translation stack. Resolves with the number of
 * assets successfully fetched; individual failures are logged and skipped so
 * one bad asset can't abort the whole run.
 */
export async function downloadTranslationModels(options: PrefetchOptions = {}): Promise<number> {
  const assets = translationAssets();
  const total = assets.length;
  let done = 0;
  let ok = 0;
  const startedAt = Date.now();

  for (const asset of assets) {
    if (options.isCancelled?.()) break;
    let assetPct = 0;
    const emit = () =>
      options.onProgress?.({
        done,
        total,
        label: asset.label,
        percentage: Math.min(100, ((done + assetPct / 100) / total) * 100),
      });
    emit();
    try {
      await downloadAsset({
        assetSrc: asset.src as never,
        onProgress: (p: ModelProgressUpdate) => {
          assetPct = p.percentage ?? 0;
          emit();
        },
      });
      ok += 1;
    } catch (error) {
      logEvent({
        kind: 'error',
        model: 'prefetch',
        extra: { asset: asset.label, message: String((error as Error)?.message ?? error) },
      });
    }
    done += 1;
    assetPct = 100;
    emit();
  }

  logEvent({
    kind: 'model_load',
    model: 'prefetch:translation',
    totalMs: Date.now() - startedAt,
    extra: { downloaded: ok, total, cancelled: Boolean(options.isCancelled?.()) },
  });
  return ok;
}
