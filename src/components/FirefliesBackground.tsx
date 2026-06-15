/**
 * Ambient "fireflies" backdrop for the voice interpreter — drifting, softly
 * pulsing glow dots over the near-black background. Pure RN Animated (no native
 * deps). Decorative only; renders behind content and ignores touches.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

interface FireflyConfig {
  startX: number;
  startY: number;
  driftX: number;
  driftY: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
}

interface FirefliesBackgroundProps {
  count?: number;
  /** Accent the swarm leans toward; mixed with a warm spark tone. */
  accent?: string;
  /** Subtle overall intensity multiplier (0..1). */
  intensity?: number;
}

const SPARK = '#FFE9A8'; // warm firefly tone

export function FirefliesBackground({
  count = 18,
  accent = colors.translate,
  intensity = 1,
}: FirefliesBackgroundProps) {
  const { width, height } = Dimensions.get('window');

  const flies = useMemo<FireflyConfig[]>(() => {
    // Deterministic-ish pseudo-random spread (no Math.random dependency on
    // remounts looking identical is fine for a backdrop).
    const out: FireflyConfig[] = [];
    for (let i = 0; i < count; i += 1) {
      const r = (n: number) => ((Math.sin(i * 99.13 + n * 7.7) + 1) / 2);
      out.push({
        startX: r(1) * width,
        startY: r(2) * height,
        driftX: (r(3) - 0.5) * 120,
        driftY: (r(4) - 0.5) * 160,
        size: 3 + r(5) * 6,
        duration: 4200 + r(6) * 5200,
        delay: r(7) * 3000,
        color: r(8) > 0.5 ? accent : SPARK,
      });
    }
    return out;
  }, [count, width, height, accent]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {flies.map((f, i) => (
        <Firefly key={i} cfg={f} intensity={intensity} />
      ))}
    </View>
  );
}

function Firefly({ cfg, intensity }: { cfg: FireflyConfig; intensity: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const drift = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: cfg.duration,
          delay: cfg.delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: cfg.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1100 + cfg.size * 90,
          delay: cfg.delay,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1100 + cfg.size * 90,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    drift.start();
    pulse.start();
    return () => {
      drift.stop();
      pulse.stop();
    };
  }, [t, glow, cfg]);

  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, cfg.driftX] });
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, cfg.driftY] });
  const opacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12 * intensity, 0.8 * intensity],
  });
  const scale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.25] });

  return (
    <Animated.View
      style={[
        styles.fly,
        {
          left: cfg.startX,
          top: cfg.startY,
          width: cfg.size,
          height: cfg.size,
          borderRadius: cfg.size / 2,
          backgroundColor: cfg.color,
          shadowColor: cfg.color,
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  fly: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
  },
});
