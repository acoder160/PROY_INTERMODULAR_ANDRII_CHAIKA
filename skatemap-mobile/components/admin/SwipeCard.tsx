import React from 'react';
import { StyleSheet, Text, useWindowDimensions, type ViewStyle, type StyleProp } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { DisplayFont, Palette } from '../../constants/theme';

export type SwipeDirection = 'right' | 'left' | 'up' | 'down';

// Codes used inside worklets (strings would work too, numbers keep the comparisons cheap)
const NONE = 0;
const RIGHT = 1;
const LEFT = 2;
const UP = 3;
const DOWN = 4;
const NAMES: Record<number, SwipeDirection> = { [RIGHT]: 'right', [LEFT]: 'left', [UP]: 'up', [DOWN]: 'down' };

interface SwipeCardProps {
  /** right = keep, left = remove, up = comments (the card springs back), down = skip. */
  onSwipe: (direction: SwipeDirection) => void;
  labels: Record<SwipeDirection, string>;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Tinder-style moderation card. Mount it with key={spot.id}: every spot gets a fresh card at rest.
 * Stamps fade in as the card moves; crossing a threshold gives a light haptic tick.
 */
export default function SwipeCard({ onSwipe, labels, style, children }: SwipeCardProps) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const armed = useSharedValue(NONE);

  const thresholdX = Math.min(140, width * 0.28);
  const thresholdY = 110;

  const tick = () => {
    Haptics.selectionAsync().catch(() => {});
  };
  const finish = (code: number) => onSwipe(NAMES[code]);

  const pan = usePanGesture({
    minDistance: 8,
    onUpdate: (e) => {
      'worklet';
      x.value = e.translationX;
      y.value = e.translationY;
      let code = NONE;
      if (Math.abs(e.translationX) >= Math.abs(e.translationY)) {
        if (e.translationX > thresholdX) code = RIGHT;
        else if (e.translationX < -thresholdX) code = LEFT;
      } else if (e.translationY < -thresholdY) code = UP;
      else if (e.translationY > thresholdY) code = DOWN;
      if (code !== armed.value) {
        armed.value = code;
        if (code !== NONE) scheduleOnRN(tick);
      }
    },
    onDeactivate: (e) => {
      'worklet';
      // A quick flick counts even if the finger did not travel far
      let code = armed.value;
      if (code === NONE) {
        if (Math.abs(e.velocityX) > 900 && Math.abs(e.velocityX) > Math.abs(e.velocityY)) code = e.velocityX > 0 ? RIGHT : LEFT;
        else if (Math.abs(e.velocityY) > 900) code = e.velocityY < 0 ? UP : DOWN;
      }
      armed.value = NONE;

      if (code === RIGHT || code === LEFT || code === DOWN) {
        if (reduceMotion) {
          scheduleOnRN(finish, code);
          return;
        }
        const toX = code === RIGHT ? width * 1.4 : code === LEFT ? -width * 1.4 : x.value;
        const toY = code === DOWN ? height : y.value;
        x.value = withTiming(toX, { duration: 220 });
        y.value = withTiming(toY, { duration: 220 }, () => {
          scheduleOnRN(finish, code);
        });
        return;
      }
      // Up opens the comments: the card goes back to rest
      x.value = withSpring(0, { damping: 18, stiffness: 220 });
      y.value = withSpring(0, { damping: 18, stiffness: 220 });
      if (code === UP) scheduleOnRN(finish, code);
    },
  });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${interpolate(x.value, [-width, 0, width], [-12, 0, 12], Extrapolation.CLAMP)}deg` },
    ],
  }));
  const keepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [thresholdX * 0.3, thresholdX], [0, 1], Extrapolation.CLAMP),
  }));
  const removeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-thresholdX, -thresholdX * 0.3], [1, 0], Extrapolation.CLAMP),
  }));
  const upStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [-thresholdY, -thresholdY * 0.3], [1, 0], Extrapolation.CLAMP),
  }));
  const downStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [thresholdY * 0.3, thresholdY], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.card, style, cardStyle]}
        accessible
        accessibilityActions={[
          { name: 'keep', label: labels.right },
          { name: 'remove', label: labels.left },
          { name: 'comments', label: labels.up },
          { name: 'skip', label: labels.down },
        ]}
        onAccessibilityAction={(event) => {
          const map: Record<string, SwipeDirection> = { keep: 'right', remove: 'left', comments: 'up', skip: 'down' };
          const direction = map[event.nativeEvent.actionName];
          if (direction) onSwipe(direction);
        }}
      >
        {children}
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampKeep, keepStyle]}>
          <Text style={[styles.stampText, { color: Palette.positive }]}>{labels.right}</Text>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampRemove, removeStyle]}>
          <Text style={[styles.stampText, { color: Palette.danger }]}>{labels.left}</Text>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampUp, upStyle]}>
          <Text style={styles.stampText}>{labels.up}</Text>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampDown, downStyle]}>
          <Text style={styles.stampText}>{labels.down}</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.sheet,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Palette.ink,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  stamp: {
    position: 'absolute',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  stampKeep: { top: 24, left: 20, borderColor: Palette.positive, transform: [{ rotate: '-12deg' }] },
  stampRemove: { top: 24, right: 20, borderColor: Palette.danger, transform: [{ rotate: '12deg' }] },
  stampUp: { bottom: 28, alignSelf: 'center', borderColor: Palette.ink },
  stampDown: { top: 24, alignSelf: 'center', borderColor: Palette.ink },
  stampText: {
    fontFamily: DisplayFont.black,
    fontSize: 30,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Palette.ink,
  },
});
