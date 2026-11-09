// spotcheck-mobile/components/CameraOverlay.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraView } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { Palette, DisplayFont, MIN_TARGET } from '../constants/theme';

interface CameraOverlayProps {
  cameraRef: any;
  onCapture: () => void;
  onCancel: () => void;
}

export default function CameraOverlay({ cameraRef, onCapture, onCancel }: CameraOverlayProps) {
  const { t } = useTranslation();
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>
      <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} facing="back" />
      <View style={styles.cameraOverlay}>
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraText}>{t('camera.takePhoto')}</Text>
          </View>
          <View style={styles.cameraFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} accessibilityRole="button">
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureBtn} onPress={onCapture} accessibilityRole="button" accessibilityLabel={t('camera.takePhoto')}>
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>
            <View style={{width: 60}} />
          </View>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent', justifyContent: 'space-between' },
  cameraHeader: { backgroundColor: Palette.asphalt, padding: 16, paddingTop: 56, alignItems: 'center' },
  cameraText: { color: Palette.white, fontFamily: DisplayFont.black, fontSize: 26, letterSpacing: 0.8, textTransform: 'uppercase', textAlign: 'center' },
  cameraFooter: { backgroundColor: Palette.asphalt, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  captureBtn: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: Palette.white, justifyContent: 'center', alignItems: 'center' },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: Palette.pink },
  cancelBtn: { minWidth: 76, minHeight: MIN_TARGET, justifyContent: 'center' },
  cancelBtnText: { color: Palette.white, fontFamily: DisplayFont.bold, fontSize: 20, letterSpacing: 0.8, textTransform: 'uppercase' }
});
