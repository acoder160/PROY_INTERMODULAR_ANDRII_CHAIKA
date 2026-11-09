import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DisplayFont, MIN_TARGET, Palette, Radius } from '../../constants/theme';
import GradientFill from '../ui/GradientFill';

export default function SignInPrompt() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{t('social.signInToSee')}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.push('/login')} accessibilityRole="button">
        <GradientFill name="pink" radius={Radius.control} />
        <Text style={styles.btnText}>{t('map.enter')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  text: { color: Palette.inkMuted, fontSize: 16, textAlign: 'center' },
  btn: { minHeight: MIN_TARGET, paddingHorizontal: 24, borderRadius: Radius.control, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.pink, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: DisplayFont.black, fontSize: 20, letterSpacing: 1, textTransform: 'uppercase', color: Palette.ink },
});
