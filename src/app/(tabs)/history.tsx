import { useFocusEffect, useRouter } from 'expo-router';
import {
  CaretDown,
  CaretUp,
  ClockCounterClockwise,
  Plus,
  Trash,
} from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MealImage } from '@/components/MealImage';
import { showAlert } from '@/services/alert';
import { hapticError, hapticLight, hapticSuccess } from '@/services/haptics';
import {
  clearHistory,
  deleteHistoryEntry,
  getHistory,
  type HistoryEntry,
} from '@/services/history';
import { bottomInset, topInset } from '@/services/layout';
import { palette } from '@/theme/tokens';

/**
 * Scan history — Warm Editorial meal journal, newest first.
 * Every card features the meal photo thumbnail, calories, macro chips,
 * and an expandable item-by-item USDA audit breakdown.
 */
export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setEntries(await getHistory());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const handleDelete = (id: string, name: string) => {
    hapticLight();
    showAlert('Delete meal', `Remove "${name}" from your history?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteHistoryEntry(id)
            .then(() => {
              hapticSuccess();
              void refresh();
            })
            .catch(() => hapticError());
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (!entries || entries.length === 0) return;
    hapticLight();
    showAlert('Clear all history', 'Permanently delete all meal logs? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear all',
        style: 'destructive',
        onPress: () => {
          void clearHistory()
            .then(() => {
              hapticSuccess();
              void refresh();
            })
            .catch(() => hapticError());
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-canvas">
      {/* Editorial Header */}
      <View
        className="flex-row items-baseline justify-between px-5 pb-3"
        style={{ paddingTop: topInset(insets) + 12 }}>
        <View>
          <Text className="font-display text-3xl tracking-tight text-warm-primary">History</Text>
          <Text className="mt-0.5 font-sans text-xs text-warm-tertiary">
            Your recorded meal journal
          </Text>
        </View>

        {entries && entries.length > 0 ? (
          <Pressable
            onPress={handleClearAll}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Clear all history"
            className="h-11 flex-row items-center gap-1.5 rounded-pill border border-danger/30 bg-danger/10 px-4 active:bg-danger/20">
            <Trash size={14} color={palette.danger} weight="bold" />
            <Text className="font-sans-bold text-xs text-danger">Clear All</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Body */}
      {entries === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : entries.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-surface-raised">
            <ClockCounterClockwise size={32} color={palette.textTertiary} weight="duotone" />
          </View>
          <Text className="mt-4 font-display text-xl text-warm-primary">No meals logged yet</Text>
          <Text className="mt-2 text-center font-sans text-xs leading-5 text-warm-secondary">
            Every meal you photograph appears here with its detected foods, portions, and USDA
            nutritional audit data.
          </Text>
          <Pressable
            onPress={() => router.push('/camera')}
            accessibilityRole="button"
            accessibilityLabel="Log a meal"
            className="mt-6 h-15 flex-row items-center justify-center gap-2 rounded-inner bg-accent px-6 active:bg-accent-light">
            <Plus size={16} color={palette.accentInk} weight="bold" />
            <Text className="font-sans-bold text-sm text-accent-ink">Snap a Meal</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(entry) => entry.id}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: bottomInset(insets) + 24,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const expanded = expandedId === item.id;
            const items = item.result.items_detected;
            const title = mealTitle(item);
            const matchedCount = items.filter((food) => food.matched !== false).length;

            return (
              <Pressable
                onPress={() => {
                  hapticLight();
                  setExpandedId(expanded ? null : item.id);
                }}
                className={`overflow-hidden rounded-card border bg-surface p-4 ${
                  expanded ? 'border-accent/40' : 'border-subtle'
                }`}>
                {/* Header row with meal photo thumbnail, title, calories, and delete button */}
                <View className="flex-row items-start gap-3.5">
                  {/* Photo Thumbnail */}
                  <View className="h-16 w-16 overflow-hidden rounded-inner border border-subtle bg-surface-sunken">
                    <MealImage
                      uri={item.image_url}
                      fallbackUri={item.image_uri}
                      className="h-full w-full"
                      showPlaceholder={true}
                      placeholderSize={24}
                    />
                  </View>

                  <View className="flex-1">
                    <Text
                      numberOfLines={1}
                      className="font-sans-bold text-base text-warm-primary">
                      {title}
                    </Text>
                    <Text className="mt-0.5 font-sans text-xs text-warm-tertiary">
                      {formatTime(item.scanned_at)}
                    </Text>

                    <View className="mt-2 flex-row items-baseline gap-1.5">
                      <Text className="font-display text-xl text-warm-primary">
                        {Math.round(item.result.total_calories)}
                      </Text>
                      <Text className="font-sans-medium text-xs text-warm-tertiary">kcal</Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => handleDelete(item.id, title)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${title}`}
                    className="h-11 w-11 items-center justify-center rounded-full bg-surface-raised active:bg-danger/20">
                    <Trash size={16} color={palette.textTertiary} />
                  </Pressable>
                </View>

                {/* Macro Badges */}
                <View className="mt-3 flex-row flex-wrap gap-2">
                  <View className="rounded-pill bg-macro-protein/15 px-2.5 py-0.5">
                    <Text className="font-sans-bold text-[11px] text-macro-protein">
                      P {Math.round(item.result.total_protein_g)}g
                    </Text>
                  </View>
                  <View className="rounded-pill bg-macro-carbs/15 px-2.5 py-0.5">
                    <Text className="font-sans-bold text-[11px] text-macro-carbs">
                      C {Math.round(item.result.total_carbs_g)}g
                    </Text>
                  </View>
                  <View className="rounded-pill bg-macro-fat/15 px-2.5 py-0.5">
                    <Text className="font-sans-bold text-[11px] text-macro-fat">
                      F {Math.round(item.result.total_fat_g)}g
                    </Text>
                  </View>
                </View>

                {/* Audit Expansion Trigger */}
                <View className="mt-3 flex-row items-center justify-between border-t border-subtle pt-2.5">
                  <Text className="font-sans-medium text-xs text-warm-tertiary">
                    {items.length} item{items.length === 1 ? '' : 's'} · USDA verified {matchedCount}/{items.length}
                  </Text>
                  <View className="flex-row items-center gap-1">
                    <Text className="font-sans-medium text-[11px] text-warm-secondary">
                      {expanded ? 'Hide detail' : 'Audit'}
                    </Text>
                    {expanded ? (
                      <CaretUp size={12} color={palette.textSecondary} weight="bold" />
                    ) : (
                      <CaretDown size={12} color={palette.textSecondary} weight="bold" />
                    )}
                  </View>
                </View>

                {/* Detailed per-item audit breakdown */}
                {expanded ? (
                  <View className="mt-2.5 gap-2.5 rounded-inner bg-surface-sunken p-3">
                    {items.map((food, index) => (
                      <View
                        key={`${item.id}-${index}`}
                        className="flex-row items-center justify-between">
                        <View className="flex-1 pr-2">
                          <Text
                            className="font-sans-bold text-xs text-warm-primary"
                            numberOfLines={1}>
                            {food.name}
                          </Text>
                          <Text className="font-sans text-[11px] text-warm-tertiary">
                            {food.portion}
                          </Text>
                        </View>
                        <View className="items-end">
                          <Text className="font-sans-bold text-xs text-warm-primary">
                            {Math.round(food.calories)} kcal
                          </Text>
                          <Text
                            className={`font-sans-medium text-[10px] ${
                              food.matched === false ? 'text-danger' : 'text-warm-tertiary'
                            }`}>
                            {food.matched === false
                              ? 'no USDA match'
                              : `P ${Math.round(food.protein_g)}g · C ${Math.round(food.carbs_g ?? 0)}g`}
                          </Text>
                        </View>
                      </View>
                    ))}
                    <Text className="mt-1 font-sans text-[10px] text-warm-tertiary">
                      Portions estimated from photo · Nutrition matched to USDA FoodData Central
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mealTitle(entry: HistoryEntry): string {
  const name = entry.meal_name?.trim();
  if (name) return name;
  const items = entry.result.items_detected;
  if (items.length === 0) return 'Meal scan';
  const [first, ...rest] = items;
  return rest.length > 0 ? `${first.name} +${rest.length}` : first.name;
}
