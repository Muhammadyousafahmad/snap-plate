import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ArrowClockwise,
  Camera,
  CaretRight,
  Flame,
  Plus,
  SlidersHorizontal,
  Sparkle,
  TrendUp,
  WifiSlash,
} from 'phosphor-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoalsModal } from '@/components/GoalsModal';
import { MacroBar } from '@/components/MacroBar';
import { MealImage } from '@/components/MealImage';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { ProgressBar } from '@/components/motion/ProgressBar';
import { SkeletonCard, SkeletonMealList } from '@/components/motion/Skeleton';
import { SwipeableRow } from '@/components/motion/SwipeableRow';
import { WeeklyChart } from '@/components/WeeklyChart';
import { showAlert } from '@/services/alert';
import { goalPercent, loadDashboard, type DashboardData } from '@/services/dashboard';
import { saveDailyGoals, type DailyGoals } from '@/services/goals';
import { hapticError, hapticLight, hapticSuccess } from '@/services/haptics';
import { deleteHistoryEntry, type HistoryEntry } from '@/services/history';
import { topInset } from '@/services/layout';
import { useNutritionStore } from '@/store/nutrition-store';
import { palette } from '@/theme/tokens';

/**
 * Redesigned Warm Editorial Dashboard.
 *
 * Distinctive typography: DM Serif Display for calorie hero & section titles,
 * Inter for tabular data and metadata. Food photos are front-and-center.
 */
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const lastAnalysisId = useNutritionStore((state) => state.lastAnalysisId);
  const lastResult = useNutritionStore((state) => state.lastResult);

  const [isGoalsOpen, setIsGoalsOpen] = useState(false);
  const [isSavingGoals, setIsSavingGoals] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const query = useQuery({ queryKey: ['dashboard'], queryFn: loadDashboard });
  const { refetch } = query;
  const data = query.data;

  const hasFocusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }, [queryClient]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleSaveGoals = useCallback(
    async (nextGoals: DailyGoals) => {
      setIsSavingGoals(true);
      try {
        await saveDailyGoals(nextGoals);
        setIsGoalsOpen(false);
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      } finally {
        setIsSavingGoals(false);
      }
    },
    [queryClient],
  );

  const handleDeleteMeal = useCallback(
    (entry: HistoryEntry) => {
      const name = entry.meal_name?.trim() || summarizeItems(entry);
      showAlert('Delete meal', `Remove “${name}” from today?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteHistoryEntry(entry.id);
                hapticSuccess();
                await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
              } catch {
                hapticError();
              }
            })();
          },
        },
      ]);
    },
    [queryClient],
  );

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: topInset(insets) + 6 }}>
      {query.isLoading ? (
        <DashboardSkeleton />
      ) : !data ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-danger/15">
            <WifiSlash size={26} color={palette.danger} weight="duotone" />
          </View>
          <Text className="mt-4 font-display text-xl text-warm-primary">Dashboard unavailable</Text>
          <Text className="mt-2 text-center font-sans text-sm leading-6 text-warm-secondary">
            {query.error instanceof Error
              ? query.error.message
              : 'Could not load your nutrition data.'}
          </Text>
          <Pressable
            onPress={() => void refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading the dashboard"
            className="mt-6 h-13 flex-row items-center justify-center gap-2 rounded-inner border border-accent/40 bg-accent/15 px-6 active:bg-accent/25">
            <ArrowClockwise size={18} color={palette.accent} weight="bold" />
            <Text className="font-sans-bold text-sm text-accent">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-12"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={palette.accent}
              colors={[palette.accent]}
              progressBackgroundColor={palette.surface}
            />
          }>
          {/* Editorial Top Bar */}
          <DashboardHeader
            name={data.firstName}
            isEmailVerified={data.isEmailVerified}
            streakDays={data.streakDays}
            onOpenProfile={() => router.navigate('/profile')}
          />

          {/* Calorie Hero Card */}
          <HeroCalorieCard data={data} onEditGoals={() => setIsGoalsOpen(true)} />

          {/* Quick Metrics Bar */}
          <View className="mt-4 flex-row gap-3">
            <MetricTile
              icon={<Flame size={18} color={palette.warning} weight="fill" />}
              value={`${data.streakDays}`}
              unit={data.streakDays === 1 ? 'day streak' : 'days streak'}
            />
            <MetricTile
              icon={<Sparkle size={18} color={palette.accent} weight="fill" />}
              value={`${data.totalScans}`}
              unit={data.totalScans === 1 ? 'total meal' : 'total meals'}
            />
            <MetricTile
              icon={<TrendUp size={18} color={palette.positive} weight="bold" />}
              value={`${Math.round(data.averageCalories)}`}
              unit="avg kcal"
            />
          </View>

          {/* Weekly Trend Surface */}
          <WeeklySurface data={data} />

          {/* Today's Meals Section */}
          <View className="mt-7">
            <View className="flex-row items-baseline justify-between pb-3">
              <View>
                <Text className="font-display text-2xl text-warm-primary">Today&apos;s Plate</Text>
                <Text className="mt-0.5 font-sans text-xs text-warm-tertiary">
                  {data.todayScans === 0
                    ? 'No meals logged yet today'
                    : `${data.todayScans} meal${data.todayScans === 1 ? '' : 's'} · ${Math.round(
                        data.today.calories,
                      ).toLocaleString()} kcal logged`}
                </Text>
              </View>

              <Pressable
                onPress={() => router.navigate('/history')}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Open full history"
                className="flex-row items-center gap-1 px-1 py-1.5 active:opacity-70">
                <Text className="font-sans-bold text-xs text-accent">Full History</Text>
                <CaretRight size={13} color={palette.accent} weight="bold" />
              </Pressable>
            </View>

            {data.todayMeals.length === 0 ? (
              <View className="mt-2 items-center rounded-card border border-subtle bg-surface px-6 py-8">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                  <Camera size={26} color={palette.accent} weight="duotone" />
                </View>
                <Text className="mt-3.5 font-display text-lg text-warm-primary">
                  Start tracking today
                </Text>
                <Text className="mt-1.5 text-center font-sans text-xs leading-5 text-warm-secondary">
                  Take a photo of your meal or snack to track calories and macros effortlessly.
                </Text>
                <Pressable
                  onPress={() => router.push('/camera')}
                  accessibilityRole="button"
                  accessibilityLabel="Snap a meal"
                  className="mt-5 h-15 flex-row items-center justify-center gap-2 rounded-inner bg-accent px-5 active:bg-accent-light">
                  <Plus size={16} color={palette.accentInk} weight="bold" />
                  <Text className="font-sans-bold text-xs text-accent-ink">Snap a Meal</Text>
                </Pressable>
              </View>
            ) : (
              <View className="mt-2 overflow-hidden rounded-card border border-subtle bg-surface">
                {data.todayMeals.map((entry, index) => {
                  const isLatest = entry.id === lastAnalysisId && lastResult !== null;
                  return (
                    <SwipeableRow
                      key={entry.id}
                      divider={index !== 0}
                      deleteLabel={`Delete ${entry.meal_name?.trim() || summarizeItems(entry)}`}
                      onDelete={() => handleDeleteMeal(entry)}
                      onPress={
                        isLatest
                          ? () =>
                              router.push({
                                pathname: '/results',
                                params: { id: entry.id, cached: '1' },
                              })
                          : undefined
                      }>
                      <MealRow entry={entry} isLatest={isLatest} />
                    </SwipeableRow>
                  );
                })}
              </View>
            )}

            {data.todayMeals.length > 0 ? (
              <Text className="mt-2.5 pl-1 font-sans text-[11px] text-warm-tertiary">
                Swipe left on any meal to remove it.
              </Text>
            ) : null}
          </View>

          <Text className="mt-10 pb-4 text-center font-sans text-xs leading-5 text-warm-tertiary">
            Nutrition powered by USDA FoodData Central · Your photos are encrypted & private.
          </Text>
        </ScrollView>
      )}

      {data ? (
        <GoalsModal
          visible={isGoalsOpen}
          goals={data.goals}
          isSaving={isSavingGoals}
          onClose={() => setIsGoalsOpen(false)}
          onSave={handleSaveGoals}
        />
      ) : null}
    </View>
  );
}

/**
 * Editorial top bar: date, greeting, streak badge, and avatar.
 */
function DashboardHeader({
  name,
  isEmailVerified,
  streakDays,
  onOpenProfile,
}: {
  name: string;
  isEmailVerified: boolean;
  streakDays: number;
  onOpenProfile: () => void;
}) {
  const initial = (name.trim()[0] ?? 'S').toUpperCase();
  const dateString = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const pulse = useSharedValue(0);

  useEffect(() => {
    if (isEmailVerified) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [isEmailVerified, pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: isEmailVerified
      ? 0
      : interpolate(pulse.value, [0, 1], [0.45, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.4]) }],
  }));

  return (
    <View className="flex-row items-center justify-between pt-1 pb-3">
      <View>
        <Text className="font-sans-medium text-xs uppercase tracking-wider text-warm-tertiary">
          {dateString}
        </Text>
        <Text className="font-display text-2xl tracking-tight text-warm-primary">
          {getGreeting(new Date().getHours())}, {name}
        </Text>
      </View>

      <View className="flex-row items-center gap-2.5">
        {streakDays > 0 ? (
          <View className="flex-row items-center gap-1.5 rounded-pill border border-subtle bg-surface-raised px-3 py-1.5">
            <Flame size={14} color={palette.warning} weight="fill" />
            <Text className="font-sans-bold text-xs text-warm-primary">{streakDays}d</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            hapticLight();
            onOpenProfile();
          }}
          accessibilityRole="button"
          accessibilityLabel={
            isEmailVerified ? 'Open profile' : 'Open profile — email not verified'
          }
          className="h-11 w-11 items-center justify-center">
          <Animated.View
            pointerEvents="none"
            style={haloStyle}
            className="absolute h-11 w-11 rounded-full border-2 border-warning"
          />
          <View className="h-11 w-11 items-center justify-center rounded-full border border-subtle-strong bg-surface-raised">
            <Text className="font-sans-bold text-sm text-accent">{initial}</Text>
          </View>
          {!isEmailVerified ? (
            <View className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-canvas bg-warning" />
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Editorial Hero Calorie Card with big DM Serif typography.
 */
function HeroCalorieCard({
  data,
  onEditGoals,
}: {
  data: DashboardData;
  onEditGoals: () => void;
}) {
  const caloriePercent = goalPercent(data.today.calories, data.goals.calories);
  const remaining = Math.round(data.goals.calories - data.today.calories);
  const isOver = remaining < 0;

  return (
    <View className="mt-3 rounded-card border border-subtle bg-surface p-5">
      <View className="flex-row items-center justify-between">
        <Text className="font-sans-medium text-xs uppercase tracking-wider text-warm-tertiary">
          Calories Today
        </Text>
        <Pressable
          onPress={() => {
            hapticLight();
            onEditGoals();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Edit daily goals"
          className="h-11 flex-row items-center gap-1 rounded-pill bg-surface-raised px-3.5 active:bg-subtle-strong">
          <SlidersHorizontal size={12} color={palette.textSecondary} weight="bold" />
          <Text className="font-sans-medium text-[11px] text-warm-secondary">Targets</Text>
        </Pressable>
      </View>

      <View className="mt-4 flex-row items-baseline justify-between">
        <View className="flex-row items-baseline gap-2">
          <AnimatedNumber
            value={data.today.calories}
            className="font-display text-[44px] tracking-tight text-warm-primary"
          />
          <Text className="font-sans-medium text-sm text-warm-tertiary">
            / {data.goals.calories.toLocaleString()} kcal
          </Text>
        </View>

        <View
          className={`rounded-pill px-3 py-1 ${
            isOver ? 'bg-danger/15' : 'bg-surface-raised border border-subtle'
          }`}>
          <AnimatedNumber
            value={Math.abs(remaining)}
            format={(value) => `${value.toLocaleString()} ${isOver ? 'over' : 'left'}`}
            className={`font-sans-bold text-xs ${isOver ? 'text-danger' : 'text-accent'}`}
          />
        </View>
      </View>

      {/* Hero progress bar */}
      <View className="mt-3.5">
        <ProgressBar
          percent={caloriePercent}
          fillClassName={isOver ? 'bg-danger' : 'bg-accent'}
          height={8}
        />
      </View>

      {/* Harmonized macro breakdown */}
      <View className="mt-5 gap-3.5 border-t border-subtle pt-4">
        <MacroBar
          label="Protein"
          grams={data.today.protein_g}
          pct={goalPercent(data.today.protein_g, data.goals.protein_g)}
          barClass="bg-macro-protein"
        />
        <MacroBar
          label="Carbs"
          grams={data.today.carbs_g}
          pct={goalPercent(data.today.carbs_g, data.goals.carbs_g)}
          barClass="bg-macro-carbs"
        />
        <MacroBar
          label="Fat"
          grams={data.today.fat_g}
          pct={goalPercent(data.today.fat_g, data.goals.fat_g)}
          barClass="bg-macro-fat"
        />
      </View>
    </View>
  );
}

/** Compact metric tile for secondary stats. */
function MetricTile({
  icon,
  value,
  unit,
}: {
  icon: React.ReactNode;
  value: string;
  unit: string;
}) {
  return (
    <View className="flex-1 rounded-card border border-subtle bg-surface p-3.5">
      <View className="h-7 w-7 items-center justify-center rounded-inner bg-surface-sunken">
        {icon}
      </View>
      <Text className="mt-2.5 font-display text-xl text-warm-primary">{value}</Text>
      <Text className="mt-0.5 font-sans-medium text-[11px] text-warm-tertiary">{unit}</Text>
    </View>
  );
}

/** Weekly adherence surface. */
function WeeklySurface({ data }: { data: DashboardData }) {
  return (
    <View className="mt-4 rounded-card border border-subtle bg-surface p-5">
      <View className="flex-row items-baseline justify-between">
        <View>
          <Text className="font-sans-medium text-xs uppercase tracking-wider text-warm-tertiary">
            7-Day Activity
          </Text>
          <View className="mt-1 flex-row items-baseline gap-1.5">
            <Text className="font-display text-2xl text-warm-primary">
              {Math.round(data.weekTotals.calories).toLocaleString()}
            </Text>
            <Text className="font-sans-medium text-xs text-warm-tertiary">kcal total</Text>
          </View>
        </View>
        <Text className="font-sans-medium text-xs text-warm-secondary">
          {data.weekScans} meal{data.weekScans === 1 ? '' : 's'} logged
        </Text>
      </View>

      <View className="mt-4">
        <WeeklyChart days={data.last7Days} goalCalories={data.goals.calories} />
      </View>

      {data.topFood ? (
        <View className="mt-4 flex-row items-center gap-2 rounded-inner border border-subtle bg-surface-sunken px-3.5 py-2.5">
          <Sparkle size={14} color={palette.accent} weight="fill" />
          <Text className="flex-1 font-sans-medium text-xs text-warm-secondary" numberOfLines={1}>
            Most frequent: <Text className="font-sans-bold text-warm-primary">{data.topFood.name}</Text> (×{data.topFood.count})
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Meal row with photo thumbnail, food name, time, and calorie chip.
 */
function MealRow({ entry, isLatest }: { entry: HistoryEntry; isLatest: boolean }) {
  const itemCount = entry.result.items_detected.length;
  const title = entry.meal_name?.trim() || summarizeItems(entry);

  return (
    <View className="flex-row items-center gap-3.5 p-3.5">
      {/* Food Photo Thumbnail! */}
      <View className="h-13 w-13 overflow-hidden rounded-inner border border-subtle bg-surface-sunken">
        <MealImage
          uri={entry.image_url}
          fallbackUri={entry.image_uri}
          className="h-full w-full"
          showPlaceholder={true}
          placeholderSize={20}
        />
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="shrink font-sans-bold text-sm text-warm-primary" numberOfLines={1}>
            {title}
          </Text>
          {isLatest ? (
            <View className="rounded-pill bg-accent/15 px-2 py-0.5">
              <Text className="font-sans-bold text-[9px] uppercase tracking-wider text-accent">
                Latest
              </Text>
            </View>
          ) : null}
        </View>
        <Text className="mt-1 font-sans text-xs text-warm-tertiary">
          {formatScanWhen(entry.scanned_at)} · {itemCount} item{itemCount === 1 ? '' : 's'}
        </Text>
      </View>

      <View className="items-end pl-2">
        <Text className="font-sans-bold text-base text-warm-primary">
          {Math.round(entry.result.total_calories)}
        </Text>
        <Text className="font-sans-medium text-[10px] text-warm-tertiary">kcal</Text>
      </View>

      {isLatest ? <CaretRight size={15} color={palette.textTertiary} weight="bold" /> : null}
    </View>
  );
}

function DashboardSkeleton() {
  return (
    <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
      <View className="mb-6 flex-row items-center justify-between">
        <View className="h-11 w-44 rounded-inner bg-surface-raised" />
        <View className="h-11 w-11 rounded-full bg-surface-raised" />
      </View>
      <View className="mb-4">
        <SkeletonCard rows={3} showHeader={true} />
      </View>
      <View className="mb-4 flex-row gap-3">
        <View className="flex-1">
          <SkeletonCard rows={0} showHeader={false} />
        </View>
        <View className="flex-1">
          <SkeletonCard rows={0} showHeader={false} />
        </View>
        <View className="flex-1">
          <SkeletonCard rows={0} showHeader={false} />
        </View>
      </View>
      <View className="mb-6">
        <SkeletonCard rows={0} showHeader={false} />
      </View>
      <SkeletonMealList rows={3} />
    </ScrollView>
  );
}

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatScanWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfScanDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.round(
    (startOfToday.getTime() - startOfScanDay.getTime()) / (24 * 60 * 60 * 1000),
  );
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  if (daysAgo <= 0) return `Today, ${time}`;
  if (daysAgo === 1) return `Yesterday, ${time}`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function summarizeItems(entry: HistoryEntry): string {
  const items = entry.result.items_detected;
  if (items.length === 0) return 'Meal scan';
  const [first, ...rest] = items;
  return rest.length > 0 ? `${first.name} +${rest.length}` : first.name;
}
