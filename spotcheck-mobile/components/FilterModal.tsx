import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { DisplayFont, MIN_TARGET, Palette, Radius, spotTypePaint } from '../constants/theme';
import GradientFill from '../components/ui/GradientFill';
import { ChoicePill, PaintStrip } from './ui/PaintBits';
import { cleanLabel } from '../utils/text';

export interface FilterState {
  minRating: number;
  spotType: string;
  maxDistance: number; // en kilómetros (0 significa sin límite)
}

export const DEFAULT_FILTERS: FilterState = { minRating: 0, spotType: 'ALL', maxDistance: 0 };

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  /** Spots that match the current filters, shown on the apply button. */
  resultCount: number;
  /** Distance filtering needs the user's position. */
  hasLocation: boolean;
}

const TYPES = ['ALL', 'STREET', 'PARK', 'RAMPS', 'RAIL', 'LEDGE'];
const DISTANCES = [0, 1, 5, 10];
const RATINGS = [0, 3, 4];

export default function FilterModal({ visible, onClose, filters, setFilters, resultCount, hasLocation }: FilterModalProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isDefault =
    filters.spotType === DEFAULT_FILTERS.spotType &&
    filters.maxDistance === DEFAULT_FILTERS.maxDistance &&
    filters.minRating === DEFAULT_FILTERS.minRating;
  const count = new Intl.NumberFormat(i18n.language).format(resultCount);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">{t('filters.title')}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={cleanLabel(t('form.close'))}
            >
              <Ionicons name="close" size={22} color={Palette.white} />
            </TouchableOpacity>
          </View>
          <PaintStrip style={styles.strip} />

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle} accessibilityRole="header">{t('filters.spotType')}</Text>
            <View style={styles.pillRow}>
              {TYPES.map((type) => (
                <ChoicePill
                  key={type}
                  selected={filters.spotType === type}
                  onPress={() => setFilters({ ...filters, spotType: type })}
                  label={type === 'ALL' ? t('filters.all') : t(`types.${type}`)}
                  paint={type === 'ALL' ? undefined : spotTypePaint[type]}
                />
              ))}
            </View>

            <Text style={styles.sectionTitle} accessibilityRole="header">
              {hasLocation ? t('filters.maxDistance') : t('filters.maxDistanceGps')}
            </Text>
            <View style={styles.pillRow}>
              {DISTANCES.map((km) => (
                <ChoicePill
                  key={km}
                  selected={filters.maxDistance === km}
                  disabled={km > 0 && !hasLocation}
                  onPress={() => setFilters({ ...filters, maxDistance: km })}
                  label={km === 0 ? t('filters.anyDistance') : t('filters.under', { km })}
                />
              ))}
            </View>

            <Text style={styles.sectionTitle} accessibilityRole="header">{t('filters.minStars')}</Text>
            <View style={styles.pillRow}>
              {RATINGS.map((r) => {
                const selected = filters.minRating === r;
                return r === 0 ? (
                  <ChoicePill key={r} selected={selected} onPress={() => setFilters({ ...filters, minRating: 0 })} label={t('filters.allStars')} />
                ) : (
                  <ChoicePill
                    key={r}
                    selected={selected}
                    onPress={() => setFilters({ ...filters, minRating: r })}
                    accessibilityLabel={cleanLabel(t('filters.starsOrMore', { n: r }))}
                  >
                    <Text style={[styles.starText, selected && { color: Palette.white }]}>{r}+</Text>
                    <Ionicons name="star" size={16} color={selected ? Palette.white : Palette.ink} />
                  </ChoicePill>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => setFilters(DEFAULT_FILTERS)}
              disabled={isDefault}
              activeOpacity={0.8}
              style={[styles.resetBtn, isDefault && styles.resetBtnDisabled]}
              accessibilityRole="button"
              accessibilityState={{ disabled: isDefault }}
            >
              <Text style={styles.resetBtnText}>{t('filters.reset')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.8}
              style={styles.applyBtn}
              accessibilityRole="button"
              accessibilityLabel={`${t('filters.applyResults')}: ${count}`}
            >
              <GradientFill name="pink" radius={26} />
              <Text style={styles.applyBtnText} numberOfLines={1}>{t('filters.applyResults')}</Text>
              <View style={styles.countChip}>
                <Text style={styles.countChipText}>{count}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(28,28,28,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Palette.sheet,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: '88%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: {
    flexShrink: 1,
    fontFamily: DisplayFont.black,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Palette.ink,
  },
  closeBtn: {
    width: MIN_TARGET,
    height: MIN_TARGET,
    borderRadius: MIN_TARGET / 2,
    backgroundColor: Palette.asphalt,
    borderWidth: 2,
    borderColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strip: { marginTop: 12 },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 20 },

  sectionTitle: {
    fontFamily: DisplayFont.bold,
    fontSize: 18,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Palette.ink,
    marginTop: 22,
    marginBottom: 10,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  starText: { fontFamily: DisplayFont.bold, fontSize: 18, letterSpacing: 0.6, color: Palette.ink },

  footer: { flexDirection: 'row', gap: 10, marginTop: 12 },
  resetBtn: {
    minHeight: 56,
    paddingHorizontal: 18,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnDisabled: { opacity: 0.35 },
  resetBtnText: { fontFamily: DisplayFont.bold, fontSize: 18, letterSpacing: 0.6, textTransform: 'uppercase', color: Palette.ink },
  applyBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: Palette.pink,
    borderWidth: 2,
    borderColor: Palette.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  applyBtnText: {
    flexShrink: 1,
    fontFamily: DisplayFont.black,
    fontSize: 22,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Palette.ink,
  },
  countChip: {
    minWidth: 32,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: Palette.asphalt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countChipText: { fontFamily: DisplayFont.black, fontSize: 17, color: Palette.white },
});
