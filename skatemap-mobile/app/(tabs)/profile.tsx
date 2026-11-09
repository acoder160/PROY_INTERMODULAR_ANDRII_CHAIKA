import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Palette } from '../../constants/theme';
import ScreenBar from '../../components/social/ScreenBar';
import SignInPrompt from '../../components/social/SignInPrompt';
import ProfileView from '../../components/social/ProfileView';

/** The signed-in skater's own profile. */
export default function MyProfileScreen() {
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();
  return (
    <View style={styles.screen}>
      <ScreenBar title={t('social.profile')} />
      {!isLoading && !user ? <SignInPrompt /> : user ? <ProfileView username={user} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.concrete },
});
