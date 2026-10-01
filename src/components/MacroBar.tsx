import { Text, View } from 'react-native';

import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { ProgressBar } from '@/components/motion/ProgressBar';

/**
 * One macro row: label, grams, share of the goal, and a pill bar.
 *
 * Grams and percentage both count up on the same 900 ms curve as the bar spring,
 * so the row reads as a single "filling up" gesture instead of a label popping to
 * its final value while the bar is still moving.
 */
export function MacroBar(props: { label: string; grams: number; pct: number; barClass: string }) {
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-sans-medium text-warm-secondary">{props.label}</Text>
        <View className="flex-row items-center">
          <AnimatedNumber
            value={props.grams}
            format={(value) => `${value}g`}
            className="text-xs font-sans-bold text-warm-primary"
          />
          <Text className="text-xs font-sans-medium text-warm-tertiary"> · </Text>
          <AnimatedNumber
            value={props.pct}
            format={(value) => `${value}%`}
            className="text-xs font-sans-medium text-warm-tertiary"
          />
        </View>
      </View>
      <View className="mt-1.5">
        <ProgressBar percent={props.pct} fillClassName={props.barClass} height={6} />
      </View>
    </View>
  );
}

