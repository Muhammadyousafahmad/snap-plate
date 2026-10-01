import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { hapticMedium } from '@/services/haptics';
import { motion, palette } from '@/theme/tokens';

type ShutterButtonProps = {
  onPress: () => void;
  /** Disabled while the preview is not streaming yet. */
  disabled?: boolean;
  /** True from capture until the photo has been handed to the results screen. */
  isBusy?: boolean;
};

/**
 * The camera's primary action.
 *
 * It behaves like a physical shutter: it sinks to 0.92 on press-in, fires a
 * medium haptic at the same moment, and swaps its white disc for an animated
 * ring while the frame is being written — so the user gets feedback on all three
 * channels (touch, haptic, sight) without a modal spinner covering the plate.
 */
export function ShutterButton({ onPress, disabled = false, isBusy = false }: ShutterButtonProps) {
  const pressed = useSharedValue(0);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - motion.press.shutter) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withSpring(1, motion.spring.press);
        hapticMedium();
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, motion.spring.press);
      }}
      disabled={disabled || isBusy}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={isBusy ? 'Capturing photo' : 'Capture photo'}
      accessibilityState={{ disabled: disabled || isBusy, busy: isBusy }}
      className="h-20 w-20 items-center justify-center rounded-full"
      style={disabled && !isBusy ? { opacity: 0.45 } : undefined}>
      <Animated.View style={pressStyle} className="h-20 w-20">
        <View className="h-full w-full items-center justify-center rounded-full border-4 border-white/90 p-1.5">
          {isBusy ? (
            <View className="h-full w-full items-center justify-center rounded-full bg-black/60">
              <RingSpinner size={36} />
            </View>
          ) : (
            <View className="h-full w-full rounded-full bg-white" />
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * A 270°-ish arc spinning on a faint track. Used inside the shutter and as the
 * app-wide "working" indicator wherever a bare `ActivityIndicator` would read as
 * a generic system spinner.
 */
export function RingSpinner({
  size = 28,
  color = palette.accentBright,
  strokeWidth = 3,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [spin]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <Animated.View style={style} accessibilityLabel="Working">
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeOpacity={0.22}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference * 0.28} ${circumference}`}
        />
      </Svg>
    </Animated.View>
  );
}
