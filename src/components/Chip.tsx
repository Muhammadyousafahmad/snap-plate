import { Text, View } from 'react-native';

/** Small neutral pill for compact secondary labels (macro abbreviations, tags). */
export function Chip(props: { label: string }) {
  return (
    <View className="rounded-pill bg-surface-raised px-2.5 py-0.5">
      <Text className="text-[11px] font-sans-medium text-warm-secondary">{props.label}</Text>
    </View>
  );
}

