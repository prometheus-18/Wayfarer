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
 * Every language QVAC ships a bidirectional Bergamot pair for
 * (`BERGAMOT_EN_<CODE>` **and** `BERGAMOT_<CODE>_EN`) in @qvac/sdk@0.12.x —
 * 48 languages. High-value travel languages are listed first, then the rest
 * alphabetically. Languages Supertonic can also *speak* (en/es/de/it) are
 * marked by `isTtsLanguage()` in `src/qvac/tts.ts`.
 *
 * To add one: confirm `node -e "console.log(!!require('@qvac/sdk/models').BERGAMOT_EN_XX && !!require('@qvac/sdk/models').BERGAMOT_XX_EN)"`, then add an entry.
 */
export const TARGET_LANGUAGES: Language[] = [
  // Popular travel languages first
  { code: 'es', label: 'Spanish', flag: '🇪🇸', native: 'Español' },
  { code: 'fr', label: 'French', flag: '🇫🇷', native: 'Français' },
  { code: 'de', label: 'German', flag: '🇩🇪', native: 'Deutsch' },
  { code: 'it', label: 'Italian', flag: '🇮🇹', native: 'Italiano' },
  { code: 'pt', label: 'Portuguese', flag: '🇵🇹', native: 'Português' },
  { code: 'zh', label: 'Chinese', flag: '🇨🇳', native: '中文' },
  { code: 'ja', label: 'Japanese', flag: '🇯🇵', native: '日本語' },
  { code: 'ar', label: 'Arabic', flag: '🇸🇦', native: 'العربية' },
  { code: 'hi', label: 'Hindi', flag: '🇮🇳', native: 'हिन्दी' },
  { code: 'ru', label: 'Russian', flag: '🇷🇺', native: 'Русский' },
  // The rest, alphabetical by English name
  { code: 'sq', label: 'Albanian', flag: '🇦🇱', native: 'Shqip' },
  { code: 'az', label: 'Azerbaijani', flag: '🇦🇿', native: 'Azərbaycan' },
  { code: 'bn', label: 'Bengali', flag: '🇧🇩', native: 'বাংলা' },
  { code: 'bs', label: 'Bosnian', flag: '🇧🇦', native: 'Bosanski' },
  { code: 'bg', label: 'Bulgarian', flag: '🇧🇬', native: 'Български' },
  { code: 'ca', label: 'Catalan', flag: '🌐', native: 'Català' },
  { code: 'hr', label: 'Croatian', flag: '🇭🇷', native: 'Hrvatski' },
  { code: 'cs', label: 'Czech', flag: '🇨🇿', native: 'Čeština' },
  { code: 'da', label: 'Danish', flag: '🇩🇰', native: 'Dansk' },
  { code: 'nl', label: 'Dutch', flag: '🇳🇱', native: 'Nederlands' },
  { code: 'et', label: 'Estonian', flag: '🇪🇪', native: 'Eesti' },
  { code: 'fi', label: 'Finnish', flag: '🇫🇮', native: 'Suomi' },
  { code: 'el', label: 'Greek', flag: '🇬🇷', native: 'Ελληνικά' },
  { code: 'gu', label: 'Gujarati', flag: '🇮🇳', native: 'ગુજરાતી' },
  { code: 'he', label: 'Hebrew', flag: '🇮🇱', native: 'עברית' },
  { code: 'hu', label: 'Hungarian', flag: '🇭🇺', native: 'Magyar' },
  { code: 'is', label: 'Icelandic', flag: '🇮🇸', native: 'Íslenska' },
  { code: 'id', label: 'Indonesian', flag: '🇮🇩', native: 'Bahasa Indonesia' },
  { code: 'kn', label: 'Kannada', flag: '🇮🇳', native: 'ಕನ್ನಡ' },
  { code: 'ko', label: 'Korean', flag: '🇰🇷', native: '한국어' },
  { code: 'lv', label: 'Latvian', flag: '🇱🇻', native: 'Latviešu' },
  { code: 'lt', label: 'Lithuanian', flag: '🇱🇹', native: 'Lietuvių' },
  { code: 'ml', label: 'Malayalam', flag: '🇮🇳', native: 'മലയാളം' },
  { code: 'ms', label: 'Malay', flag: '🇲🇾', native: 'Bahasa Melayu' },
  { code: 'nb', label: 'Norwegian (Bokmål)', flag: '🇳🇴', native: 'Norsk bokmål' },
  { code: 'no', label: 'Norwegian', flag: '🇳🇴', native: 'Norsk' },
  { code: 'pl', label: 'Polish', flag: '🇵🇱', native: 'Polski' },
  { code: 'ro', label: 'Romanian', flag: '🇷🇴', native: 'Română' },
  { code: 'sr', label: 'Serbian', flag: '🇷🇸', native: 'Српски' },
  { code: 'sk', label: 'Slovak', flag: '🇸🇰', native: 'Slovenčina' },
  { code: 'sl', label: 'Slovenian', flag: '🇸🇮', native: 'Slovenščina' },
  { code: 'sv', label: 'Swedish', flag: '🇸🇪', native: 'Svenska' },
  { code: 'ta', label: 'Tamil', flag: '🇮🇳', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', flag: '🇮🇳', native: 'తెలుగు' },
  { code: 'th', label: 'Thai', flag: '🇹🇭', native: 'ไทย' },
  { code: 'tr', label: 'Turkish', flag: '🇹🇷', native: 'Türkçe' },
  { code: 'uk', label: 'Ukrainian', flag: '🇺🇦', native: 'Українська' },
  { code: 'vi', label: 'Vietnamese', flag: '🇻🇳', native: 'Tiếng Việt' },
  { code: 'fa', label: 'Persian', flag: '🇮🇷', native: 'فارسی' },
];

/** All languages, English first — used to populate the picker. */
export const ALL_LANGUAGES: Language[] = [ENGLISH, ...TARGET_LANGUAGES];

const BY_CODE: Record<string, Language> = Object.fromEntries(
  ALL_LANGUAGES.map((l) => [l.code, l]),
);

export function getLanguage(code: string): Language {
  return BY_CODE[code] ?? { code, label: code.toUpperCase(), flag: '🌐', native: code };
}
