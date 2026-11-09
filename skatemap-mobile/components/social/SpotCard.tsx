import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DisplayFont, Palette, Radius } from '../../constants/theme';
import { TypeChip } from '../ui/PaintBits';
import type { SpotSummary } from '../../utils/social';

/** Opens a spot on the map tab: the map flies there and shows its details. */
export function openSpotOnMap(router: ReturnType<typeof useRouter>, spotId: number) {
  router.navigate({ pathname: '/(tabs)', params: { spot: String(spotId) } } as any);
}

/** Small spot card for profiles, the feed and saved spots. */
export default function SpotCard({ spot }: { spot: SpotSummary | null | undefined }) {
  const { t } = useTranslation();
  const router = useRouter();
  if (!spot) return null;
  const type = (spot.spotType || 'STREET').toUpperCase();
  const thumb = spot.mediaUrl?.includes('/image/upload/')
    ? spot.mediaUrl.replace('/image/upload/', '/image/upload/c_fill,w_240,h_180,q_auto/')
    : spot.mediaUrl;
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => openSpotOnMap(router, spot.id)}
      accessibilityRole="button"
      accessibilityLabel={spot.name}
    >
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.img} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.img, styles.empty]}>
          <Ionicons name="camera-outline" size={22} color={Palette.inkMuted} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{spot.name || t('webview.unnamed')}</Text>
        <TypeChip type={type} label={t(`types.${type}`, { defaultValue: type })} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderWidth: 2, borderColor: Palette.ink, borderRadius: Radius.card, backgroundColor: Palette.sheet },
  img: { width: 96, height: 72, borderRadius: 10, backgroundColor: Palette.concrete },
  empty: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 6, alignItems: 'flex-start' },
  name: { fontFamily: DisplayFont.bold, fontSize: 20, color: Palette.ink, textTransform: 'uppercase' },
});
