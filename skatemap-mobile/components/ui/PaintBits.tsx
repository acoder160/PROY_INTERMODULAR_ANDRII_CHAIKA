import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { DisplayFont, MIN_TARGET, Palette, Radius, spotTypePaint } from '../../constants/theme';

/** Paint-filled spot type chip with an uppercase label. */
export function TypeChip({ type, label }: { type: string; label: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: spotTypePaint[type] ?? Palette.white }]}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const DIFFICULTY_LEVEL: Record<string, number> = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3 };

/** The 1-3 slanted marks alone, in any ink (white inside a selected pill). */
export function MarkGlyph({ level, color = Palette.ink }: { level: string; color?: string }) {
  const active = DIFFICULTY_LEVEL[level] ?? 2;
  return (
    <View style={styles.marks}>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={[styles.mark, i <= active ? { backgroundColor: color } : { borderWidth: 1.5, borderColor: color }]}
        />
      ))}
    </View>
  );
}

/** 1-3 slanted marks plus a text label; difficulty is never carried by colour. */
export function DifficultyMarks({ level, label }: { level: string; label: string }) {
  return (
    <View style={styles.diff} accessible accessibilityLabel={label}>
      <MarkGlyph level={level} />
      <Text style={styles.diffText}>{label}</Text>
    </View>
  );
}

/** Five stars; interactive when onChange is given. */
export function StarRating({
  value,
  onChange,
  size = 32,
  label,
}: {
  value: number;
  onChange?: (star: number) => void;
  size?: number;
  label: (n: number) => string;
}) {
  const stars = [1, 2, 3, 4, 5];
  if (!onChange) {
    return (
      <View style={styles.stars} accessible accessibilityLabel={label(value)}>
        {stars.map((s) => (
          <Ionicons key={s} name={s <= value ? 'star' : 'star-outline'} size={size} color={Palette.ink} />
        ))}
      </View>
    );
  }
  return (
    <View style={styles.stars} accessibilityRole="adjustable" accessibilityLabel={label(value)}>
      {stars.map((s) => (
        <TouchableOpacity
          key={s}
          onPress={() => onChange(s)}
          activeOpacity={0.8}
          style={styles.starTarget}
          accessibilityRole="button"
          accessibilityLabel={label(s)}
          accessibilityState={{ selected: s === value }}
        >
          <Ionicons name={s <= value ? 'star' : 'star-outline'} size={size} color={Palette.ink} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Outlined choice pill; selected inverts to an asphalt fill. Optional paint dot. */
export function ChoicePill({
  selected,
  onPress,
  label,
  accessibilityLabel,
  paint,
  display = true,
  disabled = false,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  label?: string;
  accessibilityLabel?: string;
  paint?: string;
  display?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.pill, selected && styles.pillSelected, disabled && styles.pillDisabled]}
    >
      {paint && <View style={[styles.paintDot, { backgroundColor: paint }, selected && styles.paintDotOnDark]} />}
      {children}
      {label !== undefined && (
        <Text style={[display ? styles.pillText : styles.pillTextBody, selected && styles.pillTextSelected]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const STRIP = [Palette.orange, Palette.yellow, Palette.blue, Palette.green, Palette.pink];

/** 6px five-paint section divider. */
export function PaintStrip({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.strip, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {STRIP.map((c) => (
        <View key={c} style={[styles.band, { backgroundColor: c }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: Radius.chip,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  chipText: {
    fontFamily: DisplayFont.bold,
    fontSize: 16,
    letterSpacing: 0.8,
    color: Palette.ink,
    textTransform: 'uppercase',
  },
  diff: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  marks: { flexDirection: 'row', gap: 3 },
  mark: { width: 7, height: 16, transform: [{ skewX: '-18deg' }] },
  diffText: {
    fontFamily: DisplayFont.bold,
    fontSize: 16,
    letterSpacing: 0.8,
    color: Palette.ink,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  starTarget: { minWidth: MIN_TARGET, minHeight: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  pill: {
    minHeight: MIN_TARGET,
    paddingHorizontal: 16,
    borderRadius: Radius.control,
    borderWidth: 2,
    borderColor: Palette.ink,
    backgroundColor: Palette.sheet,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillSelected: { backgroundColor: Palette.asphalt, borderColor: Palette.asphalt },
  pillDisabled: { opacity: 0.35 },
  pillText: { fontFamily: DisplayFont.bold, fontSize: 18, letterSpacing: 0.6, textTransform: 'uppercase', color: Palette.ink },
  pillTextBody: { fontSize: 16, fontWeight: '600', color: Palette.ink },
  pillTextSelected: { color: Palette.white },
  paintDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: Palette.ink },
  paintDotOnDark: { borderColor: Palette.white },
  strip: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' },
  band: { flex: 1 },
});
