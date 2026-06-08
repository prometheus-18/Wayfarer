import React, { useState } from 'react';
import { Alert, Modal, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../theme';
import { clear, getEntries, toJSON } from '../qvac/telemetry';
import { Button } from './ui';

/**
 * Tappable "100% offline" footer that opens a Privacy & transparency sheet.
 * Doubles as the export point for the auditable inference log required by the
 * hackathon — everything stays on-device until the user explicitly shares it.
 */
export function PrivacyFooter({ accent = colors.primary }: { accent?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity activeOpacity={0.7} onPress={() => setOpen(true)}>
        <Text style={styles.footer}>🔒 100% offline · tap for privacy & logs</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>Private by design</Text>
            <Text style={styles.body}>
              Every translation, scan and chat runs on this device using the QVAC SDK. No text,
              photo or conversation is ever sent to a server — Wayfarer works fully in airplane
              mode after models are downloaded.
            </Text>

            <View style={styles.list}>
              <Bullet>All AI inference is on-device (no cloud)</Bullet>
              <Bullet>Chats live in memory only — not written to disk</Bullet>
              <Bullet>Photos are read locally and never uploaded</Bullet>
              <Bullet>Inputs are sanitized against prompt-injection</Bullet>
            </View>

            <Text style={styles.logLabel}>Inference audit log · {getEntries().length} events</Text>
            <Button
              label="Export log (JSON)"
              icon="📤"
              accent={accent}
              onPress={async () => {
                const entries = getEntries();
                if (entries.length === 0) {
                  Alert.alert('No events yet', 'Run a translation, scan or chat first.');
                  return;
                }
                try {
                  await Share.share({ title: 'Wayfarer inference log', message: toJSON() });
                } catch {
                  // user dismissed the share sheet
                }
              }}
            />
            <View style={styles.row}>
              <Button
                label="Clear log"
                variant="tonal"
                accent={colors.textMuted}
                onPress={() => clear()}
                style={styles.flex}
              />
              <Button
                label="Close"
                variant="tonal"
                accent={accent}
                onPress={() => setOpen(false)}
                style={styles.flex}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDot}>✓</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.floating,
  },
  title: { ...typography.title, color: colors.text },
  body: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 22 },
  list: { marginTop: spacing.lg, gap: spacing.sm },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  bulletDot: { color: colors.success, fontWeight: '800', fontSize: 15 },
  bulletText: { ...typography.body, color: colors.text, flex: 1 },
  logLabel: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  flex: { flex: 1 },
});
