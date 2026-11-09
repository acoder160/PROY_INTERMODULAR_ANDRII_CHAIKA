import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Palette } from '../../constants/theme';
import ScreenBar from '../../components/social/ScreenBar';
import ProfileView from '../../components/social/ProfileView';

/** Someone's public profile (from a comment, the feed, a follower list or a push). */
export default function UserScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  return (
    <View style={styles.screen}>
      <ScreenBar title={username ?? ''} back />
      {!!username && <ProfileView username={username} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.concrete },
});
