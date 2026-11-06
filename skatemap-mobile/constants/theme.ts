/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

/**
 * SkateMap "Locate Paint" design tokens (see DESIGN.md at the repo root).
 */
export const Palette = {
  asphalt: '#1C1C1C',
  asphaltRaised: '#2A2A2A',
  concrete: '#C9C9C4',
  sheet: '#FFFFFF',
  white: '#FFFFFF',
  ink: '#1C1C1C',
  inkMuted: '#4A4A46',
  hairline: '#D7D7D2',
  onAsphaltMuted: '#C8C8C3',
  orange: '#FF7A00',
  yellow: '#FFD400',
  blue: '#2F6BFF',
  green: '#18A558',
  pink: '#FF4FA3',
  danger: '#C62828',
  dangerOnDark: '#FF8A80',
  positive: '#0F7A3E',
} as const;

/** One paint per spot type (Colour-Is-Type rule). */
export const spotTypePaint: Record<string, string> = {
  STREET: Palette.orange,
  RAIL: Palette.yellow,
  RAMPS: Palette.blue,
  PARK: Palette.green,
  SKATEPARK: Palette.green,
  LEDGE: Palette.white,
};

/** Big Shoulders Display, loaded in app/_layout.tsx. */
// Big Shoulders only covers Latin. Native falls back to the system face per glyph;
// the web needs an explicit stack or Cyrillic, Arabic, CJK etc. render in the browser serif.
const DISPLAY_FALLBACK = Platform.OS === 'web' ? ', system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' : '';
export const DisplayFont = {
  bold: `BigShouldersDisplay_700Bold${DISPLAY_FALLBACK}`,
  black: `BigShouldersDisplay_900Black${DISPLAY_FALLBACK}`,
};

export const Radius = {
  chip: 10,
  input: 14,
  card: 16,
  control: 24,
  sheet: 28,
} as const;

/** Minimum touch target in dp. */
export const MIN_TARGET = 48;
