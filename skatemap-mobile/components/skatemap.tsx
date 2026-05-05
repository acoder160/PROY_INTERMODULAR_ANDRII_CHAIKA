import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

export default function SkateMap() {
  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map}
        initialRegion={{
          latitude: 42.8125,
          longitude: -1.6458,
          latitudeDelta: 0.0422,
          longitudeDelta: 0.0221,
        }}
      >
        <Marker 
          coordinate={{ latitude: 42.8125, longitude: -1.6458 }}
          title="Centro de Pamplona"
          description="¡Aquí cargaremos los spots!"
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
});