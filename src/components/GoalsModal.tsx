import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DailyGoals } from '@/services/goals';
import { sheetStyle } from '@/services/layout';
import { palette } from '@/theme/tokens';

type GoalsModalProps = {
  visible: boolean;
  goals: DailyGoals;
  isSaving: boolean;
  onClose: () => void;
  onSave: (goals: DailyGoals) => void;
};

type Draft = Record<keyof DailyGoals, string>;

const FIELDS: { key: keyof DailyGoals; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'carbs_g', label: 'Carbs', unit: 'g' },
  { key: 'fat_g', label: 'Fat', unit: 'g' },
];

function toDraft(goals: DailyGoals): Draft {
  return {
    calories: `${goals.calories}`,
    protein_g: `${goals.protein_g}`,
    carbs_g: `${goals.carbs_g}`,
    fat_g: `${goals.fat_g}`,
  };
}

/** Returns parsed goals, or null while any field is missing or invalid. */
function parseDraft(draft: Draft): DailyGoals | null {
  const parsed: DailyGoals = {
    calories: Number(draft.calories.replace(',', '.')),
    protein_g: Number(draft.protein_g.replace(',', '.')),
    carbs_g: Number(draft.carbs_g.replace(',', '.')),
    fat_g: Number(draft.fat_g.replace(',', '.')),
  };
  const isComplete = Object.values(parsed).every(
    (value) => Number.isFinite(value) && value > 0,
  );
  return isComplete ? parsed : null;
}

/** Bottom sheet for editing the daily targets shown on the dashboard. */
export function GoalsModal({ visible, goals, isSaving, onClose, onSave }: GoalsModalProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Draft>(() => toDraft(goals));

  // Re-seed the form on every open so it always starts from the saved values.
  useEffect(() => {
    if (visible) setDraft(toDraft(goals));
  }, [goals, visible]);

  const parsed = parseDraft(draft);
  const macroCalories = parsed
    ? parsed.protein_g * 4 + parsed.carbs_g * 4 + parsed.fat_g * 9
    : 0;
  const macroShare =
    parsed && parsed.calories > 0 ? Math.round((macroCalories / parsed.calories) * 100) : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}>
        <Pressable className="flex-1 justify-end bg-black/75" onPress={onClose}>
          <Pressable
            className="rounded-t-[28px] border-t border-subtle bg-surface px-6 pt-6"
            style={[sheetStyle, { paddingBottom: Math.max(insets.bottom, 20) + 14 }]}
            onPress={(event) => event.stopPropagation()}>
            <View className="mb-6 flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="font-display text-2xl tracking-tight text-warm-primary">
                  Daily Targets
                </Text>
                <Text className="mt-1 text-sm font-sans text-warm-secondary">
                  Set the goals SnapPlate tracks your meals against.
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                accessibilityLabel="Close goals"
                className="h-11 w-11 items-center justify-center rounded-full bg-surface-raised active:bg-subtle-strong">
                <Feather name="x" size={18} color={palette.textSecondary} />
              </Pressable>
            </View>

            <View className="gap-3.5">
              {FIELDS.map((field) => (
                <View key={field.key}>
                  <Text className="mb-1.5 text-xs font-sans-medium uppercase tracking-wider text-warm-tertiary">
                    {field.label}
                  </Text>
                  <View className="flex-row items-center rounded-inner border border-subtle bg-surface-sunken px-4">
                    <TextInput
                      value={draft[field.key]}
                      onChangeText={(value) =>
                        setDraft((current) => ({ ...current, [field.key]: value }))
                      }
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      placeholder="0"
                      placeholderTextColor={palette.textTertiary}
                      className="h-15 flex-1 text-lg font-sans-bold text-warm-primary"
                      accessibilityLabel={`${field.label} goal in ${field.unit}`}
                    />
                    <Text className="text-sm font-sans-medium text-warm-tertiary">{field.unit}</Text>
                  </View>
                </View>
              ))}
            </View>

            {parsed ? (
              <Text className="mt-3.5 text-xs font-sans text-warm-tertiary leading-5">
                Target macros yield ~{Math.round(macroCalories).toLocaleString()} kcal (
                {macroShare}% of {parsed.calories.toLocaleString()} kcal goal).
              </Text>
            ) : (
              <Text className="mt-3.5 text-xs font-sans-medium text-danger">
                Enter a positive number for each target.
              </Text>
            )}

            <Pressable
              disabled={!parsed || isSaving}
              onPress={() => {
                if (parsed) onSave(parsed);
              }}
              accessibilityRole="button"
              accessibilityLabel="Save daily goals"
              className={`mt-6 h-15 flex-row items-center justify-center gap-2 rounded-inner ${
                parsed && !isSaving ? 'bg-accent active:bg-accent-light' : 'bg-accent/40'
              }`}>
              {isSaving ? (
                <ActivityIndicator color={palette.accentInk} />
              ) : (
                <>
                  <Feather name="check" size={18} color={palette.accentInk} />
                  <Text className="text-base font-sans-bold text-accent-ink">Save Targets</Text>
                </>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
