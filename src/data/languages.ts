/**
 * Languages Wayfarer can translate offline.
 *
 * QVAC ships Bergamot neural-machine-translation models as English-pivot pairs
 * (`BERGAMOT_EN_XX` and `BERGAMOT_XX_EN`). Every language below therefore has a
 * direct model to/from English; any non-English → non-English request is routed
 * by pivoting through English (see `src/qvac/translate.ts`).
 *
 * `code` is the lowercase language code we use in the UI. It is upper-cased to
 * build the QVAC model constant name, e.g. `es` → `BERGAMOT_EN_ES`.
 */
export interface Language {
  /** Lowercase language code, also the Bergamot code (e.g. "es"). */
  code: string;
  /** Human-readable name shown in the UI. */
  label: string;
  /** Flag emoji for a friendly picker. */
  flag: string;
  /** Native/endonym name, shown as a subtitle. */
  native: string;
}

export const ENGLISH: Language = { code: 'en', label: 'English', flag: '🇬🇧', native: 'English' };

/**
 * Curated set of high-value travel languages. Each one has both
 * `BERGAMOT_EN_<CODE>` and `BERGAMOT_<CODE>_EN` available in @qvac/sdk@0.12.x.
 */
export const TARGET_LANGUAGES: Language[] = [
  { code: 'es', label: 'Spanish', flag: '🇪🇸', native: 'Español' },
  { code: 'fr', label: 'French', flag: '🇫🇷', native: 'Français' },
  { code: 'de', label: 'German', flag: '🇩🇪', native: 'Deutsch' },
  { code: 'it', label: 'Italian', flag: '🇮🇹', native: 'Italiano' },
  { code: 'pt', label: 'Portuguese', flag: '🇵🇹', native: 'Português' },
  { code: 'nl', label: 'Dutch', flag: '🇳🇱', native: 'Nederlands' },
  { code: 'ru', label: 'Russian', flag: '🇷🇺', native: 'Русский' },
  { code: 'tr', label: 'Turkish', flag: '🇹🇷', native: 'Türkçe' },
  { code: 'ar', label: 'Arabic', flag: '🇸🇦', native: 'العربية' },
  { code: 'hi', label: 'Hindi', flag: '🇮🇳', native: 'हिन्दी' },
  { code: 'zh', label: 'Chinese', flag: '🇨🇳', native: '中文' },
  { code: 'ja', label: 'Japanese', flag: '🇯🇵', native: '日本語' },
  { code: 'ko', label: 'Korean', flag: '🇰🇷', native: '한국어' },
  { code: 'th', label: 'Thai', flag: '🇹🇭', native: 'ไทย' },
  { code: 'vi', label: 'Vietnamese', flag: '🇻🇳', native: 'Tiếng Việt' },
  { code: 'id', label: 'Indonesian', flag: '🇮🇩', native: 'Bahasa Indonesia' },
];

/** All languages, English first — used to populate the picker. */
export const ALL_LANGUAGES: Language[] = [ENGLISH, ...TARGET_LANGUAGES];

const BY_CODE: Record<string, Language> = Object.fromEntries(
  ALL_LANGUAGES.map((l) => [l.code, l]),
);

export function getLanguage(code: string): Language {
  return BY_CODE[code] ?? { code, label: code.toUpperCase(), flag: '🌐', native: code };
}
