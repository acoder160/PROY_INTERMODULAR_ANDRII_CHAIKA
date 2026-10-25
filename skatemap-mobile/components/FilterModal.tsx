import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, getLanguagePreference, setLanguagePreference } from '../i18n';

interface FilterState {
  minRating: number;
  spotType: string;
  maxDistance: number; // en kilómetros (0 significa sin límite)
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
}

export default function FilterModal({ visible, onClose, filters, setFilters }: FilterModalProps) {
  const { t } = useTranslation();
  const [showLanguages, setShowLanguages] = useState(false);
  const languagePreference = getLanguagePreference(); // null = automático (idioma del teléfono)
  const currentLanguageName = languagePreference
    ? SUPPORTED_LANGUAGES.find((language) => language.code === languagePreference)?.name
    : t('common.languageAuto');
  
  // Opciones disponibles
  const types = ['ALL', 'STREET', 'PARK', 'RAMPS', 'RAIL', 'LEDGE'];
  const distances = [{ label: t('filters.anyDistance'), val: 0 }, ...[1, 5, 10].map(km => ({ label: t('filters.under', { km }), val: km }))];
  const ratings = [0, 1, 2, 3, 4, 5];

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          
          <View style={styles.header}>
            <Text style={styles.title}>⚙️ {t('filters.title')}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll}>

            {/* IDIOMA */}
            <TouchableOpacity style={styles.languageRow} onPress={() => setShowLanguages(!showLanguages)} activeOpacity={0.8}>
              <Text style={styles.languageRowText}>🌐 {t('common.language')}: {currentLanguageName}</Text>
              <Text style={styles.languageChevron}>{showLanguages ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showLanguages && (
              <View style={[styles.pillContainer, { marginBottom: 6 }]}>
                <TouchableOpacity
                  style={[styles.pill, languagePreference === null && styles.pillActive]}
                  onPress={() => setLanguagePreference(null)}
                >
                  <Text style={[styles.pillText, languagePreference === null && styles.pillTextActive]}>{t('common.languageAuto')}</Text>
                </TouchableOpacity>
                {SUPPORTED_LANGUAGES.map((language) => (
                  <TouchableOpacity
                    key={language.code}
                    style={[styles.pill, languagePreference === language.code && styles.pillActive]}
                    onPress={() => setLanguagePreference(language.code)}
                  >
                    <Text style={[styles.pillText, languagePreference === language.code && styles.pillTextActive]}>{language.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* TIPO DE SPOT */}
            <Text style={styles.sectionTitle}>{t('filters.spotType')}</Text>
            <View style={styles.pillContainer}>
              {types.map(type => (
                <TouchableOpacity 
                  key={type} 
                  style={[styles.pill, filters.spotType === type && styles.pillActive]}
                  onPress={() => setFilters({ ...filters, spotType: type })}
                >
                  <Text style={[styles.pillText, filters.spotType === type && styles.pillTextActive]}>
                    {type === 'ALL' ? t('filters.all') : t(`types.${type}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* DISTANCIA */}
            <Text style={styles.sectionTitle}>{t('filters.maxDistance')}</Text>
            <View style={styles.pillContainer}>
              {distances.map(d => (
                <TouchableOpacity 
                  key={d.val} 
                  style={[styles.pill, filters.maxDistance === d.val && styles.pillActive]}
                  onPress={() => setFilters({ ...filters, maxDistance: d.val })}
                >
                  <Text style={[styles.pillText, filters.maxDistance === d.val && styles.pillTextActive]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* VALORACIÓN */}
            <Text style={styles.sectionTitle}>{t('filters.minStars')}</Text>
            <View style={styles.pillContainer}>
              {ratings.map(r => (
                <TouchableOpacity 
                  key={r} 
                  style={[styles.pill, filters.minRating === r && styles.pillActive]}
                  onPress={() => setFilters({ ...filters, minRating: r })}
                >
                  <Text style={[styles.pillText, filters.minRating === r && styles.pillTextActive]}>
                    {r === 0 ? t('filters.allStars') : t('filters.starsOrMore', { n: r })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

          </ScrollView>

          <TouchableOpacity onPress={onClose} activeOpacity={0.88}>
            <LinearGradient colors={['#2EC4B6', '#168AAD']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.applyBtn}>
              <Text style={styles.applyBtnText}>{t('filters.applyResults')}</Text>
            </LinearGradient>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(3, 14, 25, 0.68)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0B243B', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '80%', borderWidth: 1, borderColor: 'rgba(126, 232, 236, 0.18)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '800', color: '#F5FEFF' },
  closeBtn: { fontSize: 22, color: '#9DC1CD', padding: 5 },
  languageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginBottom: 10, backgroundColor: 'rgba(4, 20, 35, 0.62)', borderWidth: 1, borderColor: 'rgba(126, 195, 211, 0.25)' },
  languageRowText: { flex: 1, color: '#D5E8EE', fontWeight: '700', fontSize: 14 },
  languageChevron: { color: '#9DC1CD', fontSize: 12, marginLeft: 8 },
  scroll: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#D5E8EE', marginBottom: 10, marginTop: 10 },
  pillContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, backgroundColor: 'rgba(4, 20, 35, 0.62)', borderWidth: 1, borderColor: 'rgba(126, 195, 211, 0.25)' },
  pillActive: { backgroundColor: '#168AAD', borderColor: '#66E3E7' },
  pillText: { color: '#A9C5D2', fontWeight: '600' },
  pillTextActive: { color: 'white' },
  applyBtn: { padding: 15, borderRadius: 13, alignItems: 'center', shadowColor: '#168AAD', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.32, shadowRadius: 10, elevation: 5 },
  applyBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});