import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/theme';

type Props = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  label: string;
  spinning?: boolean;
  style?: StyleProp<ViewStyle>;
};

const SIZE = 56;
const ICON = 26;

/** Floating map control: white rounded square, 2px ink outline, ink glyph. */
export default function MapFab({ icon, onPress, label, spinning = false, style }: Props) {
  const [rotation] = useState(() => new Animated.Value(0));

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
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: spinning }}
      style={[styles.fab, style]}
    >
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Ionicons name={icon} size={ICON} color={Palette.ink} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 32,
    width: SIZE,
    height: SIZE,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Palette.ink,
    backgroundColor: Palette.sheet,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});
