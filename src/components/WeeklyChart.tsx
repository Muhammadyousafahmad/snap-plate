import { Text, View } from 'react-native';

import type { WeekDayPoint } from '@/services/dashboard';

/** Height of the bar area, including the space reserved for value labels. */
const CHART_HEIGHT = 132;
/** Tallest bar height so its label always fits above the bar. */
const BAR_MAX_HEIGHT = 110;

function formatCompact(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${Math.round(value)}`;
}

/**
 * Seven-day calorie chart drawn with plain Views (no chart dependency).
 * A dashed reference line marks the daily calorie goal.
 */
export function WeeklyChart({
  days,
  goalCalories,
}: {
  days: WeekDayPoint[];
  goalCalories: number;
}) {
  const maxCalories = Math.max(goalCalories, ...days.map((day) => day.calories), 1);
  const goalOffset = Math.round((Math.min(goalCalories, maxCalories) / maxCalories) * BAR_MAX_HEIGHT);

  return (
    <View>
      <View className="mb-3 flex-row items-center gap-1.5 self-end">
        <View className="h-0 w-4 border-t border-dashed border-warm-tertiary/60" />
        <Text className="text-[11px] font-sans-medium text-warm-secondary">
          Goal {goalCalories.toLocaleString()} kcal
        </Text>
      </View>

      <View className="relative flex-row" style={{ height: CHART_HEIGHT }}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: goalOffset,
            borderTopWidth: 1,
            borderStyle: 'dashed',
            borderTopColor: 'rgba(168, 160, 154, 0.25)',
          }}
        />
        {days.map((day) => {
          const height =
            day.calories > 0
              ? Math.max(Math.round((day.calories / maxCalories) * BAR_MAX_HEIGHT), 8)
              : 5;
          const barClass = day.isToday
            ? 'bg-accent'
            : day.calories > 0
              ? 'bg-[#47413C]'
              : 'bg-surface-sunken';

          return (
            <View key={day.key} className="flex-1 items-center justify-end" style={{ height: '100%' }}>
              {day.calories > 0 ? (
                <Text className={`mb-1.5 text-[10px] font-sans-medium ${day.isToday ? 'text-accent font-sans-bold' : 'text-warm-secondary'}`}>
                  {formatCompact(day.calories)}
                </Text>
              ) : null}
              <View className={`w-5 rounded-t-md ${barClass}`} style={{ height }} />
            </View>
          );
        })}
      </View>

      <View className="mt-2.5 flex-row">
        {days.map((day) => (
          <Text
            key={day.key}
            className={`flex-1 text-center text-[11px] ${
              day.isToday ? 'text-accent font-sans-bold' : 'text-warm-tertiary font-sans-medium'
            }`}>
            {day.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
