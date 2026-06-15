/**
 * Live frequency-spectrum visualizer — a centered, mirrored row of bars that
 * react to `levels` (0..1 magnitudes). Driven by RN Animated so updates stay
 * smooth even when `levels` is pushed at ~25fps from the audio thread.
 *
 * When `active` is false the bars settle into a slow idle shimmer so the
 * surface never looks dead between turns.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { hexWithAlpha } from './ui';

interface VoiceSpectrumProps {
  /** Magnitudes 0..1, one per bar. Length defines the bar count. */
  levels: number[];
  color?: string;
  /** True while capturing/speaking — drives reactive vs. idle behavior. */
  active?: boolean;
  height?: number;
}

const DEFAULT_BARS = 24;

export function VoiceSpectrum({
  levels,
  color = colors.translate,
  active = false,
  height = 120,
}: VoiceSpectrumProps) {
  const barCount = levels.length || DEFAULT_BARS;
  const values = useRef<Animated.Value[]>([]);
  if (values.current.length !== barCount) {
    values.current = Array.from({ length: barCount }, () => new Animated.Value(0.04));
  }

  // Animate to the latest magnitudes whenever they change.
  useEffect(() => {
    const anims = values.current.map((v, i) =>
      Animated.timing(v, {
        toValue: Math.max(0.04, levels[i] ?? 0.04),
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false, // animating height
      }),
    );
    const group = Animated.parallel(anims);
    group.start();
    return () => group.stop();
  }, [levels]);

  // Idle shimmer when not active: a gentle travelling wave.
  const idle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (active) return;
    const loop = Animated.loop(
      Animated.timing(idle, {
        toValue: 1,
        duration: 2600,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, idle]);

  const bars = useMemo(() => Array.from({ length: barCount }, (_, i) => i), [barCount]);

  return (
    <View style={[styles.row, { height }]}>
      {bars.map((i) => {
        // Center bars are tallest (mirrored envelope) for a voice-orb feel.
        const center = (barCount - 1) / 2;
        const dist = Math.abs(i - center) / center; // 0 center .. 1 edge
        const envelope = 0.45 + 0.55 * (1 - dist);

        const reactiveH = values.current[i].interpolate({
          inputRange: [0, 1],
          outputRange: [height * 0.04, height * envelope],
        });
        const idleH = idle.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [
            height * (0.05 + 0.05 * Math.sin(i)),
            height * (0.05 + 0.12 * envelope),
            height * (0.05 + 0.05 * Math.cos(i)),
          ],
        });

        return (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                height: active ? reactiveH : idleH,
                backgroundColor: color,
                shadowColor: color,
                opacity: active ? 0.95 : 0.4,
              },
            ]}
          />
        );
      })}
      {/* soft floor glow */}
      <View
        pointerEvents="none"
        style={[styles.floor, { backgroundColor: hexWithAlpha(color, 0.18) }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bar: {
    flex: 1,
    maxWidth: 10,
    borderRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  floor: {
    position: 'absolute',
    bottom: -8,
    height: 16,
    left: 20,
    right: 20,
    borderRadius: 20,
  },
});
