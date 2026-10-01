import { useEffect, useId, useState } from 'react';
import { View, type DimensionValue, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { motion, palette } from '@/theme/tokens';

type SkeletonProps = {
  /** Width in points or a percentage string. Defaults to filling the parent. */
  width?: DimensionValue;
  height?: number;
  radius?: number;
  className?: string;
};

/**
 * A shimmering placeholder block.
 *
 * The sweep is an SVG linear gradient (transparent → 14 % slate → transparent)
 * translated across the block from `-width` to `+width` on the UI thread. That
 * keeps it pixel-consistent across iOS, Android and web, and costs one node
 * instead of the several a masked-view approach would need.
 *
 * `useId()` is sanitised before it becomes an SVG fragment id: React 19 emits
 * ids wrapped in `«»`, which are not safe to reference from `url(#…)`.
 */
export function Skeleton({ width = '100%', height = 14, radius = 10, className }: SkeletonProps) {
  const gradientId = `shimmer-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: motion.duration.loop, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [sweep]);

  const sweepStyle = useAnimatedStyle(() => ({
    // Travels from one full width off the left edge to one full width off the right.
    transform: [{ translateX: measuredWidth * (interpolate(sweep.value, [0, 1], [-1, 1]) as number) }],
  }));

  return (
    <View
      // One step lighter than `bg-surface` so the block stays visible against the
      // card it sits inside — the shimmer sweep alone would be too subtle.
      className={`overflow-hidden bg-surface-raised ${className ?? ''}`}
      style={{ width, height, borderRadius: radius }}
      onLayout={(event: LayoutChangeEvent) => setMeasuredWidth(event.nativeEvent.layout.width)}>
      <Animated.View style={[{ flex: 1 }, sweepStyle]} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={palette.textSecondary} stopOpacity="0" />
              <Stop offset="0.5" stopColor={palette.textSecondary} stopOpacity="0.13" />
              <Stop offset="1" stopColor={palette.textSecondary} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/**
 * Card-shaped skeleton that mirrors the real card's box model (24pt radius, 20pt
 * padding, hairline border) so the shimmer occupies the same pixels the content
 * will — no layout jump when the data lands.
 */
export function SkeletonCard({
  rows = 3,
  showHeader = true,
  height,
}: {
  rows?: number;
  showHeader?: boolean;
  height?: number;
}) {
  return (
    <View className="rounded-card border border-line bg-surface p-5">
      {showHeader ? (
        <View className="flex-row items-center justify-between">
          <Skeleton width={92} height={12} radius={6} />
          <Skeleton width={64} height={24} radius={12} />
        </View>
      ) : null}
      <View className={showHeader ? 'mt-4' : ''}>
        <Skeleton width={168} height={32} radius={10} />
      </View>
      <View className="mt-4">
        <Skeleton height={height ?? 10} radius={6} />
      </View>
      <View className="mt-5 gap-4">
        {Array.from({ length: rows }, (_, index) => (
          <View key={index}>
            <View className="flex-row items-center justify-between">
              <Skeleton width={64} height={11} radius={6} />
              <Skeleton width={48} height={11} radius={6} />
            </View>
            <View className="mt-1.5">
              <Skeleton height={8} radius={4} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * List-of-meals skeleton matching the compact dashboard rows (56pt thumbnail,
 * two stacked lines, right-aligned kcal value).
 */
export function SkeletonMealList({ rows = 3, inline = false }: { rows?: number; inline?: boolean }) {
  return (
    <View className={inline ? '' : 'overflow-hidden rounded-card border border-line bg-surface'}>
      {Array.from({ length: rows }, (_, index) => (
        <View
          key={index}
          className={`flex-row items-center gap-3 p-3.5 ${index === 0 ? '' : 'border-t border-line'}`}>
          <Skeleton width={56} height={56} radius={16} />
          <View className="flex-1 gap-2">
            <Skeleton width="58%" height={13} radius={7} />
            <Skeleton width="38%" height={10} radius={5} />
          </View>
          <Skeleton width={38} height={13} radius={7} />
        </View>
      ))}
    </View>
  );
}
