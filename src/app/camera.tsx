import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useIsFocused, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Camera,
  CameraRotate,
  CameraSlash,
  Images,
} from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScanReticle } from '@/components/camera/ScanReticle';
import { RingSpinner, ShutterButton } from '@/components/camera/ShutterButton';
import { PressableScale } from '@/components/motion/PressableScale';
import { showAlert } from '@/services/alert';
import { hapticLight } from '@/services/haptics';
import { bottomInset, topInset } from '@/services/layout';
import { useNutritionStore } from '@/store/nutrition-store';
import { palette } from '@/theme/tokens';

/**
 * Full-screen camera viewfinder — Warm Editorial capture interface.
 */
export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [isBusy, setIsBusy] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const setPendingImage = useNutritionStore((s) => s.setPendingImage);

  useEffect(() => {
    if (!isFocused) setIsReady(false);
  }, [isFocused]);

  function toggleFacing() {
    hapticLight();
    setFacing((previous) => (previous === 'back' ? 'front' : 'back'));
  }

  function goToResults(uri: string) {
    const analysisId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setPendingImage({ uri, mimeType: 'image/jpeg', analysisId });
    router.replace({ pathname: '/results', params: { id: analysisId } });
  }

  async function takePhoto() {
    if (isBusy || !cameraRef.current || !isReady) return;
    setIsBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, exif: false });
      if (!photo?.uri) {
        throw new Error('The camera did not return a photo.');
      }
      goToResults(photo.uri);
    } catch (error) {
      setIsBusy(false);
      showAlert('Capture error', error instanceof Error ? error.message : String(error));
    }
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
      showAlert('Gallery error', error instanceof Error ? error.message : String(error));
    }
  }

  if (!permission) {
    return <View className="flex-1 bg-black" />;
  }

  if (!permission.granted) {
    return (
      <View
        className="flex-1 items-center justify-center bg-canvas px-8"
        style={{ paddingTop: topInset(insets), paddingBottom: bottomInset(insets) }}>
        <View className="h-20 w-20 items-center justify-center rounded-2xl bg-surface-raised">
          <CameraSlash size={36} color={palette.textTertiary} weight="duotone" />
        </View>
        <Text className="mt-6 text-center font-display text-2xl text-warm-primary">
          Camera Access Required
        </Text>
        <Text className="mt-2 text-center font-sans text-xs leading-5 text-warm-secondary">
          SnapPlate uses the camera to identify food on your plate and calculate nutritional breakdown.
        </Text>
        <Pressable
          onPress={requestPermission}
          className="mt-8 h-15 items-center justify-center rounded-inner bg-accent px-8 active:bg-accent-light">
          <Text className="font-sans-bold text-sm text-accent-ink">Grant Camera Permission</Text>
        </Pressable>
        <Pressable onPress={() => void pickFromGallery()} className="mt-4">
          <Text className="font-sans-medium text-xs text-accent">Or choose from Photo Library</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {isFocused ? (
        <View className="flex-1">
          <CameraView
            ref={cameraRef}
            facing={facing}
            style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}
            onCameraReady={() => setIsReady(true)}
            onMountError={(event) =>
              showAlert('Camera error', event.message ?? 'Could not start the camera.')
            }
          />

          <View
            className="flex-1 justify-between"
            style={{ paddingTop: topInset(insets) + 10, paddingBottom: bottomInset(insets) + 24 }}>
            {/* Top Bar */}
            <View className="flex-row items-center justify-between px-5">
              <Pressable
                onPress={() => {
                  hapticLight();
                  router.back();
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Back to scan options"
                className="h-11 w-11 items-center justify-center rounded-full bg-black/60 active:bg-black/80">
                <ArrowLeft size={20} color="#fff" weight="bold" />
              </Pressable>

              <View className="flex-row items-center gap-2 rounded-pill bg-black/60 px-4 py-2">
                <Camera size={15} color={palette.accent} weight="fill" />
                <Text className="font-sans-bold text-xs text-white">Live Viewfinder</Text>
              </View>

              <View className="h-11 w-11" />
            </View>

            {/* Framing Guide */}
            <View className="items-center">
              {isReady ? (
                <>
                  <ScanReticle size={260} isScanning={!isBusy} />
                  <Text className="mt-5 px-10 text-center font-sans text-xs text-white/90">
                    Center the plate within the guides
                  </Text>
                </>
              ) : (
                <View className="items-center gap-3">
                  <ActivityIndicator size="small" color={palette.accent} />
                  <Text className="font-sans text-xs text-white/70">Starting camera…</Text>
                </View>
              )}
            </View>

            {/* Bottom Shutter & Controls */}
            <View className="flex-row items-center justify-around px-8">
              <ControlButton
                icon={<Images size={22} color="#fff" weight="duotone" />}
                label="Library"
                onPress={() => void pickFromGallery()}
              />

              <ShutterButton
                onPress={() => void takePhoto()}
                disabled={!isReady}
                isBusy={isBusy}
              />

              <ControlButton
                icon={<CameraRotate size={22} color="#fff" weight="duotone" />}
                label="Flip"
                onPress={toggleFacing}
              />
            </View>
          </View>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center gap-3 bg-black">
          <Camera size={30} color={palette.textTertiary} weight="duotone" />
          <Text className="font-sans text-xs text-warm-tertiary">Camera paused</Text>
        </View>
      )}

      {isBusy ? (
        <View className="absolute inset-0 z-10 items-center justify-center gap-4 bg-black/80">
          <RingSpinner size={44} color={palette.accent} />
          <Text className="font-sans-medium text-sm text-white">Preparing photo…</Text>
        </View>
      ) : null}
    </View>
  );
}

function ControlButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="items-center justify-center rounded-inner bg-black/60 px-4 py-3 active:bg-black/80">
      {icon}
      <Text className="mt-1 font-sans-medium text-[11px] text-white/80">{label}</Text>
    </PressableScale>
  );
}
