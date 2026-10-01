import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ForkKnife } from 'phosphor-react-native';

import { MealImage } from '@/components/MealImage';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { palette } from '@/theme/tokens';

const HERO_HEIGHT = 264;

type HeroImageHeaderProps = {
  uri?: string | null;
  fallbackUri?: string | null;
  calories: number;
  itemCount: number;
};

/**
 * Editorial Hero Image Header for the results screen.
 * Food photography is presented front and center with a smooth warm charcoal scrim.
 */
export function HeroImageHeader({
  uri,
  fallbackUri,
  calories,
  itemCount,
}: HeroImageHeaderProps) {
  const gradientId = `hero-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const hasImage = Boolean(uri ?? fallbackUri);

  return (
    <View
      className="overflow-hidden rounded-card border border-subtle bg-surface-sunken"
      style={{ height: HERO_HEIGHT }}>
      {hasImage ? (
        <MealImage
          uri={uri}
          fallbackUri={fallbackUri}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <View className="h-full w-full items-center justify-center">
          <ForkKnife size={36} color={palette.textTertiary} weight="duotone" />
        </View>
      )}

      {/* Warm Scrim */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={palette.canvas} stopOpacity="0" />
              <Stop offset="0.4" stopColor={palette.canvas} stopOpacity="0.25" />
              <Stop offset="1" stopColor={palette.canvas} stopOpacity="0.95" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
      </View>

      {/* Scrim Overlay Content */}
      <View className="absolute bottom-0 left-0 right-0 p-5">
        <Text className="font-sans-medium text-[11px] uppercase tracking-widest text-warm-tertiary">
          Estimated Energy
        </Text>
        <View className="mt-1 flex-row items-baseline gap-2">
          <AnimatedNumber
            value={calories}
            className="font-display text-[46px] tracking-tight text-warm-primary"
          />
          <Text className="pb-2 font-sans-medium text-base text-warm-secondary">kcal</Text>
        </View>
        <Text className="mt-0.5 font-sans text-xs text-warm-secondary">
          {itemCount} item{itemCount === 1 ? '' : 's'} identified · tap below to adjust portions
        </Text>
      </View>
    </View>
  );
}
