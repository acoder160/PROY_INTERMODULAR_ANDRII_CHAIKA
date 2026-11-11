import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { DisplayFont, Palette } from '../../constants/theme';

// One paint per name, so the same skater always gets the same colour
const PAINTS = [Palette.orange, Palette.yellow, Palette.blue, Palette.green, Palette.pink];

const paintFor = (name?: string | null) => {
  let hash = 0;
  for (const ch of name || '?') hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) | 0;
  return PAINTS[Math.abs(hash) % PAINTS.length];
};

/** Profile photo, or the first letter of the name on a paint disc. Decorative: the name sits next to it. */
export default function Avatar({ username, url, size = 40 }: { username?: string | null; url?: string | null; size?: number }) {
  // Remembers which URL failed, so a new photo is tried again instead of staying on the letter
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (url && failedUrl !== url) {
    // Cloudinary: ask for a square face crop at twice the display size
    const thumb = url.includes('/image/upload/')
      ? url.replace('/image/upload/', `/image/upload/c_fill,g_face,w_${size * 2},h_${size * 2},q_auto/`)
      : url;
    return (
      <Image
        source={{ uri: thumb }}
        style={[styles.base, box]}
        onError={() => setFailedUrl(url)}
        accessibilityIgnoresInvertColors
        accessible={false}
      />
    );
  }
  return (
    <View style={[styles.base, styles.letter, box, { backgroundColor: paintFor(username) }]} accessible={false}>
      <Text style={[styles.letterText, { fontSize: Math.round(size * 0.5), lineHeight: Math.round(size * 0.62) }]}>
        {(username || '?').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.white },
  letter: { alignItems: 'center', justifyContent: 'center' },
  letterText: { color: Palette.ink, fontFamily: DisplayFont.black },
});
