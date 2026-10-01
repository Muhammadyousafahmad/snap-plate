import { useEffect } from 'react';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { palette } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Geometry of the SnapPlate mark, drawn on a 64×64 grid.
 *
 * The mark is deliberately geometric — a rounded-square plate frame, a lens
 * ring, and an emerald progress arc — so it reads as "plate + camera" without
 * resorting to the literal camera glyph every food app already uses.
 */
const FRAME_PATH =
  'M 22 6 H 42 A 16 16 0 0 1 58 22 V 42 A 16 16 0 0 1 42 58 H 22 A 16 16 0 0 1 6 42 V 22 A 16 16 0 0 1 22 6 Z';
/** Arc lengths, so each stroke can be "drawn" with a dash offset animation. */
const FRAME_LENGTH = 181;
const RING_RADIUS = 15;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
/** 100° arc starting at 12 o'clock — the progress ring. */
const ARC_PATH = 'M 32 17 A 15 15 0 0 1 46.77 34.6';
const ARC_LENGTH = RING_LENGTH * (100 / 360);

type SnapPlateMarkProps = {
  /** Rendered size in points. */
  size?: number;
  /** Run the stroke-draw animation (splash) or render the finished mark. */
  animate?: boolean;
  /** Delay before the draw starts, for sequencing against other motion. */
  startDelay?: number;
};

/**
 * The SnapPlate logo, animating itself in with a draw-SVG sequence.
 *
 * A single 0→1 shared value drives all three strokes with different windows, so
 * the plate outline lands first, the lens ring follows, and the emerald progress
 * arc completes last — one timeline, three overlapping moves, and only three
 * animated-prop hooks regardless of how many paths are added later.
 */
export function SnapPlateMark({ size = 72, animate = true, startDelay = 0 }: SnapPlateMarkProps) {
  const draw = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) return;
    draw.value = withDelay(
      startDelay,
      withTiming(1, {
        duration: 1150,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [animate, startDelay, draw]);

  const frameProps = useAnimatedProps(() => ({
    strokeDashoffset: FRAME_LENGTH * (1 - interpolate(draw.value, [0, 0.62], [0, 1], Extrapolation.CLAMP)),
  }));

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_LENGTH * (1 - interpolate(draw.value, [0.16, 0.78], [0, 1], Extrapolation.CLAMP)),
  }));

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC_LENGTH * (1 - interpolate(draw.value, [0.52, 1], [0, 1], Extrapolation.CLAMP)),
    opacity: interpolate(draw.value, [0.5, 0.72], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="SnapPlate">
      <AnimatedPath
        d={FRAME_PATH}
        // Beziers at the four corners make each stroke slightly longer than the
        // ideal perimeter, hence the small padding on the dash length.
        strokeDasharray={`${FRAME_LENGTH} ${FRAME_LENGTH}`}
        stroke={palette.textPrimary}
        strokeOpacity={0.94}
        strokeWidth={3.4}
        strokeLinecap="round"
        fill="none"
        animatedProps={frameProps}
      />
      <AnimatedCircle
        cx={32}
        cy={32}
        r={RING_RADIUS}
        strokeDasharray={`${RING_LENGTH} ${RING_LENGTH}`}
        stroke={palette.textSecondary}
        strokeOpacity={0.45}
        strokeWidth={2.6}
        fill="none"
        animatedProps={ringProps}
      />
      <AnimatedPath
        d={ARC_PATH}
        strokeDasharray={`${ARC_LENGTH} ${ARC_LENGTH}`}
        stroke={palette.accentBright}
        strokeWidth={3.4}
        strokeLinecap="round"
        fill="none"
        animatedProps={arcProps}
      />
      {/* Lens glint — the only filled shape, so the mark always has a focal point. */}
      <Circle cx={32} cy={32} r={3.2} fill={palette.accentBright} fillOpacity={0.9} />
    </Svg>
  );
}
