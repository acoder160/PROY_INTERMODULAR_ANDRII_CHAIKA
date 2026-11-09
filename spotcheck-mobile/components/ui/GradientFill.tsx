import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gradients, type GradientName } from '../../constants/theme';

/**
 * Quiet Tone background: drop it as the first child of a view to lay a soft vertical
 * gradient under its content. Pass the parent's radius (the fill does not clip to it).
 */
export default function GradientFill({ name, radius = 0, diagonal = false }: { name: GradientName; radius?: number; diagonal?: boolean }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={Gradients[name] as unknown as [string, string]}
      start={diagonal ? { x: 0, y: 0 } : { x: 0.5, y: 0 }}
      end={diagonal ? { x: 1, y: 1 } : { x: 0.5, y: name === 'authScreen' ? 0.6 : 1 }}
      style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
    />
  );
}
