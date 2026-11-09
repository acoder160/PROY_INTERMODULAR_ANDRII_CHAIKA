import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { Palette } from '../constants/theme';
import ScreenBar from '../components/social/ScreenBar';
import SpotCard from '../components/social/SpotCard';

export default function SavedScreen() {
  const { t } = useTranslation();
  const [spots, setSpots] = useState<any[] | null>(null);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    api.get('/favorites/spots')
      .then((res) => { if (!cancelled) setSpots(res.data); })
      .catch(() => { if (!cancelled) setSpots([]); });
    return () => { cancelled = true; };
  }, []));

  return (
    <View style={styles.screen}>
      <ScreenBar title={t('social.savedSpots')} back />
      <FlatList
        data={spots ?? []}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <SpotCard spot={item} />}
        ListEmptyComponent={spots === null
          ? <ActivityIndicator color={Palette.ink} style={{ marginTop: 24 }} />
          : <Text style={styles.empty}>{t('social.savedEmpty')}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.concrete },
  list: { padding: 16, gap: 10, paddingBottom: 32 },
  empty: { color: Palette.inkMuted, fontSize: 16, textAlign: 'center', marginTop: 32, paddingHorizontal: 16 },
});
