import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ALL_LANGUAGES, getLanguage, type Language } from '../data/languages';
import { colors, radius, shadow, spacing, typography } from '../theme';
import { hexWithAlpha } from './ui';

interface LanguagePickerProps {
  visible: boolean;
  title: string;
  selectedCode: string;
  /** Language code to disable (e.g. the opposite field's selection). */
  disabledCode?: string;
  accent?: string;
  onSelect: (language: Language) => void;
  onClose: () => void;
}

export function LanguagePicker({
  visible,
  title,
  selectedCode,
  disabledCode,
  accent = colors.primary,
  onSelect,
  onClose,
}: LanguagePickerProps) {
  const [query, setQuery] = useState('');
  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_LANGUAGES;
    return ALL_LANGUAGES.filter(
      (l) =>
        l.label.toLowerCase().includes(q) ||
        l.native.toLowerCase().includes(q) ||
        l.code.includes(q),
    );
  }, [query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.search}
            placeholder={`Search ${ALL_LANGUAGES.length} languages…`}
            placeholderTextColor={colors.textFaint}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
          />
          <FlatList
            data={data}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.code}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            renderItem={({ item }) => {
              const isSelected = item.code === selectedCode;
              const isDisabled = item.code === disabledCode;
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={isDisabled}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  style={[
                    styles.row,
                    isSelected && { backgroundColor: hexWithAlpha(accent, 0.1) },
                    isDisabled && styles.rowDisabled,
                  ]}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Text style={styles.rowNative}>{item.native}</Text>
                  </View>
                  {isSelected ? <Text style={[styles.check, { color: accent }]}>✓</Text> : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

/** Compact pill that shows the current language and opens the picker on tap. */
export function LanguageChip({
  code,
  onPress,
  accent = colors.primary,
}: {
  code: string;
  onPress: () => void;
  accent?: string;
}) {
  const language = getLanguage(code);
  return (
    <TouchableOpacity activeOpacity={0.8} style={styles.chip} onPress={onPress}>
      <Text style={styles.chipFlag}>{language.flag}</Text>
      <Text style={[styles.chipLabel, { color: accent }]} numberOfLines={1}>
        {language.label}
      </Text>
      <Text style={[styles.chipCaret, { color: accent }]}>⌄</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.sheet,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    ...shadow.floating,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  search: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  rowDisabled: {
    opacity: 0.35,
  },
  flag: {
    fontSize: 26,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  rowNative: {
    ...typography.caption,
    color: colors.textMuted,
  },
  check: {
    fontSize: 18,
    fontWeight: '800',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexShrink: 1,
  },
  chipFlag: {
    fontSize: 18,
  },
  chipLabel: {
    ...typography.bodyStrong,
    flexShrink: 1,
  },
  chipCaret: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: -4,
  },
});
