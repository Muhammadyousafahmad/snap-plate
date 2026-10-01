import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';

type StatCardProps = {
  icon: ComponentProps<typeof Feather>['name'];
  /** Hex color for the icon, matching the tint bubble. */
  iconColor: string;
  /** Tailwind background class for the icon bubble, e.g. `bg-amber-500/15`. */
  tintClass?: string;
  value: string;
  label: string;
};

/** Compact metric tile used by the dashboard's streak / scans / average row. */
export function StatCard({
  icon,
  iconColor,
  tintClass = 'bg-surface-sunken',
  value,
  label,
}: StatCardProps) {
  return (
    <View className="flex-1 rounded-card border border-subtle bg-surface p-4">
      <View className={`h-8 w-8 items-center justify-center rounded-inner ${tintClass}`}>
        <Feather name={icon} size={15} color={iconColor} />
      </View>
      <Text className="mt-3 text-xl font-sans-bold text-warm-primary">{value}</Text>
      <Text className="mt-0.5 text-xs font-sans-medium leading-4 text-warm-tertiary">{label}</Text>
    </View>
  );
}
