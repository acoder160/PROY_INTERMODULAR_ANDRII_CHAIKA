import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';

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
  
  // Opciones disponibles
  const types = ['ALL', 'STREET', 'PARK', 'RAMPS', 'RAIL', 'LEDGE'];
  const distances = [{ label: 'Cualquiera', val: 0 }, { label: '< 1 km', val: 1 }, { label: '< 5 km', val: 5 }, { label: '< 10 km', val: 10 }];
  const ratings = [0, 1, 2, 3, 4, 5];

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          
          <View style={styles.header}>
            <Text style={styles.title}>⚙️ Filtrar Spots</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll}>
            
            {/* TIPO DE SPOT */}
            <Text style={styles.sectionTitle}>Tipo de Spot</Text>
            <View style={styles.pillContainer}>
              {types.map(type => (
                <TouchableOpacity 
                  key={type} 
                  style={[styles.pill, filters.spotType === type && styles.pillActive]}
                  onPress={() => setFilters({ ...filters, spotType: type })}
                >
                  <Text style={[styles.pillText, filters.spotType === type && styles.pillTextActive]}>
                    {type === 'ALL' ? 'Todos' : type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* DISTANCIA */}
            <Text style={styles.sectionTitle}>Distancia Máxima (GPS)</Text>
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
            <Text style={styles.sectionTitle}>Estrellas Mínimas</Text>
            <View style={styles.pillContainer}>
              {ratings.map(r => (
                <TouchableOpacity 
                  key={r} 
                  style={[styles.pill, filters.minRating === r && styles.pillActive]}
                  onPress={() => setFilters({ ...filters, minRating: r })}
                >
                  <Text style={[styles.pillText, filters.minRating === r && styles.pillTextActive]}>
                    {r === 0 ? 'Todas' : `${r} ⭐️ o +`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

          </ScrollView>

          <TouchableOpacity style={styles.applyBtn} onPress={onClose}>
            <Text style={styles.applyBtnText}>Ver Resultados</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1A1A1A' },
  closeBtn: { fontSize: 22, color: '#666', padding: 5 },
  scroll: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10, marginTop: 10 },
  pillContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd' },
  pillActive: { backgroundColor: '#2EC4B6', borderColor: '#2EC4B6' },
  pillText: { color: '#666', fontWeight: '600' },
  pillTextActive: { color: 'white' },
  applyBtn: { backgroundColor: '#1A1A1A', padding: 15, borderRadius: 10, alignItems: 'center' },
  applyBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});