import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { SnapPlateMark } from '@/components/brand/SnapPlateMark';
import { hapticMedium } from '@/services/haptics';
import { releaseNativeSplash } from '@/services/splash';
import { motion, palette } from '@/theme/tokens';

const WORDMARK = 'SnapPlate';
/** Gap between the reveal of consecutive wordmark letters. */
const LETTER_STAGGER = 48;
/** Wordmark starts once the plate outline has mostly landed. */
const WORDMARK_DELAY = 560;
const HAIRLINE_DELAY = 1020;
const TAGLINE_DELAY = 1080;
/** The boot sequence always takes at least this long. */
const INTRO_HOLD_MS = 2150;
/** Length of the zoom-out hand-off into the app. */
const REVEAL_MS = 620;

type BrandSplashProps = {
  /** True once the session/auth restore has resolved and the app is ready. */
  canReveal: boolean;
  /** Called after the hand-off animation finishes, so the splash can unmount. */
  onRevealed: () => void;
};

/**
 * Animated app-launch sequence.
 *
 * Four beats, all driven on the UI thread:
 * 1. the mark draws itself in vector strokes,
 * 2. "SnapPlate" reveals letter-by-letter on a spring,
 * 3. the tagline fades in under an emerald hairline,
 * 4. the mark scales up as an entry mask, revealing the app that has been
 *    mounting (and fetching its first payload) underneath the whole time.
 *
 * The root layout keeps this component mounted across the auth-restore branch so
 * the timeline never restarts when the session resolves; the only external gate
 * is `canReveal`. Reduced-motion users get a shortened, non-scaling variant.
 */
export function BrandSplash({ canReveal, onRevealed }: BrandSplashProps) {
  const reduceMotion = useReducedMotion();
  const reveal = useSharedValue(0);
  const [isIntroComplete, setIsIntroComplete] = useState(false);
  const hasRevealed = useRef(false);

  useEffect(() => {
    // Our animated splash is on screen now: hand the OS splash over to it.
    releaseNativeSplash();
    const timer = setTimeout(() => setIsIntroComplete(true), reduceMotion ? 700 : INTRO_HOLD_MS);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  useEffect(() => {
    if (!isIntroComplete || !canReveal || hasRevealed.current) return;
    hasRevealed.current = true;
    hapticMedium();
    reveal.value = withTiming(
      1,
      { duration: reduceMotion ? motion.duration.base : REVEAL_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onRevealed)();
      },
    );
  }, [isIntroComplete, canReveal, reveal, onRevealed, reduceMotion]);

  // The canvas stays fully opaque until the mask opens, so the app is revealed
  // by the expanding mark rather than by a cross-fade.
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(reveal.value, [0, 0.6, 1], [1, 1, 0], Extrapolation.CLAMP),
  }));

  const markStyle = useAnimatedStyle(() => ({
    opacity: interpolate(reveal.value, [0, 0.75, 1], [1, 0.9, 0], Extrapolation.CLAMP),
    transform: [{ scale: reduceMotion ? 1 : interpolate(reveal.value, [0, 1], [1, 5.5]) }],
  }));

  const copyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(reveal.value, [0, 0.35, 1], [1, 0, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(reveal.value, [0, 1], [0, -14]) }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.shell, backdropStyle]}
      pointerEvents="auto"
      accessibilityViewIsModal
      accessibilityLabel="SnapPlate is starting">
      <Animated.View style={markStyle}>
        <SnapPlateMark size={86} animate={!reduceMotion} />
      </Animated.View>

      <Animated.View style={copyStyle} className="items-center">
        <Wordmark reduceMotion={reduceMotion} />
        <Hairline delay={HAIRLINE_DELAY} />
        <Tagline delay={TAGLINE_DELAY} />
      </Animated.View>
    </Animated.View>
  );
}
/** The brand name, one spring-animated letter at a time. */
function Wordmark({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <View className="mt-7 flex-row" accessibilityRole="header" accessibilityLabel={WORDMARK}>
      {WORDMARK.split('').map((char, index) => (
        <RevealLetter
          key={`${char}-${index}`}
          char={char}
          delay={reduceMotion ? 0 : WORDMARK_DELAY + index * LETTER_STAGGER}
        />
      ))}
    </View>
  );
}

/**
 * One glyph of the wordmark. Each letter owns its shared value (rather than the
 * parent owning an array) so the stagger lives in the animation delay and the
 * render tree stays a flat, hook-safe list.
 */
function RevealLetter({ char, delay }: { char: string; delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, motion.spring.brand));
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    // Clamped so the spring's overshoot cannot push opacity past 1.
    opacity: interpolate(progress.value, [0, 0.5], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [18, 0]) },
      { scale: interpolate(progress.value, [0, 1.06], [0.82, 1]) },
    ],
  }));

  return (
    <Animated.Text
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.wordmark, style]}>
      {char}
    </Animated.Text>
  );
}

/** Emerald hairline that draws itself outward between wordmark and tagline. */
function Hairline({ delay }: { delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: motion.duration.slow, easing: Easing.out(Easing.cubic) }),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4], [0, 1], Extrapolation.CLAMP),
    transform: [{ scaleX: progress.value }],
  }));

  return <Animated.View className="mt-4 h-[2px] w-9 rounded-full bg-emerald-400" style={[styles.hairline, style]} />;
}

function Tagline({ delay }: { delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: motion.duration.tagline, easing: Easing.out(Easing.quad) }),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [6, 0]) }],
  }));

  return <Animated.Text style={[styles.tagline, style]}>Photograph. Analyze. Fuel.</Animated.Text>;
}

const styles = StyleSheet.create({
  shell: {
    zIndex: 50,
    elevation: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.canvas,
  },
  hairline: {
    opacity: 0.8,
  },
  wordmark: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1.4,
    color: palette.textPrimary,
    // Nudges the per-letter Text nodes back to optically tight tracking.
    marginHorizontal: -0.5,
  },
  tagline: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3.2,
    textTransform: 'uppercase',
    color: palette.textSubtle,
  },
});

