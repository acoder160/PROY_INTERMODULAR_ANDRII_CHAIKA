// skatemap-mobile/components/SpotFormModal.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';

interface SpotFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  formData: any;
  setFormData: (data: any) => void;
  capturedPhoto: string | null;
  isUploading: boolean;
}

export default function SpotFormModal({
  visible,
  onClose,
  onSave,
  formData,
  setFormData,
  capturedPhoto,
  isUploading
}: SpotFormModalProps) {
  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '90%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nuevo Spot 📍</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButtonText}>✕ Cancelar</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            
            {capturedPhoto && (
              <View style={styles.previewContainer}>
                  <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />
                  <Text style={styles.previewText}>Foto capturada ✔️</Text>
              </View>
            )}

            <TextInput style={styles.input} placeholder="Nombre" value={formData.name} onChangeText={(text) => setFormData({...formData, name: text})} />
            <TextInput style={[styles.input, {height: 80}]} placeholder="Descripción..." multiline value={formData.description} onChangeText={(text) => setFormData({...formData, description: text})} />
            
            <View style={styles.selectRow}>
              <View style={styles.pickerBox}>
                <Text style={styles.pickerLabel}>Tipo</Text>
                <TouchableOpacity style={styles.pickerButton} onPress={() => setFormData({...formData, spotType: formData.spotType === 'STREET' ? 'PARK' : formData.spotType === 'PARK' ? 'RAIL' : formData.spotType === 'RAIL' ? 'LEDGE' : formData.spotType === 'LEDGE' ? 'RAMPS' : 'STREET'})}>
                  <Text>{formData.spotType}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.pickerBox}>
                <Text style={styles.pickerLabel}>Nivel</Text>
                <TouchableOpacity style={styles.pickerButton} onPress={() => setFormData({...formData, difficultyLevel: formData.difficultyLevel === 'BEGINNER' ? 'INTERMEDIATE' : formData.difficultyLevel === 'INTERMEDIATE' ? 'ADVANCED' : 'BEGINNER'})}>
                  <Text>{formData.difficultyLevel}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={[styles.saveButton, isUploading && { opacity: 0.7 }]} onPress={onSave} disabled={isUploading}>
              {isUploading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.saveButtonText}>Guardar Spot</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Estos son SOLO los estilos que necesita el modal
const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: '85%', borderRadius: 20, overflow: 'hidden', paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  closeButtonText: { fontSize: 14, fontWeight: 'bold', color: '#ff6b6b' },
  formContainer: { padding: 20, gap: 15 },
  previewContainer: { width: '100%', height: 120, borderRadius: 12, overflow: 'hidden', marginBottom: 5, position: 'relative' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  previewText: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: 4, borderRadius: 5, fontSize: 10 },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, color: '#333' },
  selectRow: { flexDirection: 'row', gap: 15 },
  pickerBox: { flex: 1 },
  pickerLabel: { fontSize: 12, color: '#666', marginBottom: 5, fontWeight: 'bold' },
  pickerButton: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, alignItems: 'center' },
  saveButton: { backgroundColor: '#2ed573', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});