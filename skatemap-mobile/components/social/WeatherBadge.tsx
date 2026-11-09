import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import { DisplayFont, Palette } from '../../constants/theme';

type Condition = 'DRY' | 'WET' | 'RAIN';
interface Weather { condition: Condition; temperatureC: number | null }

const ICON: Record<Condition, React.ComponentProps<typeof Ionicons>['name']> = {
  DRY: 'sunny',
  WET: 'water',
  RAIN: 'rainy',
};

/** "Is it skateable right now?": dry / wet / raining at the spot. Hidden when the weather is unavailable. */
export default function WeatherBadge({ spotId }: { spotId: number }) {
  const { t } = useTranslation();
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/spots/${spotId}/weather`)
      .then((res) => { if (!cancelled) setWeather(res.data as Weather); })
      .catch(() => {}); // a 503 or no network: no badge is better than an error
    return () => { cancelled = true; };
  }, [spotId]);

  if (!weather || !ICON[weather.condition]) return null;
  const label = t(`weather.${weather.condition}`);
  const temp = weather.temperatureC == null ? '' : ` · ${Math.round(weather.temperatureC)}°`;
  return (
    <View
      style={[styles.badge, weather.condition === 'DRY' ? styles.dry : styles.wet]}
      accessible
      accessibilityLabel={`${t('weather.label')}: ${label}${temp}`}
    >
      <Ionicons name={ICON[weather.condition]} size={18} color={Palette.ink} />
      <Text style={styles.text}>{label}{temp}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Palette.ink,
  },
  dry: { backgroundColor: Palette.yellow },
  wet: { backgroundColor: Palette.white },
  text: { fontFamily: DisplayFont.bold, fontSize: 16, letterSpacing: 0.4, textTransform: 'uppercase', color: Palette.ink },
});
