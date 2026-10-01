import { useEffect, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { motion } from '@/theme/tokens';

type ProgressBarProps = {
  /** Completion 0–100. Values outside the range are clamped to the track. */
  percent: number;
  /** Tailwind background class for the fill, e.g. `bg-emerald-500`. */
  fillClassName: string;
  /** Track height in points. 8pt is the default pill, 10pt for the hero bar. */
  height?: number;
  /** Tailwind background class for the track (an inset well by default). */
  trackClassName?: string;
  /** `false` renders the value instantly — used by static summaries. */
  animated?: boolean;
};

/**
 * Rounded pill progress bar whose fill springs to its value on mount.
 *
 * The width is animated in points against the measured track rather than as a
 * percentage string, because Reanimated cannot interpolate between percentage
 * values — measuring once with `onLayout` is what keeps the spring smooth.
 */
export function ProgressBar({
  percent,
  fillClassName,
  height = 8,
  trackClassName = 'bg-surface-sunken',
  animated = true,
}: ProgressBarProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useSharedValue(0);
  const target = Math.max(0, Math.min(percent, 100));

  useEffect(() => {
    progress.value = animated ? withSpring(target, motion.spring.fill) : withTiming(target, { duration: 0 });
  }, [target, animated, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: (trackWidth * progress.value) / 100,
  }));

  return (
    <View
      className={`overflow-hidden rounded-full ${trackClassName}`}
      style={{ height }}
      onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target) }}>
      <Animated.View
        className={`h-full rounded-full ${fillClassName}`}
        style={fillStyle}
        // The fill is purely decorative; the track above carries the a11y value.
        pointerEvents="none"
      />
    </View>
  );
}
