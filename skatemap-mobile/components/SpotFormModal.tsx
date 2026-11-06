// skatemap-mobile/components/SpotFormModal.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DisplayFont, MIN_TARGET, Palette, Radius, spotTypePaint } from '../constants/theme';
import { ChoicePill, MarkGlyph, PaintStrip } from './ui/PaintBits';
import { cleanLabel } from '../utils/text';

interface SpotFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  formData: any;
  setFormData: (data: any) => void;
  capturedPhoto: string | null;
  isUploading: boolean;
  /** Save failure from the server or upload, shown inside the sheet. */
  errorMessage?: string | null;
}

const TYPES = ['STREET', 'PARK', 'RAMPS', 'RAIL', 'LEDGE'];
const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

export default function SpotFormModal({
  visible,
  onClose,
  onSave,
  formData,
  setFormData,
  capturedPhoto,
  isUploading,
  errorMessage
}: SpotFormModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const nameLabel = cleanLabel(t('form.name'));
  const descriptionLabel = cleanLabel(t('form.description'));
  const [showNameError, setShowNameError] = useState(false);
  const nameMissing = !formData.name?.trim();

  const handleSave = () => {
    if (nameMissing) {
      setShowNameError(true);
      return;
    }
    onSave();
  };

  // While the photo uploads, closing would orphan the request
  const handleClose = () => {
    if (isUploading) return;
    setShowNameError(false);
    onClose();
  };

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">{cleanLabel(t('form.newSpot'))}</Text>
            <TouchableOpacity
              onPress={handleClose}
              disabled={isUploading}
              style={[styles.closeBtn, isUploading && styles.closeBtnBusy]}
              accessibilityRole="button"
              accessibilityState={{ disabled: isUploading }}
              accessibilityLabel={cleanLabel(t('form.close'))}
            >
              <Ionicons name="close" size={22} color={Palette.white} />
            </TouchableOpacity>
          </View>
          <PaintStrip style={styles.strip} />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {capturedPhoto && (
              <View style={styles.photo}>
                <Image source={{ uri: capturedPhoto }} style={styles.photoImage} accessibilityIgnoresInvertColors />
                <View style={styles.photoTag}>
                  <Ionicons name="checkmark-circle" size={16} color={Palette.positive} />
                  <Text style={styles.photoTagText}>{cleanLabel(t('form.photoCaptured'))}</Text>
                </View>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label} nativeID="spot-name-label">{nameLabel}</Text>
              <TextInput
                style={[styles.input, showNameError && nameMissing && styles.inputError]}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                accessibilityLabel={nameLabel}
                accessibilityLabelledBy="spot-name-label"
                accessibilityHint={showNameError && nameMissing ? t('form.nameRequired') : undefined}
                maxLength={80}
                returnKeyType="next"
              />
              {showNameError && nameMissing && (
                <View style={styles.fieldError} accessibilityLiveRegion="polite">
                  <Ionicons name="alert-circle" size={18} color={Palette.danger} />
                  <Text style={styles.fieldErrorText}>{t('form.nameRequired')}</Text>
                </View>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label} nativeID="spot-description-label">{descriptionLabel}</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                multiline
                textAlignVertical="top"
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                maxLength={500}
                accessibilityLabel={descriptionLabel}
                accessibilityLabelledBy="spot-description-label"
              />
            </View>

            <View style={styles.field} accessibilityRole="radiogroup" accessibilityLabel={cleanLabel(t('form.type'))}>
              <Text style={styles.label}>{cleanLabel(t('form.type'))}</Text>
              <View style={styles.pillRow}>
                {TYPES.map((type) => (
                  <ChoicePill
                    key={type}
                    selected={formData.spotType === type}
                    onPress={() => setFormData({ ...formData, spotType: type })}
                    label={t(`types.${type}`, { defaultValue: type })}
                    paint={spotTypePaint[type]}
                  />
                ))}
              </View>
            </View>

            <View style={styles.field} accessibilityRole="radiogroup" accessibilityLabel={cleanLabel(t('form.level'))}>
              <Text style={styles.label}>{cleanLabel(t('form.level'))}</Text>
              <View style={styles.pillRow}>
                {LEVELS.map((level) => {
                  const selected = formData.difficultyLevel === level;
                  return (
                    <ChoicePill
                      key={level}
                      selected={selected}
                      onPress={() => setFormData({ ...formData, difficultyLevel: level })}
                      label={t(`difficulty.${level}`, { defaultValue: level })}
                    >
                      <MarkGlyph level={level} color={selected ? Palette.white : Palette.ink} />
                    </ChoicePill>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            {!!errorMessage && !isUploading && (
              <View style={styles.errorBox} accessibilityLiveRegion="assertive">
                <Ionicons name="alert-circle" size={20} color={Palette.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.saveBtn, isUploading && styles.saveBtnBusy]}
              onPress={handleSave}
              disabled={isUploading}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ busy: isUploading, disabled: isUploading }}
            >
              {isUploading ? (
                <ActivityIndicator color={Palette.ink} />
              ) : (
                <Text style={styles.saveBtnText}>{cleanLabel(t('form.save'))}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: '92%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20 },
  title: {
    flexShrink: 1,
    fontFamily: DisplayFont.black,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Palette.ink,
  },
  closeBtnBusy: { opacity: 0.5 },
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
  strip: { marginTop: 12, marginHorizontal: 20 },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 20 },

  photo: { height: 160, borderRadius: Radius.card, overflow: 'hidden', borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.concrete },
  photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoTag: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: Palette.sheet,
    borderWidth: 2,
    borderColor: Palette.ink,
  },
  photoTagText: { fontSize: 14, fontWeight: '700', color: Palette.ink },

  field: { gap: 8 },
  label: { fontFamily: DisplayFont.bold, fontSize: 18, letterSpacing: 0.6, textTransform: 'uppercase', color: Palette.ink },
  input: {
    minHeight: MIN_TARGET,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.input,
    borderWidth: 2,
    borderColor: Palette.ink,
    backgroundColor: Palette.sheet,
    fontSize: 16,
    color: Palette.ink,
  },
  inputError: { borderColor: Palette.danger },
  fieldError: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldErrorText: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: Palette.danger },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, marginBottom: 12, backgroundColor: '#FCE8E6' },
  errorText: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: Palette.danger },
  inputMultiline: { minHeight: 96, maxHeight: 160 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: Palette.hairline },
  saveBtn: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: Palette.pink,
    borderWidth: 2,
    borderColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  saveBtnBusy: { opacity: 0.7 },
  saveBtnText: { fontFamily: DisplayFont.black, fontSize: 24, letterSpacing: 1, textTransform: 'uppercase', color: Palette.ink },
});
