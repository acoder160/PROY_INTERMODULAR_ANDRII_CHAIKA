import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import { apiErrorText, type UserSummary } from '../../utils/social';
import { DisplayFont, MIN_TARGET, Palette, Radius } from '../../constants/theme';
import Avatar from './Avatar';
import { openSpotOnMap } from './SpotCard';
import { formatSessionTime, PlanSession, type EditableSession } from './LiveSection';

interface MySession {
  id: number;
  spotId: number;
  spotName: string | null;
  startsAt: string;
  note: string | null;
  host: UserSummary;
  participants: number;
  people: UserSummary[];
  hostedByMe: boolean;
}

/**
 * "Active sessions" on your own profile: the ones you host (who is coming, edit, cancel) and the
 * ones you joined. Editing or cancelling tells everyone who joined, through their notifications.
 */
export default function ActiveSessions({ reloadKey }: { reloadKey: number }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [sessions, setSessions] = useState<MySession[]>([]);
  const [editing, setEditing] = useState<MySession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localKey, setLocalKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get('/users/me/sessions')
      .then((res) => { if (!cancelled) setSessions(res.data ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [reloadKey, localKey]);

  const cancelSession = (s: MySession) => {
    Alert.alert(t('live.cancelConfirm'), s.participants > 1 ? t('live.cancelNotice') : undefined, [
      { text: t('live.keepSession'), style: 'cancel' },
      {
        text: t('live.cancelSessionAction'),
        style: 'destructive',
        onPress: async () => {
          setError(null);
          try {
            await api.delete(`/sessions/${s.id}`);
            setSessions((list) => list.filter((x) => x.id !== s.id));
          } catch (e) {
            setError(apiErrorText(e, t));
          }
        },
      },
    ]);
  };

  if (sessions.length === 0) return null;

  const others = (s: MySession) => s.people.filter((p) => p.username !== s.host.username);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">{t('live.activeSessions')}</Text>
      {sessions.map((s) => (
        <View key={s.id} style={styles.card}>
          <TouchableOpacity style={styles.head} onPress={() => openSpotOnMap(router, s.spotId)}
                            accessibilityRole="button" activeOpacity={0.85}>
            <Ionicons name="calendar-outline" size={22} color={Palette.ink} />
            <View style={styles.text}>
              <Text style={styles.time}>{formatSessionTime(s.startsAt, i18n.language)}</Text>
              <Text style={styles.spot} numberOfLines={1}>{s.spotName || t('webview.unnamed')}</Text>
              {!!s.note && <Text style={styles.note} numberOfLines={2}>{s.note}</Text>}
            </View>
            <View style={[styles.tag, s.hostedByMe && styles.tagHost]}>
              <Text style={[styles.tagText, s.hostedByMe && { color: Palette.white }]} numberOfLines={1}>
                {s.hostedByMe ? t('live.hosting') : t('live.joined')}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Who is coming: for your own sessions, everyone but you */}
          <View style={styles.people}>
            {(s.hostedByMe ? others(s) : s.people).map((p, i) => (
              <Avatar key={p.username ?? `gone-${i}`} username={p.username} url={p.avatarUrl} size={28} />
            ))}
            <Text style={styles.meta}>
              {s.hostedByMe
                ? (s.participants > 1 ? t('live.othersGoing', { count: s.participants - 1 }) : t('live.nobodyYet'))
                : t('live.going', { count: s.participants })}
            </Text>
          </View>

          {s.hostedByMe && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.btn} onPress={() => setEditing(s)} accessibilityRole="button">
                <Ionicons name="create-outline" size={18} color={Palette.ink} />
                <Text style={styles.btnText}>{t('social.edit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={() => cancelSession(s)} accessibilityRole="button">
                <Ionicons name="trash-outline" size={18} color={Palette.danger} />
                <Text style={[styles.btnText, { color: Palette.danger }]}>{t('live.cancelSessionAction')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
      {error && <Text style={styles.error} accessibilityLiveRegion="assertive">{error}</Text>}

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle} accessibilityRole="header">{t('live.editSession')}</Text>
            {!!editing && <Text style={styles.spot} numberOfLines={1}>{editing.spotName || t('webview.unnamed')}</Text>}
            {!!editing && editing.participants > 1 && <Text style={styles.meta}>{t('live.editNotice')}</Text>}
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 8 }}>
              {!!editing && (
                <PlanSession
                  key={editing.id}
                  spotId={editing.spotId}
                  session={editing as EditableSession}
                  onCancel={() => setEditing(null)}
                  onCreated={() => { setEditing(null); setLocalKey((k) => k + 1); }}
                />
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  title: { fontFamily: DisplayFont.bold, fontSize: 20, letterSpacing: 0.6, textTransform: 'uppercase', color: Palette.ink },
  card: { gap: 10, padding: 12, borderRadius: Radius.card, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.sheet },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, minWidth: 0 },
  time: { fontFamily: DisplayFont.black, fontSize: 18, textTransform: 'uppercase', color: Palette.ink },
  spot: { fontSize: 15, fontWeight: '700', color: Palette.ink },
  note: { fontSize: 14, color: Palette.ink, marginTop: 2 },
  meta: { flexShrink: 1, fontSize: 13, color: Palette.inkMuted },
  tag: { maxWidth: '35%', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.white },
  tagHost: { backgroundColor: Palette.asphalt },
  tagText: { fontSize: 13, fontWeight: '800', color: Palette.ink, textTransform: 'uppercase' },
  people: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TARGET, paddingHorizontal: 14, borderRadius: Radius.control, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.white },
  btnDanger: { borderColor: Palette.danger },
  btnText: { fontFamily: DisplayFont.bold, fontSize: 16, letterSpacing: 0.6, textTransform: 'uppercase', color: Palette.ink },
  error: { color: Palette.danger, fontSize: 14, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(28,28,28,0.6)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', padding: 20, paddingBottom: 32, gap: 6, backgroundColor: Palette.sheet, borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet },
  sheetTitle: { fontFamily: DisplayFont.black, fontSize: 30, lineHeight: 32, textTransform: 'uppercase', color: Palette.ink },
});
