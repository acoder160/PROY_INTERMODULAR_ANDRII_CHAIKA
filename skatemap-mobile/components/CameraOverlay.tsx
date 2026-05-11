// skatemap-mobile/components/CameraOverlay.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraView } from 'expo-camera';

interface CameraOverlayProps {
  cameraRef: any;
  onCapture: () => void;
  onCancel: () => void;
}

export default function CameraOverlay({ cameraRef, onCapture, onCancel }: CameraOverlayProps) {
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>
      <CameraView style={{ flex: 1 }} ref={cameraRef} facing="back">
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraText}>Haz una foto del spot 🛹</Text>
          </View>
          <View style={styles.cameraFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureBtn} onPress={onCapture}>
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>
            <View style={{width: 60}} />
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'space-between' },
  cameraHeader: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 20, paddingTop: 60, alignItems: 'center' },
  cameraText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  cameraFooter: { backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 30, paddingBottom: 50 },
  captureBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  captureBtnInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'white' },
  cancelBtn: { padding: 10 },
  cancelBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});