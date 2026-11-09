import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { uploadImageToCloudinary } from '../utils/cloudinary';
import { apiErrorText } from '../utils/social';
import { useAuth } from '../context/AuthContext';
import { DisplayFont, MIN_TARGET, Palette, Radius } from '../constants/theme';
import GradientFill from '../components/ui/GradientFill';
import ScreenBar from '../components/social/ScreenBar';
import Avatar from '../components/social/Avatar';

/** Edit bio and photo; delete the account. The shared demo account can only look. */
export default function ProfileEditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [demo, setDemo] = useState(false);
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/users/me')
      .then((res) => {
        setBio(res.data.bio ?? '');
        setAvatarUrl(res.data.avatarUrl ?? '');
        setDemo(Boolean(res.data.demo));
      })
      .catch(() => setError(t('popup.sendErrorConnection')))
      .finally(() => setLoaded(true));
  }, [t]);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    setError(null);
    try {
      setAvatarUrl(await uploadImageToCloudinary(result.assets[0].uri));
    } catch {
      setError(t('errors.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.patch('/users/me', { bio, avatarUrl });
      router.back();
    } catch (e) {
      setError(apiErrorText(e, t, { text_rejected: 'social.bioRejected' }));
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = () => {
    Alert.alert(t('social.deleteAccount'), t('social.deleteAccountConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('social.deleteAccount'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete('/users/me');
            await logout();
            router.navigate('/(tabs)');
          } catch (e) {
            setError(apiErrorText(e, t));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScreenBar title={t('social.editProfile')} back />
      {!loaded ? <ActivityIndicator color={Palette.ink} style={{ marginTop: 24 }} /> : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {demo && <Text style={styles.note}>{t('errors.demoReadonly')}</Text>}

            <View style={styles.avatarRow}>
              <Avatar username={user} url={avatarUrl || null} size={80} />
              <TouchableOpacity style={styles.outlineBtn} onPress={pickPhoto} disabled={uploading || demo} accessibilityRole="button">
                {uploading ? <ActivityIndicator color={Palette.ink} /> : <Text style={styles.outlineText}>{t('social.changePhoto')}</Text>}
              </TouchableOpacity>
              {!!avatarUrl && (
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setAvatarUrl('')} disabled={demo} accessibilityRole="button">
                  <Text style={styles.outlineText}>{t('social.removePhoto')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.label}>{t('social.bio')}</Text>
            <TextInput
              style={styles.input}
              value={bio}
              onChangeText={setBio}
              maxLength={280}
              multiline
              editable={!demo}
              placeholder={t('social.bioPlaceholder')}
              placeholderTextColor={Palette.inkMuted}
              accessibilityLabel={t('social.bio')}
            />
            <Text style={styles.hint}>{bio.length} / 280</Text>

            {error && <Text style={styles.error} accessibilityLiveRegion="assertive">{error}</Text>}

            <TouchableOpacity style={[styles.primaryBtn, (saving || uploading || demo) && { opacity: 0.6 }]} onPress={save}
                              disabled={saving || uploading || demo} accessibilityRole="button">
              <GradientFill name="pink" radius={28} />
              {saving ? <ActivityIndicator color={Palette.ink} /> : <Text style={styles.primaryText}>{t('social.save')}</Text>}
            </TouchableOpacity>

            {!demo && (
              <View style={styles.danger}>
                <Text style={styles.hint}>{t('social.deleteAccountHint')}</Text>
                <TouchableOpacity style={[styles.outlineBtn, styles.dangerBtn]} onPress={deleteAccount} accessibilityRole="button">
                  <Text style={[styles.outlineText, { color: Palette.danger }]}>{t('social.deleteAccount')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.concrete },
  scroll: { padding: 16, paddingBottom: 40, gap: 12 },
  note: { padding: 12, borderRadius: 12, backgroundColor: Palette.sheet, borderWidth: 2, borderColor: Palette.ink, color: Palette.ink, fontSize: 15 },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  label: { fontFamily: DisplayFont.bold, fontSize: 18, letterSpacing: 0.8, textTransform: 'uppercase', color: Palette.ink, marginTop: 8 },
  input: { backgroundColor: Palette.white, borderRadius: Radius.input, paddingHorizontal: 14, paddingVertical: 12, minHeight: 96, textAlignVertical: 'top', borderWidth: 2, borderColor: Palette.ink, fontSize: 16, color: Palette.ink },
  hint: { color: Palette.inkMuted, fontSize: 13 },
  error: { color: Palette.danger, fontSize: 14, fontWeight: '700' },
  primaryBtn: { minHeight: 56, borderRadius: 28, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.pink, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryText: { fontFamily: DisplayFont.black, fontSize: 22, letterSpacing: 1, textTransform: 'uppercase', color: Palette.ink },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: MIN_TARGET, paddingHorizontal: 16, borderRadius: Radius.control, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.white },
  outlineText: { fontFamily: DisplayFont.bold, fontSize: 18, letterSpacing: 0.6, textTransform: 'uppercase', color: Palette.ink },
  danger: { marginTop: 24, paddingTop: 16, borderTopWidth: 2, borderTopColor: Palette.hairline, borderStyle: 'dashed', gap: 8, alignItems: 'flex-start' },
  dangerBtn: { borderColor: Palette.danger },
});
