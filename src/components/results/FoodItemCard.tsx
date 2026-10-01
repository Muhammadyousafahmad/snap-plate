import {
  CaretDown,
  CheckCircle,
  PencilSimple,
} from 'phosphor-react-native';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Chip } from '@/components/Chip';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { PressableScale } from '@/components/motion/PressableScale';
import type { NutritionItem } from '@/services/ai';
import { getOriginalGrams, scaleNutritionItem } from '@/services/nutrition-math';
import { motion, palette } from '@/theme/tokens';

const STEPS = [-50, -10, 10, 50];
const MIN_GRAMS = 5;
const MAX_GRAMS = 2000;
const PREVIEW_DURATION = motion.duration.base;

function currentGrams(item: NutritionItem): number {
  const match = item.portion.match(/([\d.]+)\s*g\b/i);
  const parsed = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : getOriginalGrams(item);
}

function parseDraft(draft: string): number | null {
  const value = Number(draft.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function clampGrams(value: number): number {
  return Math.min(Math.max(Math.round(value), MIN_GRAMS), MAX_GRAMS);
}

type FoodItemCardProps = {
  item: NutritionItem;
  isUpdated: boolean;
  onCommit: (grams: number) => void;
};

/**
 * Editorial Food Item Card with inline spring-animated portion adjuster.
 */
export function FoodItemCard({ item, isUpdated, onCommit }: FoodItemCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(() => `${Math.round(currentGrams(item))}`);
  const [editorHeight, setEditorHeight] = useState(0);

  const expansion = useSharedValue(0);
  const draftGrams = parseDraft(draft);
  const live = isOpen && draftGrams ? scaleNutritionItem(item, draftGrams) : item;

  function open() {
    setDraft(`${Math.round(currentGrams(item))}`);
    setIsOpen(true);
    expansion.value = withSpring(1, motion.spring.reveal);
  }

  function close() {
    setIsOpen(false);
    expansion.value = withSpring(0, motion.spring.reveal);
  }

  function commit() {
    if (!draftGrams) return;
    onCommit(clampGrams(draftGrams));
    close();
  }

  function nudge(step: number) {
    setDraft(`${clampGrams((draftGrams ?? currentGrams(item)) + step)}`);
  }

  const revealStyle = useAnimatedStyle(() => ({
    height: editorHeight * expansion.value,
    opacity: expansion.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${expansion.value * 180}deg` }],
  }));

  const borderClass = isOpen
    ? 'border-accent/50 bg-surface'
    : isUpdated
      ? 'border-positive/50 bg-surface-raised'
      : 'border-subtle bg-surface';

  return (
    <View className={`mt-3 overflow-hidden rounded-panel border ${borderClass}`}>
      <PressableScale
        onPress={isOpen ? close : open}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={
          `${item.name}, ${Math.round(item.calories)} calories. ` +
          (isOpen ? 'Close portion editor' : 'Adjust portion')
        }
        className="p-4">
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 pr-3 font-sans-bold text-sm text-warm-primary">{item.name}</Text>
          <View className="flex-row items-baseline">
            <AnimatedNumber
              value={live.calories}
              duration={isOpen ? PREVIEW_DURATION : undefined}
              className="font-sans-bold text-sm text-warm-primary"
            />
            <Text className="font-sans text-xs text-warm-tertiary"> kcal</Text>
          </View>
        </View>

        <View className="mt-1.5 flex-row items-center justify-between">
          <Text className="font-sans text-xs text-warm-tertiary">{item.portion}</Text>
          <View className="flex-row items-center gap-1.5">
            {isUpdated && !isOpen ? (
              <CheckCircle size={13} color={palette.positive} weight="fill" />
            ) : (
              <PencilSimple size={13} color={palette.accent} weight="bold" />
            )}
            <Text
              className={`font-sans-bold text-[11px] ${
                isUpdated && !isOpen ? 'text-positive' : 'text-accent'
              }`}>
              {isUpdated && !isOpen ? 'Updated' : isOpen ? 'Adjusting' : 'Edit portion'}
            </Text>
            <Animated.View style={chevronStyle}>
              <CaretDown size={11} color={palette.textTertiary} weight="bold" />
            </Animated.View>
          </View>
        </View>

        <View className="mt-2.5 flex-row gap-2">
          <Chip label={`P ${Math.round(live.protein_g)}g`} />
          <Chip label={`C ${Math.round(live.carbs_g ?? 0)}g`} />
          <Chip label={`F ${Math.round(live.fat_g ?? 0)}g`} />
        </View>
      </PressableScale>

      {/* Expandable Portion Editor */}
      <Animated.View style={[{ overflow: 'hidden' }, revealStyle]}>
        <View
          style={styles.editor}
          pointerEvents={isOpen ? 'auto' : 'none'}
          accessibilityElementsHidden={!isOpen}
          importantForAccessibility={isOpen ? 'auto' : 'no-hide-descendants'}
          onLayout={(event) => setEditorHeight(event.nativeEvent.layout.height)}>
          <View className="border-t border-subtle px-4 pb-4 pt-4">
            <Text className="font-sans-medium text-[11px] uppercase tracking-wider text-warm-tertiary">
              Portion Weight
            </Text>

            <View className="mt-2 flex-row items-center gap-3">
              <View className="h-15 flex-1 flex-row items-center rounded-inner border border-subtle bg-surface-sunken px-4">
                <TextInput
                  value={draft}
                  onChangeText={(text) => setDraft(text.replace(/[^0-9.,]/g, ''))}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={commit}
                  placeholder="150"
                  placeholderTextColor={palette.textTertiary}
                  maxLength={5}
                  accessibilityLabel="Portion weight in grams"
                  className="flex-1 font-sans-bold text-lg text-warm-primary"
                  style={styles.input}
                />
                <Text className="font-sans-medium text-sm text-warm-tertiary">g</Text>
              </View>

              <View className="items-end">
                <AnimatedNumber
                  value={live.calories}
                  duration={PREVIEW_DURATION}
                  className="font-display text-xl text-accent"
                />
                <Text className="font-sans-medium text-[10px] text-warm-tertiary">preview kcal</Text>
              </View>
            </View>

            {/* Quick Nudge Pills */}
            <View className="mt-3 flex-row gap-2">
              {STEPS.map((step) => (
                <PressableScale
                  key={step}
                  onPress={() => nudge(step)}
                  accessibilityRole="button"
                  accessibilityLabel={`${step > 0 ? 'Add' : 'Remove'} ${Math.abs(step)} grams`}
                  className="h-13 flex-1 items-center justify-center rounded-pill border border-subtle bg-surface-sunken active:bg-surface-raised">
                  <Text className="font-sans-bold text-xs text-warm-secondary">
                    {step > 0 ? `+${step}` : step}
                  </Text>
                </PressableScale>
              ))}
            </View>

            {/* Commit / Cancel Buttons */}
            <View className="mt-3.5 flex-row gap-2.5">
              <PressableScale
                onPress={close}
                haptic="none"
                accessibilityRole="button"
                className="h-13 flex-1 items-center justify-center rounded-inner border border-subtle bg-surface-sunken active:bg-surface-raised">
                <Text className="font-sans-medium text-sm text-warm-secondary">Cancel</Text>
              </PressableScale>
              <PressableScale
                onPress={commit}
                disabled={!draftGrams}
                haptic="medium"
                accessibilityRole="button"
                accessibilityState={{ disabled: !draftGrams }}
                className={`h-13 flex-1 items-center justify-center rounded-inner ${
                  draftGrams ? 'bg-accent active:bg-accent-light' : 'bg-accent/40'
                }`}>
                <Text className="font-sans-bold text-sm text-accent-ink">Update</Text>
              </PressableScale>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  editor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  input: {
    paddingVertical: 0,
  },
});
