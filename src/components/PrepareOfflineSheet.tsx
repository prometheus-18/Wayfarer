import React, { useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../theme';
import {
  downloadTranslationModels,
  translationAssetCount,
  type PrefetchProgress,
} from '../qvac/prefetch';
import { ALL_LANGUAGES } from '../data/languages';
import { Button, ProgressBar } from './ui';

/**
 * "Prepare for offline" sheet. One tap pre-downloads the entire translation
 * stack — every language pair plus voice-in (Whisper) and voice-out
 * (Supertonic) — so the app works with zero signal on the trip. Downloads run
 * through `downloadAsset` (no RAM cost), are resumable, and cancellable.
 */
export function PrepareOfflineSheet({
  visible,
  onClose,
  accent = colors.primary,
}: {
  visible: boolean;
  onClose: () => void;
  accent?: string;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<PrefetchProgress | null>(null);
  const [doneCount, setDoneCount] = useState<number | null>(null);
  const cancelled = useRef(false);

  const total = translationAssetCount();

  const start = async () => {
    if (running) return;
    cancelled.current = false;
    setRunning(true);
    setDoneCount(null);
    setProgress({ done: 0, total, label: 'Starting…', percentage: 0 });
    const ok = await downloadTranslationModels({
      onProgress: setProgress,
      isCancelled: () => cancelled.current,
    });
    setRunning(false);
    setDoneCount(ok);
  };

  const close = () => {
    cancelled.current = true;
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Prepare for offline</Text>
          <Text style={styles.body}>
            Download every language ({ALL_LANGUAGES.length - 1} pairs) plus voice input and
            spoken output now, over Wi-Fi — so Translate works instantly with no signal on your
            trip. Already-downloaded models are skipped.
          </Text>

          {progress ? (
            <View style={styles.progressBlock}>
              <ProgressBar value={progress.percentage} color={accent} />
              <Text style={styles.progressText}>
                {running
                  ? `${progress.done}/${progress.total} · ${progress.label}`
                  : doneCount !== null
                    ? `✅ ${doneCount}/${total} models ready for offline use`
                    : `${Math.round(progress.percentage)}%`}
              </Text>
            </View>
          ) : (
            <Text style={styles.hint}>{total} model files · keep Wi-Fi on</Text>
          )}

          <Button
            label={running ? 'Downloading…' : doneCount !== null ? 'Download again' : 'Download all'}
            icon="⬇️"
            accent={accent}
            loading={running}
            onPress={start}
            style={styles.action}
          />
          <Button
            label={running ? 'Cancel' : 'Close'}
            variant="ghost"
            accent={colors.textMuted}
            onPress={close}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.sheet,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    ...shadow.floating,
  },
  title: { ...typography.title, color: colors.text },
  body: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 22 },
  hint: { ...typography.caption, color: colors.textFaint, marginTop: spacing.lg },
  progressBlock: { marginTop: spacing.lg, gap: spacing.sm },
  progressText: { ...typography.caption, color: colors.textMuted },
  action: { marginTop: spacing.lg },
});
