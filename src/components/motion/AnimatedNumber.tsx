import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { Easing, runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';

import { motion, type } from '@/theme/tokens';

type AnimatedNumberProps = Omit<TextProps, 'style' | 'children'> & {
  /** Target value. The counter always animates towards it. */
  value: number;
  /** Override the count-up duration (defaults to the system's 900 ms). */
  duration?: number;
  /** Formats the intermediate integer, e.g. `(n) => n.toLocaleString()`. */
  format?: (value: number) => string;
  style?: StyleProp<TextStyle>;
};

/**
 * A number that counts up to `value` instead of snapping to it.
 *
 * The value is interpolated on the UI thread and only pushed back to React when
 * the rounded integer actually changes, so a 900 ms count-up costs ~10-30
 * renders instead of ~54 — and it behaves identically on iOS, Android and web
 * (unlike the `AnimatedTextInput` trick, which does not drive `text` on web).
 *
 * On mount the counter starts from 0, which is what makes the first paint of the
 * dashboard feel like the day's numbers are "landing" rather than already there.
 */
export function AnimatedNumber({
  value,
  duration = motion.duration.count,
  format,
  style,
  ...rest
}: AnimatedNumberProps) {
  const progress = useSharedValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    progress.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration, progress]);

  useAnimatedReaction(
    () => Math.round(progress.value),
    (current, previous) => {
      if (current !== previous) runOnJS(setDisplay)(current);
    },
    [],
  );

  return (
    <Text {...rest} style={[type.tabularNums, style]}>
      {format ? format(display) : display.toLocaleString()}
    </Text>
  );
}
