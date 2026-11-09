import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { DisplayFont, MIN_TARGET, Palette } from '../../constants/theme';
import GradientFill from '../ui/GradientFill';

/** Asphalt header of the social screens; {@code back} adds a back button (stack screens). */
export default function ScreenBar({ title, back = false, right }: { title: string; back?: boolean; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      <GradientFill name="topBar" />
      {back && (
        <TouchableOpacity style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.navigate('/(tabs)'))}
                          accessibilityRole="button" accessibilityLabel={t('admin.backToMap')}>
          <Ionicons name="chevron-back" size={24} color={Palette.white} />
        </TouchableOpacity>
      )}
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: Palette.asphalt },
  back: { width: MIN_TARGET, height: MIN_TARGET, borderRadius: MIN_TARGET / 2, borderWidth: 2, borderColor: Palette.white, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: Palette.white, fontFamily: DisplayFont.black, fontSize: 30, letterSpacing: 0.4, textTransform: 'uppercase' },
});
