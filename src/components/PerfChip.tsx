import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { getEntries, subscribe, InferenceKind, InferenceLogEntry } from '../qvac/telemetry';
import { hexWithAlpha } from './ui';

/**
 * Live performance HUD chip.
 *
 * Subscribes to the on-device inference audit log and shows the most recent
 * entry for the given kinds as a compact pill (TTFT · tok/s, or wall-time
 * fallbacks). Judges can compare these numbers 1:1 against the exported log —
 * both read the exact same telemetry entries. Pure consumer: no SDK imports.
 */

/** Render a log entry as a one-line perf summary (shared with the benchmark sheet). */
export function formatPerf(entry: InferenceLogEntry): string {
  if (entry.kind === 'model_load') {
    const name = entry.model ?? 'model';
    return entry.totalMs !== undefined
      ? `📦 loaded ${name} in ${formatDuration(entry.totalMs)}`
      : `📦 loaded ${name}`;
  }

  const parts: string[] = [];
  if (entry.ttftMs !== undefined) parts.push(`TTFT ${Math.round(entry.ttftMs)}ms`);
  if (entry.tokensPerSec !== undefined) parts.push(`${entry.tokensPerSec.toFixed(1)} tok/s`);

  if (parts.length === 0 && entry.totalMs !== undefined) {
    parts.push(formatDuration(entry.totalMs));
    const chars = entry.extra?.chars;
    if (typeof chars === 'number' && entry.totalMs > 0) {
      parts.push(`${Math.round((chars / entry.totalMs) * 1000)} chars/s`);
    }
  }

  return parts.length > 0 ? `⚡ ${parts.join(' · ')}` : `⚡ ${entry.kind}`;
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function findLatest(kinds: InferenceKind[]): InferenceLogEntry | undefined {
  const entries = getEntries();
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry && kinds.includes(entry.kind)) return entry;
  }
  return undefined;
}

export function PerfChip({
  kinds,
  accent = colors.primary,
}: {
  kinds: InferenceKind[];
  accent?: string;
}) {
  const [latest, setLatest] = useState<InferenceLogEntry | undefined>(() => findLatest(kinds));
  const kindsKey = kinds.join('|');

  useEffect(() => {
    const refresh = () => setLatest(findLatest(kinds));
    refresh();
    return subscribe(refresh);
    // `kindsKey` stands in for the array so inline `kinds={[...]}` props don't resubscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kindsKey]);

  if (!latest) return null;

  return (
    <View style={[styles.chip, { backgroundColor: hexWithAlpha(accent, 0.1) }]}>
      <Text style={[styles.perfText, { color: accent }]} numberOfLines={1}>
        {formatPerf(latest)}
      </Text>
      <View style={styles.dot} />
      <Text style={styles.onDevice}>on-device</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  perfText: {
    ...typography.caption,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  onDevice: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
