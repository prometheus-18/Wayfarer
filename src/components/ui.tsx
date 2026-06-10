import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextProps,
  TouchableOpacity,
  View,
  ViewProps,
} from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../theme';

export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

export function SectionLabel({ style, children, ...rest }: TextProps) {
  return (
    <Text style={[styles.sectionLabel, style]} {...rest}>
      {children}
    </Text>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'tonal';
  accent?: string;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: ViewProps['style'];
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  accent = colors.primary,
  loading = false,
  disabled = false,
  icon,
  style,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isTonal = variant === 'tonal';
  const inactive = disabled || loading;

  const containerStyle = [
    styles.button,
    isPrimary && { backgroundColor: accent },
    isTonal && { backgroundColor: hexWithAlpha(accent, 0.12) },
    variant === 'ghost' && styles.buttonGhost,
    inactive && styles.buttonDisabled,
    style,
  ];

  const textColor = isPrimary ? colors.white : accent;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={inactive}
      style={containerStyle}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.buttonText, { color: textColor }]}>
          {icon ? `${icon}  ` : ''}
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export function ProgressBar({ value, color = colors.primary }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

interface ModelLoadingOverlayProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  percentage: number;
  detail?: string;
  accent?: string;
}

/**
 * Full-screen overlay shown while a model downloads/loads. The first run of a
 * feature pulls weights from the network; afterwards everything is local.
 */
export function ModelLoadingOverlay({
  visible,
  title,
  subtitle,
  percentage,
  detail,
  accent = colors.primary,
}: ModelLoadingOverlayProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlayBackdrop}>
        <View style={styles.overlayCard}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={styles.overlayTitle}>{title}</Text>
          {subtitle ? <Text style={styles.overlaySubtitle}>{subtitle}</Text> : null}
          <ProgressBar value={percentage} color={accent} />
          <Text style={styles.overlayDetail}>
            {percentage > 0 ? `${Math.round(percentage)}%` : 'Preparing…'}
            {detail ? `  ·  ${detail}` : ''}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

export function EmptyState({
  emoji,
  title,
  message,
}: {
  emoji: string;
  title: string;
  message: string;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

interface NoticeProps {
  tone?: 'error' | 'warning' | 'info';
  title: string;
  detail?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

/**
 * Inline notice for errors/warnings — replaces modal Alerts so failures stay
 * visible (and screenshot-able) instead of vanishing. Errors surfaced here
 * are also mirrored to the audit log by the calling screen.
 */
export function Notice({ tone = 'error', title, detail, onRetry, onDismiss }: NoticeProps) {
  const color =
    tone === 'error' ? colors.danger : tone === 'warning' ? colors.warning : colors.primary;
  return (
    <View
      style={[
        styles.notice,
        { backgroundColor: hexWithAlpha(color, 0.1), borderColor: hexWithAlpha(color, 0.35) },
      ]}
    >
      <View style={styles.noticeBody}>
        <Text style={[styles.noticeTitle, { color }]}>
          {tone === 'error' ? '⚠️ ' : tone === 'warning' ? '🟡 ' : 'ℹ️ '}
          {title}
        </Text>
        {detail ? (
          <Text selectable style={styles.noticeDetail}>
            {detail}
          </Text>
        ) : null}
      </View>
      <View style={styles.noticeActions}>
        {onRetry ? (
          <TouchableOpacity onPress={onRetry} hitSlop={8}>
            <Text style={[styles.noticeAction, { color }]}>Retry</Text>
          </TouchableOpacity>
        ) : null}
        {onDismiss ? (
          <TouchableOpacity onPress={onDismiss} hitSlop={8}>
            <Text style={[styles.noticeAction, { color: colors.textMuted }]}>Dismiss</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export function Pill({ label, color = colors.primary }: { label: string; color?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: hexWithAlpha(color, 0.12) }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

/** Add an alpha channel to a #RRGGBB hex string. */
export function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  button: {
    height: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    ...typography.bodyStrong,
  },
  progressTrack: {
    height: 8,
    width: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  overlayBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  overlayCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow.floating,
  },
  overlayTitle: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  overlaySubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  overlayDetail: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 44,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
  },
  emptyMessage: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  notice: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  noticeBody: { gap: 2 },
  noticeTitle: { ...typography.bodyStrong },
  noticeDetail: { ...typography.caption, color: colors.textMuted, lineHeight: 17 },
  noticeActions: { flexDirection: 'row', gap: spacing.lg, justifyContent: 'flex-end' },
  noticeAction: { ...typography.caption, fontWeight: '800', textTransform: 'uppercase' },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillText: {
    ...typography.caption,
    fontWeight: '700',
  },
});
