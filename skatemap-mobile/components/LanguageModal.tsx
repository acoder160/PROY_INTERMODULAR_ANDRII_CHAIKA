import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, getLanguagePreference, setLanguagePreference } from '../i18n';
import { DisplayFont, MIN_TARGET, Palette, Radius } from '../constants/theme';
import { ChoicePill, PaintStrip } from './ui/PaintBits';
import { cleanLabel } from '../utils/text';

/** Language picker, reached from the globe button in the map's top bar. Picking applies and closes. */
export default function LanguageModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const preference = getLanguagePreference(); // null = automático (idioma del teléfono)

  const choose = (code: string | null) => {
    setLanguagePreference(code).finally(onClose);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">{t('common.language')}</Text>
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

          <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            <ChoicePill
              selected={preference === null}
              onPress={() => choose(null)}
              label={t('common.languageAuto')}
              display={false}
            />
            {SUPPORTED_LANGUAGES.map((language) => (
              <ChoicePill
                key={language.code}
                selected={preference === language.code}
                onPress={() => choose(language.code)}
                label={language.name}
                display={false}
              />
            ))}
          </ScrollView>
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
    maxHeight: '80%',
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
  scroll: { flexGrow: 0, marginTop: 16 },
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
