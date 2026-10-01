import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  BookmarkSimple,
  Camera,
  CaretRight,
  CheckCircle,
  Warning,
  X,
} from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MacroBar } from '@/components/MacroBar';
import { MacroTile } from '@/components/MacroTile';
import { RingSpinner } from '@/components/camera/ShutterButton';
import { Skeleton, SkeletonCard } from '@/components/motion/Skeleton';
import { FoodItemCard } from '@/components/results/FoodItemCard';
import { HeroImageHeader } from '@/components/results/HeroImageHeader';
import { analyzeMealImage, type NutritionResult } from '@/services/ai';
import { showAlert } from '@/services/alert';
import { hapticError, hapticLight, hapticSuccess } from '@/services/haptics';
import { recordScan } from '@/services/history';
import { sheetStyle, topInset } from '@/services/layout';
import { useNutritionStore } from '@/store/nutrition-store';
import { palette } from '@/theme/tokens';

function suggestMealName(result: NutritionResult): string {
  const first = result.items_detected[0]?.name?.trim();
  return first ? first : 'My Meal';
}

/**
 * Nutrition Results & Breakdown — Warm Editorial presentation.
 */
export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; cached?: string }>();

  const pendingImage = useNutritionStore((s) => s.pendingImage);
  const lastResult = useNutritionStore((s) => s.lastResult);
  const lastAnalysisId = useNutritionStore((s) => s.lastAnalysisId);
  const lastImageUri = useNutritionStore((s) => s.lastImageUri);
  const lastImageUrl = useNutritionStore((s) => s.lastImageUrl);
  const setResult = useNutritionStore((s) => s.setResult);
  const updateItemWeight = useNutritionStore((s) => s.updateItemWeight);
  const [updatedIndex, setUpdatedIndex] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const markSaved = useNutritionStore((s) => s.markSaved);
  const lastSavedAnalysisId = useNutritionStore((s) => s.lastSavedAnalysisId);
  const [isNamePromptOpen, setIsNamePromptOpen] = useState(false);
  const [mealName, setMealName] = useState('');
  const [isSavingMeal, setIsSavingMeal] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [dismissedNamePrompt, setDismissedNamePrompt] = useState(false);
  const nameInputRef = useRef<TextInput>(null);

  const isCached = params.cached === '1' && !!lastResult && !!lastAnalysisId;
  const analysisId = isCached ? lastAnalysisId : (params.id ?? pendingImage?.analysisId);

  const query = useQuery({
    queryKey: ['nutrition', analysisId],
    queryFn: () => {
      if (!pendingImage) {
        throw new Error('No photo available to analyze.');
      }
      return analyzeMealImage(pendingImage.uri);
    },
    enabled: !!analysisId && !isCached,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data && analysisId) {
      setResult(query.data, analysisId);
    }
  }, [query.data, analysisId, setResult]);

  const displayImageUri = pendingImage?.uri ?? lastImageUri;
  const displayImageUrl = lastImageUrl;

  const selected =
    lastResult && lastAnalysisId === analysisId ? lastResult : query.data;
  const result: NutritionResult | undefined = selected;

  const isSaved = !!analysisId && !isCached && lastSavedAnalysisId === analysisId;
  const showSaveActions = !!analysisId && !isCached;

  function commitPortion(index: number, grams: number) {
    updateItemWeight(index, grams);
    setUpdatedIndex(index);
  }

  useEffect(() => {
    if (!query.data || isCached || isNamePromptOpen || dismissedNamePrompt || isSaved) return;
    if (!analysisId) return;
    setMealName(suggestMealName(query.data));
    setIsNamePromptOpen(true);
  }, [query.data, isCached, isNamePromptOpen, dismissedNamePrompt, isSaved, analysisId]);

  function openNamePrompt() {
    setMealName((current) => current.trim() || (result ? suggestMealName(result) : ''));
    setIsNamePromptOpen(true);
  }

  function dismissNamePrompt() {
    if (isSavingMeal) return;
    setDismissedNamePrompt(true);
    setIsNamePromptOpen(false);
  }

  async function saveMeal() {
    const name = mealName.trim();
    if (!result || !analysisId || !name || isSavingMeal || isSaved) return;

    setIsSavingMeal(true);
    try {
      const entryId = await recordScan(result, name, displayImageUri ?? undefined);
      markSaved(analysisId, entryId);
      setSavedName(name);
      setDismissedNamePrompt(true);
      setIsNamePromptOpen(false);
      hapticSuccess();
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (error) {
      hapticError();
      showAlert(
        'Could not save meal',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setIsSavingMeal(false);
    }
  }

  // ── No scan found ────────────────────────────────────────────────────────
  if (!analysisId && !result) {
    return (
      <View
        className="flex-1 items-center justify-center bg-canvas px-8"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-surface-raised">
          <Camera size={32} color={palette.textTertiary} weight="duotone" />
        </View>
        <Text className="mt-4 font-display text-xl text-warm-primary">No scan in progress</Text>
        <Text className="mt-1 text-center font-sans text-xs text-warm-secondary">
          Snap a photo of your plate to view nutritional analysis.
        </Text>
        <Pressable
          onPress={() => router.replace('/scanner')}
          className="mt-6 h-15 items-center justify-center rounded-inner bg-accent px-8 active:bg-accent-light">
          <Text className="font-sans-bold text-sm text-accent-ink">Scan a Meal</Text>
        </Pressable>
      </View>
    );
  }

  // ── Loading Skeleton ─────────────────────────────────────────────────────
  if (query.isLoading && !result) {
    return (
      <View
        className="flex-1 bg-canvas px-5"
        style={{ paddingTop: topInset(insets) + 20 }}>
        <View className="flex-row items-center justify-center gap-2.5">
          <RingSpinner size={16} color={palette.accent} />
          <Text className="font-sans-medium text-sm text-warm-primary">Analyzing meal photo…</Text>
        </View>
        <Text className="mt-1.5 text-center font-sans text-xs text-warm-tertiary">
          Estimating ingredients, portions, and calories with AI vision.
        </Text>

        <View className="mt-6">
          <Skeleton height={264} radius={20} />
        </View>

        <View className="mt-4 flex-row gap-3">
          {[0, 1, 2].map((key) => (
            <View
              key={key}
              className="flex-1 items-center rounded-panel border border-subtle bg-surface py-3.5">
              <Skeleton width={52} height={24} radius={8} />
              <View className="mt-2">
                <Skeleton width={40} height={10} radius={6} />
              </View>
            </View>
          ))}
        </View>

        <View className="mt-4">
          <SkeletonCard rows={3} showHeader={false} />
        </View>
      </View>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (query.isError && !result) {
    return (
      <View
        className="flex-1 items-center justify-center bg-canvas px-8"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-danger/15">
          <Warning size={32} color={palette.danger} weight="duotone" />
        </View>
        <Text className="mt-4 font-display text-xl text-warm-primary">Analysis Failed</Text>
        <Text className="mt-2 max-w-xs text-center font-sans text-xs leading-5 text-warm-secondary">
          {query.error instanceof Error ? query.error.message : 'Could not process the meal image.'}
        </Text>
        <Pressable
          onPress={() => void query.refetch()}
          className="mt-6 h-15 items-center justify-center rounded-inner bg-accent px-8 active:bg-accent-light">
          <Text className="font-sans-bold text-sm text-accent-ink">Try Again</Text>
        </Pressable>
      </View>
    );
  }

  if (!result) return null;

  const proteinKcal = result.total_protein_g * 4;
  const carbsKcal = result.total_carbs_g * 4;
  const fatKcal = result.total_fat_g * 9;
  const macroTotal = Math.max(proteinKcal + carbsKcal + fatKcal, 1);

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerClassName="px-5 pb-12"
      showsVerticalScrollIndicator={false}
      style={{ paddingTop: topInset(insets) + 10 }}>
      {/* Editorial Navigation Header */}
      <View className="flex-row items-center justify-between pb-3">
        <Pressable
          onPress={() => {
            hapticLight();
            router.back();
          }}
          className="h-11 w-11 items-center justify-center rounded-full bg-surface-raised active:bg-subtle-strong">
          <ArrowLeft size={20} color={palette.textPrimary} weight="bold" />
        </Pressable>
        <Text className="font-display text-xl text-warm-primary">Meal Breakdown</Text>
        <View className="h-11 w-11" />
      </View>

      {/* Hero photo with calorie headline */}
      <View className="mt-3">
        <HeroImageHeader
          uri={displayImageUrl}
          fallbackUri={displayImageUri}
          calories={result.total_calories}
          itemCount={result.items_detected.length}
        />
      </View>

      {/* Macro summary tiles */}
      <View className="mt-5 flex-row gap-3">
        <MacroTile label="Protein" grams={result.total_protein_g} colorClass="text-macro-protein" />
        <MacroTile label="Carbs" grams={result.total_carbs_g} colorClass="text-macro-carbs" />
        <MacroTile label="Fat" grams={result.total_fat_g} colorClass="text-macro-fat" />
      </View>

      {/* Macro distribution surface */}
      <View className="mt-5 gap-3.5 rounded-card border border-subtle bg-surface p-5">
        <Text className="font-sans-medium text-xs uppercase tracking-wider text-warm-tertiary">
          Caloric Ratio
        </Text>
        <MacroBar
          label="Protein"
          grams={result.total_protein_g}
          pct={Math.round((proteinKcal / macroTotal) * 100)}
          barClass="bg-macro-protein"
        />
        <MacroBar
          label="Carbs"
          grams={result.total_carbs_g}
          pct={Math.round((carbsKcal / macroTotal) * 100)}
          barClass="bg-macro-carbs"
        />
        <MacroBar
          label="Fat"
          grams={result.total_fat_g}
          pct={Math.round((fatKcal / macroTotal) * 100)}
          barClass="bg-macro-fat"
        />
      </View>

      {/* Detected items header */}
      <View className="mt-7 flex-row items-center justify-between">
        <Text className="font-display text-2xl text-warm-primary">Identified Foods</Text>
        {updatedIndex !== null ? (
          <View className="rounded-pill bg-positive/15 border border-positive/30 px-2.5 py-0.5">
            <Text className="font-sans-bold text-[10px] text-positive">Portion Updated</Text>
          </View>
        ) : null}
      </View>

      {result.items_detected.length === 0 ? (
        <Text className="mt-3 font-sans text-xs text-warm-tertiary">
          No individual ingredients could be separated.
        </Text>
      ) : (
        result.items_detected.map((item, index) => (
          <FoodItemCard
            key={`${item.name}-${index}`}
            item={item}
            isUpdated={updatedIndex === index}
            onCommit={(grams) => commitPortion(index, grams)}
          />
        ))
      )}

      {/* Save Meal Dialog */}
      <Modal
        visible={isNamePromptOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={dismissNamePrompt}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
          style={{ flex: 1 }}>
          <Pressable className="flex-1 justify-end bg-black/75" onPress={dismissNamePrompt}>
            <Pressable
              className="rounded-t-[28px] border-t border-subtle bg-surface px-6 pb-8 pt-6"
              style={[sheetStyle, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}
              onPress={(event) => event.stopPropagation()}>
              <View className="mb-5 flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="font-display text-2xl text-warm-primary">Save to Journal</Text>
                  <Text className="mt-1 font-sans text-xs text-warm-secondary">
                    Give this meal a label for your history log.
                  </Text>
                </View>
                <Pressable
                  onPress={dismissNamePrompt}
                  hitSlop={12}
                  className="h-11 w-11 items-center justify-center rounded-full bg-surface-raised active:bg-subtle-strong">
                  <X size={18} color={palette.textSecondary} />
                </Pressable>
              </View>

              <TextInput
                ref={nameInputRef}
                value={mealName}
                onChangeText={setMealName}
                placeholder="e.g. Avocado Toast & Eggs"
                placeholderTextColor={palette.textTertiary}
                returnKeyType="done"
                maxLength={60}
                onSubmitEditing={() => void saveMeal()}
                className="h-15 rounded-inner border border-subtle bg-surface-sunken px-4 font-sans-bold text-lg text-warm-primary"
                accessibilityLabel="Name of the meal"
              />

              <View className="mt-5 flex-row gap-3">
                <Pressable
                  onPress={dismissNamePrompt}
                  disabled={isSavingMeal}
                  className="h-15 flex-1 items-center justify-center rounded-inner border border-subtle bg-surface-sunken active:bg-surface-raised">
                  <Text className="font-sans-medium text-sm text-warm-secondary">Skip</Text>
                </Pressable>
                <Pressable
                  onPress={() => void saveMeal()}
                  disabled={isSavingMeal || mealName.trim().length === 0}
                  className={`h-15 flex-1 items-center justify-center rounded-inner ${
                    isSavingMeal || mealName.trim().length === 0
                      ? 'bg-accent/40'
                      : 'bg-accent active:bg-accent-light'
                  }`}>
                  {isSavingMeal ? (
                    <RingSpinner size={20} color={palette.accentInk} />
                  ) : (
                    <Text className="font-sans-bold text-sm text-accent-ink">Save Meal</Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Save Button / Confirmation */}
      {showSaveActions && !isSaved ? (
        <Pressable
          onPress={openNamePrompt}
          disabled={isSavingMeal}
          accessibilityRole="button"
          accessibilityLabel="Save this meal to history"
          className="mt-7 h-15 flex-row items-center justify-center gap-2 rounded-inner bg-accent active:bg-accent-light">
          <BookmarkSimple size={18} color={palette.accentInk} weight="fill" />
          <Text className="font-sans-bold text-sm text-accent-ink">Save to History</Text>
        </Pressable>
      ) : null}

      {showSaveActions && isSaved ? (
        <Pressable
          onPress={() => router.navigate('/history')}
          accessibilityRole="button"
          accessibilityLabel="Open history"
          className="mt-7 h-15 flex-row items-center justify-between rounded-inner border border-positive/30 bg-positive/10 px-4 active:bg-positive/20">
          <View className="flex-row items-center gap-2">
            <CheckCircle size={18} color={palette.positive} weight="fill" />
            <Text className="font-sans-bold text-xs text-positive">
              Logged as &ldquo;{savedName ?? 'Meal'}&rdquo;
            </Text>
          </View>
          <CaretRight size={14} color={palette.positive} weight="bold" />
        </Pressable>
      ) : null}

      {/* Secondary CTAs */}
      <View className="mt-3.5 gap-2.5">
        <Pressable
          onPress={() => router.replace('/camera')}
          className="h-13 items-center justify-center rounded-inner border border-subtle bg-surface active:bg-surface-raised">
          <Text className="font-sans-bold text-xs text-warm-primary">Snap Another Meal</Text>
        </Pressable>
        <Pressable
          onPress={() => router.navigate('/')}
          className="h-13 items-center justify-center rounded-inner active:bg-surface-sunken">
          <Text className="font-sans-medium text-xs text-warm-tertiary">Back to Dashboard</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
