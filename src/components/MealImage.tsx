import { Image, type ImageContentFit, type ImageStyle } from 'expo-image';
import { useEffect, useState } from 'react';
import { View, type StyleProp, StyleSheet } from 'react-native';
import { ForkKnife } from 'phosphor-react-native';

import { palette } from '@/theme/tokens';

type MealImageProps = {
  uri?: string | null;
  fallbackUri?: string | null;
  className?: string;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  transition?: number;
  showPlaceholder?: boolean;
  placeholderSize?: number;
};

/** Displays a private Storage image and falls back to the selected local photo, or a warm placeholder. */
export function MealImage({
  uri,
  fallbackUri,
  className,
  style,
  contentFit = 'cover',
  transition = 200,
  showPlaceholder = true,
  placeholderSize = 26,
}: MealImageProps) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const canFallback = !!uri && !!fallbackUri && uri !== fallbackUri;
  const activeUri = canFallback && remoteFailed ? fallbackUri : (uri ?? fallbackUri ?? undefined);

  useEffect(() => setRemoteFailed(false), [uri, fallbackUri]);

  if (!activeUri || (remoteFailed && !canFallback)) {
    if (!showPlaceholder) return null;
    return (
      <View
        className={`items-center justify-center bg-surface-sunken ${className ?? ''}`}
        style={[{ width: '100%', height: '100%' }, style as any]}>
        <ForkKnife size={placeholderSize} color={palette.textTertiary} weight="duotone" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: activeUri }}
      className={className}
      style={[{ width: '100%', height: '100%' }, style]}
      contentFit={contentFit}
      transition={transition}
      onError={() => {
        if (canFallback) setRemoteFailed(true);
      }}
    />
  );
}
