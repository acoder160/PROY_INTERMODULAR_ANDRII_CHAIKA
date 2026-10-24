import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  label: string;
  spinning?: boolean;
  iconOffsetY?: number;
  style?: StyleProp<ViewStyle>;
};

const SIZE = 56;
const ICON = 26;

export default function MapFab({ icon, onPress, label, spinning = false, iconOffsetY = 0, style }: Props) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!spinning) {
      rotation.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spinning, rotation]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.wrapper, style]}
    >
      <LinearGradient
        colors={['#1B5A86', '#123B5D', '#0A223B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.circle}
      >
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.sheen}
        />
        <Animated.View style={[styles.iconBox, { transform: [{ rotate: spin }] }]}>
          <Ionicons name={icon} size={ICON} color="#FFFFFF" style={[styles.glyph, iconOffsetY ? { top: -iconOffsetY } : null]} />
        </Animated.View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 32,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    zIndex: 10,
    shadowColor: '#66E3E7',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 9,
  },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(126, 232, 236, 0.55)',
    overflow: 'hidden',
  },
  iconBox: {
    width: ICON,
    height: ICON,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glyph: {
    width: ICON,
    height: ICON,
    lineHeight: ICON,
    textAlign: 'center',
    includeFontPadding: false,
  },
  sheen: {
    ...StyleSheet.absoluteFill,
    borderRadius: SIZE / 2,
  },
});
