import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Camera,
  Crop,
  Images,
  Sparkle,
  SunDim,
} from 'phosphor-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showAlert } from '@/services/alert';
import { hapticLight } from '@/services/haptics';
import { topInset } from '@/services/layout';
import { useNutritionStore } from '@/store/nutrition-store';
import { palette } from '@/theme/tokens';

/**
 * Scan Studio — Warm Editorial capture hub.
 * Fast access to live camera capture, photo library picker, and photography tips.
 */
export default function ScanChoiceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const setPendingImage = useNutritionStore((s) => s.setPendingImage);

  function goToResults(uri: string) {
    const analysisId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setPendingImage({ uri, mimeType: 'image/jpeg', analysisId });
    router.push({ pathname: '/results', params: { id: analysisId } });
  }

  async function pickFromGallery() {
    if (isBusy) return;
    hapticLight();
    setIsBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled) {
        setIsBusy(false);
        return;
      }
      const asset = result.assets[0];
      if (!asset?.uri) {
        throw new Error('Could not read the selected photo.');
      }
      goToResults(asset.uri);
    } catch (error) {
      setIsBusy(false);
      showAlert('Photo selection failed', error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView
        contentContainerClassName="px-5 pb-12"
        showsVerticalScrollIndicator={false}
        style={{ paddingTop: topInset(insets) + 12 }}>
        {/* Editorial Header */}
        <View className="pb-4">
          <Text className="font-display text-3xl tracking-tight text-warm-primary">
            Capture Meal
          </Text>
          <Text className="mt-0.5 font-sans text-xs text-warm-tertiary">
            Take a fresh photo or import from your library
          </Text>
        </View>

        {/* Live Camera Option */}
        <Pressable
          onPress={() => {
            hapticLight();
            router.push('/camera');
          }}
          accessibilityRole="button"
          accessibilityLabel="Scan with camera"
          className="mt-3 overflow-hidden rounded-card border border-accent/40 bg-accent/10 p-6 active:bg-accent/15">
          <View className="h-12 w-12 items-center justify-center rounded-inner bg-accent">
            <Camera size={24} color={palette.accentInk} weight="fill" />
          </View>
          <Text className="mt-4 font-display text-xl text-warm-primary">Live Viewfinder</Text>
          <Text className="mt-1.5 font-sans text-xs leading-5 text-warm-secondary">
            Snap your plate directly with smart framing guidelines and automated focus.
          </Text>
          <View className="mt-4 flex-row items-center gap-1.5">
            <Text className="font-sans-bold text-xs text-accent">Launch Camera</Text>
            <ArrowRight size={14} color={palette.accent} weight="bold" />
          </View>
        </Pressable>

        {/* Photo Library Option */}
        <Pressable
          onPress={() => void pickFromGallery()}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel="Choose from photo library"
          className="mt-4 overflow-hidden rounded-card border border-subtle bg-surface p-6 active:bg-surface-raised">
          <View className="h-12 w-12 items-center justify-center rounded-inner bg-surface-raised">
            <Images size={24} color={palette.carbs} weight="duotone" />
          </View>
          <Text className="mt-4 font-display text-xl text-warm-primary">Photo Library</Text>
          <Text className="mt-1.5 font-sans text-xs leading-5 text-warm-secondary">
            Already took a photo of your breakfast, lunch, or dinner? Select it from your gallery.
          </Text>
          <View className="mt-4 flex-row items-center gap-1.5">
            <Text className="font-sans-bold text-xs text-warm-primary">Browse Photos</Text>
            <ArrowRight size={14} color={palette.textPrimary} weight="bold" />
          </View>
        </Pressable>

        {/* Photo Accuracy Tips */}
        <View className="mt-4 rounded-card border border-subtle bg-surface p-5">
          <Text className="font-sans-medium text-xs uppercase tracking-wider text-warm-tertiary">
            Pro Tips for Accuracy
          </Text>

          <View className="mt-3.5 gap-3">
            <TipItem
              icon={<SunDim size={16} color={palette.warning} weight="duotone" />}
              title="Even Lighting"
              desc="Natural or overhead light prevents deep shadows over your ingredients."
            />
            <TipItem
              icon={<Crop size={16} color={palette.accent} weight="duotone" />}
              title="Framing"
              desc="Capture the full plate or bowl so portions can be scaled correctly."
            />
            <TipItem
              icon={<Sparkle size={16} color={palette.positive} weight="duotone" />}
              title="Single Plate"
              desc="Keep one meal per photo for the most accurate nutrition breakdown."
            />
          </View>
        </View>
      </ScrollView>

      {isBusy ? (
        <View className="absolute inset-0 items-center justify-center gap-3 bg-black/75">
          <ActivityIndicator size="large" color={palette.accent} />
          <Text className="font-sans-medium text-sm text-warm-primary">Preparing photo…</Text>
        </View>
      ) : null}
    </View>
  );
}

function TipItem({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="mt-0.5">{icon}</View>
      <View className="flex-1">
        <Text className="font-sans-bold text-xs text-warm-primary">{title}</Text>
        <Text className="mt-0.5 font-sans text-xs leading-4 text-warm-secondary">{desc}</Text>
      </View>
    </View>
  );
}
