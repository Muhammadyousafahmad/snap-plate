import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

/**
 * Corner brackets drawn in a 0–100 viewBox so the reticle scales to any size.
 * Four separate L-shapes read as a framing guide; a closed box would read as a
 * crop tool and competes with the food in the viewfinder.
 */
const CORNERS = [
  'M 3 30 L 3 17 A 14 14 0 0 1 17 3 L 30 3',
  'M 70 3 L 83 3 A 14 14 0 0 1 97 17 L 97 30',
  'M 97 70 L 97 83 A 14 14 0 0 1 83 97 L 70 97',
  'M 30 97 L 17 97 A 14 14 0 0 1 3 83 L 3 70',
];

type ScanReticleProps = {
  /** Edge length of the square reticle in points. */
  size?: number;
  /** Run the scanning sweep — off while the preview is not streaming. */
  isScanning?: boolean;
};

/**
 * The camera's framing guide: rounded corner brackets around the plate, plus a
 * slow vertical light sweep that tells the user the viewfinder is live. One
 * shared value drives both sweep lines from opposite ends, so the effect costs a
 * single animation handle no matter how many lines are added.
 */
export function ScanReticle({ size = 260, isScanning = true }: ScanReticleProps) {
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (!isScanning) {
      sweep.value = 0;
      return;
    }
    sweep.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [isScanning, sweep]);

  const inner = size - 28;

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      {isScanning ? (
        <View
          className="absolute overflow-hidden rounded-[26px]"
          style={{ width: inner, height: inner }}>
          <SweepLine progress={sweep} travel={inner} />
          <SweepLine progress={sweep} travel={inner} phase={0.5} />
        </View>
      ) : null}

      <Svg width={size} height={size} viewBox="0 0 100 100">
        {CORNERS.map((d) => (
          <Path
            key={d}
            d={d}
            stroke="#FFFFFF"
            strokeOpacity={0.88}
            strokeWidth={1.4}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

/**
 * A single hairline of light travelling down the reticle.
 *
 * `phase` shifts the line's window along the shared progress value instead of
 * giving it its own animation, which keeps both lines perfectly in step.
 */
function SweepLine({
  progress,
  travel,
  phase = 0,
}: {
  progress: SharedValue<number>;
  travel: number;
  phase?: number;
}) {
  const style = useAnimatedStyle(() => {
    const local = (progress.value + phase) % 1;
    return {
      transform: [{ translateY: interpolate(local, [0, 1], [-6, travel]) }],
      // Fades in off the top edge and out at the bottom so the line never
      // appears to clip against the frame.
      opacity: interpolate(local, [0, 0.12, 0.88, 1], [0, 0.5, 0.5, 0], Extrapolation.CLAMP),
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute left-2 right-2 bg-accent"
      style={[{ height: 1.5, borderRadius: 999 }, style]}
    />
  );
}
