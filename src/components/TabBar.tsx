import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../theme';
import { hexWithAlpha } from './ui';

export type TabKey = 'interpreter' | 'translate' | 'scan' | 'assistant';

export interface TabItem {
  key: TabKey;
  label: string;
  icon: string;
  accent: string;
}

export const TABS: TabItem[] = [
  { key: 'interpreter', label: 'Voice', icon: '🎙️', accent: colors.translate },
  { key: 'translate', label: 'Translate', icon: '🗣️', accent: colors.translate },
  { key: 'scan', label: 'Scan', icon: '📷', accent: colors.scan },
  { key: 'assistant', label: 'Assistant', icon: '🧭', accent: colors.assistant },
];

interface TabBarProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
}

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <View style={styles.wrapper}>
      {TABS.map((tab) => {
        const focused = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            activeOpacity={0.8}
            style={styles.tab}
            onPress={() => onChange(tab.key)}
          >
            <View
              style={[
                styles.iconWrap,
                focused && { backgroundColor: hexWithAlpha(tab.accent, 0.14) },
              ]}
            >
              <Text style={styles.icon}>{tab.icon}</Text>
            </View>
            <Text
              style={[
                styles.label,
                { color: focused ? tab.accent : colors.textFaint },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
    paddingHorizontal: spacing.sm,
    ...shadow.floating,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  iconWrap: {
    width: 52,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
  },
});
