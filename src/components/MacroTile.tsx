import { Text, View } from 'react-native';

import { AnimatedNumber } from '@/components/motion/AnimatedNumber';

/** Compact macro summary tile used by the results screen. */
export function MacroTile(props: { label: string; grams: number; colorClass: string }) {
  return (
    <View className="flex-1 items-center rounded-panel border border-subtle bg-surface-raised py-3.5 px-2">
      <AnimatedNumber
        value={props.grams}
        format={(value) => `${value}g`}
        className={`text-2xl font-sans-bold tracking-tight ${props.colorClass}`}
      />
      <Text className="mt-1 text-xs font-sans-medium text-warm-tertiary">{props.label}</Text>
    </View>
  );
}

