import { type ComponentProps, type ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { hapticLight, hapticMedium } from '@/services/haptics';
import { motion } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = Omit<ComponentProps<typeof Pressable>, 'style' | 'children'> & {
  children?: ReactNode;
  /** Scale reached while the finger is down. Defaults to 0.96. */
  scaleTo?: number;
  /** Haptic fired on press-in. `none` keeps silent utility taps silent. */
  haptic?: 'light' | 'medium' | 'none';
  style?: StyleProp<ViewStyle>;
};

/**
 * A `Pressable` that sinks slightly while held.
 *
 * Press feedback is the cheapest way to make an interface feel physical, so it
 * lives in one primitive rather than being re-implemented per screen: the
 * transform is driven by a spring on the UI thread (no re-render per frame) and
 * the haptic is fired from the press-in handler so it lands with the visual.
 */
export function PressableScale({
  children,
  scaleTo = motion.press.button,
  haptic = 'light',
  style,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style, animatedStyle]}
      onPressIn={(event) => {
        pressed.value = withSpring(1, motion.spring.press);
        if (haptic === 'light') hapticLight();
        if (haptic === 'medium') hapticMedium();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withSpring(0, motion.spring.press);
        onPressOut?.(event);
      }}>
      {children}
    </AnimatedPressable>
  );
}
