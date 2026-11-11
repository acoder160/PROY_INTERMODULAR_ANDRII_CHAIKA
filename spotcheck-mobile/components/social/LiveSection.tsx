import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import { apiErrorText, type UserSummary } from '../../utils/social';
import { DisplayFont, MIN_TARGET, Palette, Radius } from '../../constants/theme';
import GradientFill from '../ui/GradientFill';
import Avatar from './Avatar';

interface SpotLive { count: number; skaters: UserSummary[]; checkedInHere: boolean }
interface Session {
  id: number;
  startsAt: string;
  note: string | null;
  host: UserSummary;
  participants: number;
  joinedByMe: boolean;
  hostedByMe: boolean;
}

/** "Sat 14 Nov, 18:00" in the app language and the phone's time zone. */
export function formatSessionTime(iso: string, lang?: string): string {
  try {
    return new Date(iso).toLocaleString(lang, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return new Date(iso).toLocaleString();
  }
}

// Quick picks instead of a date picker: the next hours of today and the same times tomorrow
function startOptions(): Date[] {
  const options: Date[] = [];
  const base = new Date();
  base.setMinutes(0, 0, 0);
  for (const hours of [1, 2, 3, 5]) options.push(new Date(base.getTime() + hours * 3600000));
  const tomorrow = new Date(base);
  tomorrow.setDate(tomorrow.getDate() + 1);
  for (const h of [11, 17, 19]) {
    const d = new Date(tomorrow);
    d.setHours(h);
    options.push(d);
  }
  return options;
}

/**
 * Live part of the spot sheet: who is skating here now (with "I'm here" on site) and the planned
 * sessions. {@code liveCount} comes from the map's socket; when it changes, the list reloads.
 */
export default function LiveSection({ spotId, me, liveCount, onBeforeNavigate }: {
  spotId: number;
  me: string | null;
  liveCount: number;
  onBeforeNavigate?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [live, setLive] = useState<SpotLive | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get(`/spots/${spotId}/live`).then((res) => { if (!cancelled) setLive(res.data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [spotId, liveCount, me]);

  useEffect(() => {
    let cancelled = false;
    api.get(`/spots/${spotId}/sessions`).then((res) => { if (!cancelled) setSessions(res.data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [spotId, me, reloadKey]);

  const goToLogin = () => {
    onBeforeNavigate?.();
    router.push('/login');
  };

  const checkIn = async () => {
    if (!me) { goToLogin(); return; }
    setBusy(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setError(t('live.needLocation')); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const res = await api.post(`/spots/${spotId}/checkin`, { latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setLive(res.data);
    } catch (e: any) {
      setError(e?.response ? apiErrorText(e, t) : t('live.needLocation'));
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await api.delete(`/spots/${spotId}/checkin`);
      setLive((l) => l && { ...l, count: Math.max(0, l.count - 1), checkedInHere: false, skaters: l.skaters.filter((s) => s.username !== me) });
    } finally {
      setBusy(false);
    }
  };

  const replace = (updated: Session) => setSessions((list) => (list ?? []).map((s) => (s.id === updated.id ? updated : s)));

  const toggleJoin = async (session: Session) => {
    if (!me) { goToLogin(); return; }
    try {
      const res = session.joinedByMe ? await api.delete(`/sessions/${session.id}/join`) : await api.post(`/sessions/${session.id}/join`);
      replace(res.data);
    } catch (e) {
      setError(apiErrorText(e, t));
    }
  };

  const cancel = (session: Session) => {
    Alert.alert(t('live.cancelConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('live.cancelSession'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/sessions/${session.id}`);
            setSessions((list) => (list ?? []).filter((s) => s.id !== session.id));
          } catch (e) {
            setError(apiErrorText(e, t));
          }
        },
      },
    ]);
  };

  const count = live?.count ?? liveCount;

  return (
    <View style={styles.box}>
      <View style={styles.nowRow}>
        <View style={[styles.dot, count > 0 && styles.dotOn]} />
        <Text style={styles.nowText}>{count > 0 ? t('live.skatingNow', { count }) : t('live.nobody')}</Text>
        {live?.checkedInHere ? (
          <TouchableOpacity style={styles.outlineBtn} onPress={leave} disabled={busy} accessibilityRole="button">
            <Text style={styles.btnText}>{t('live.leave')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={checkIn} disabled={busy} accessibilityRole="button">
            <GradientFill name="pink" radius={Radius.control} />
            {busy ? <ActivityIndicator color={Palette.ink} /> : <Text style={styles.btnText}>{t('live.imHere')}</Text>}
          </TouchableOpacity>
        )}
      </View>

      {!!live?.skaters?.length && (
        <View style={styles.people}>
          {live.skaters.map((s, i) => (
            <TouchableOpacity key={s.username ?? `deleted-${i}`} disabled={!s.username} accessibilityRole="button" accessibilityLabel={s.username ?? ''}
                              onPress={() => { onBeforeNavigate?.(); router.push({ pathname: '/user/[username]', params: { username: s.username! } } as any); }}>
              <Avatar username={s.username} url={s.avatarUrl} size={32} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.sessionsHead}>
        <Text style={styles.title}>{t('live.sessions')}</Text>
        {!planning && (
          <TouchableOpacity style={styles.outlineBtn} onPress={() => (me ? setPlanning(true) : goToLogin())} accessibilityRole="button">
            <Text style={styles.btnText}>{t('live.planSession')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {planning && (
        <PlanSession spotId={spotId} onCancel={() => setPlanning(false)}
                     onCreated={() => { setPlanning(false); setReloadKey((k) => k + 1); }} />
      )}

      {sessions?.length === 0 && !planning && <Text style={styles.empty}>{t('live.noSessions')}</Text>}
      {sessions?.map((s) => (
        <View key={s.id} style={styles.session}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.sessionTime}>{formatSessionTime(s.startsAt, i18n.language)}</Text>
            {!!s.note && <Text style={styles.sessionNote}>{s.note}</Text>}
            <Text style={styles.sessionMeta}>
              {s.host.username ? t('live.hostedBy', { username: s.host.username }) : t('social.deletedUser')}
              {' · '}{t('live.going', { count: s.participants })}
            </Text>
          </View>
          {s.hostedByMe ? (
            <TouchableOpacity style={[styles.outlineBtn, styles.dangerBtn]} onPress={() => cancel(s)} accessibilityRole="button">
              <Text style={[styles.btnText, { color: Palette.danger }]}>{t('live.cancelSession')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.joinedByMe ? styles.outlineBtn : styles.primaryBtn} onPress={() => toggleJoin(s)}
                              accessibilityRole="button" accessibilityState={{ selected: s.joinedByMe }}>
              {!s.joinedByMe && <GradientFill name="pink" radius={Radius.control} />}
              <Text style={styles.btnText}>{s.joinedByMe ? t('live.joined') : t('live.join')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {error && <Text style={styles.error} accessibilityLiveRegion="assertive">{error}</Text>}
    </View>
  );
}

const DAYS_AHEAD = 30; // the server takes sessions up to 30 days ahead
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = [0, 15, 30, 45];

function startOfDay(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

function at(dayOffset: number, hour: number, minute: number): Date {
  const d = startOfDay(dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** A session being edited: the form opens on its time and note. */
export interface EditableSession { id: number; startsAt: string; note: string | null }

function daysFromToday(date: Date): number {
  // Rounded: a day with a daylight-saving change is 23 or 25 hours long
  return Math.round((new Date(date).setHours(0, 0, 0, 0) - startOfDay(0).getTime()) / 86400000);
}

/**
 * Plan a session at a spot, or (with {@code session}) change the time and note of one you host.
 * Used by the spot sheet and by "Active sessions" on your profile.
 */
export function PlanSession({ spotId, session, onCancel, onCreated }: {
  spotId: number;
  session?: EditableSession;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [options] = useState(startOptions);
  const [preset, setPreset] = useState<Date>(options[1]);
  const start = session ? new Date(session.startsAt) : null;
  // "Other time": any day of the next month, any hour, in 15-minute steps. Editing opens on it.
  const [custom, setCustom] = useState(!!start);
  const [day, setDay] = useState(() => (start ? Math.max(0, daysFromToday(start)) : 0));
  const [hour, setHour] = useState(() => (start ? start.getHours() : Math.min(23, new Date().getHours() + 2)));
  const [minute, setMinute] = useState(() => (start ? start.getMinutes() : 0));
  const minutes = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort((a, b) => a - b);
  const [note, setNote] = useState(session?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Now" for greying out past times; ticks so an open form doesn't offer a time that just passed
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const when = custom ? at(day, hour, minute) : preset;
  const inPast = when.getTime() < now;
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => startOfDay(i));

  const pickDay = (offset: number) => {
    setDay(offset);
    // Today: move the time forward if it already passed
    if (offset === 0 && at(0, hour, minute).getTime() < now) {
      const next = new Date(now + 3600000);
      setHour(next.getHours());
      setMinute(0);
      if (next.getDate() !== new Date(now).getDate()) setDay(1);
    }
  };

  const submit = async () => {
    if (inPast) return;
    setSaving(true);
    setError(null);
    try {
      if (session) await api.patch(`/sessions/${session.id}`, { startsAt: when.toISOString(), note });
      else await api.post(`/spots/${spotId}/sessions`, { startsAt: when.toISOString(), note });
      onCreated();
    } catch (e) {
      setError(apiErrorText(e, t, { text_rejected: 'social.commentRejected' }));
      setSaving(false);
    }
  };

  return (
    <View style={styles.plan}>
      <Text style={styles.label}>{t('live.when')}</Text>
      <View style={styles.chips}>
        {options.map((d) => {
          const on = !custom && d.getTime() === preset.getTime();
          return (
            <TouchableOpacity key={d.getTime()} style={[styles.chip, on && styles.chipOn]} onPress={() => { setCustom(false); setPreset(d); }}
                              accessibilityRole="button" accessibilityState={{ selected: on }}>
              <Text style={[styles.chipText, on && { color: Palette.white }]}>{formatSessionTime(d.toISOString(), i18n.language)}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={[styles.chip, styles.chipCustom, custom && styles.chipOn]} onPress={() => setCustom(true)}
                          accessibilityRole="button" accessibilityState={{ selected: custom }}>
          <Ionicons name="calendar-outline" size={16} color={custom ? Palette.white : Palette.ink} />
          <Text style={[styles.chipText, custom && { color: Palette.white }]}>{t('live.customTime')}</Text>
        </TouchableOpacity>
      </View>

      {custom && (
        <View style={styles.custom}>
          <Text style={styles.subLabel}>{t('live.day')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {days.map((d, i) => {
              const on = i === day;
              return (
                <TouchableOpacity key={i} style={[styles.dayChip, on && styles.chipOn]} onPress={() => pickDay(i)}
                                  accessibilityRole="button" accessibilityState={{ selected: on }}
                                  accessibilityLabel={d.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}>
                  <Text style={[styles.dayWeek, on && { color: Palette.white }]}>
                    {d.toLocaleDateString(i18n.language, { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dayNum, on && { color: Palette.white }]}>{d.getDate()}</Text>
                  <Text style={[styles.dayWeek, on && { color: Palette.white }]}>
                    {d.toLocaleDateString(i18n.language, { month: 'short' })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.subLabel}>{t('live.time')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {HOURS.map((h) => {
              const on = h === hour;
              const past = at(day, h, 45).getTime() < now;
              return (
                <TouchableOpacity key={h} style={[styles.timeChip, on && styles.chipOn, past && styles.chipPast]}
                                  onPress={() => { setHour(h); if (at(day, h, minute).getTime() < now) setMinute(45); }}
                                  disabled={past} accessibilityRole="button" accessibilityState={{ selected: on, disabled: past }}>
                  <Text style={[styles.timeText, on && { color: Palette.white }]}>{String(h).padStart(2, '0')}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.chips}>
            {minutes.map((m) => {
              const on = m === minute;
              const past = at(day, hour, m).getTime() < now;
              return (
                <TouchableOpacity key={m} style={[styles.timeChip, on && styles.chipOn, past && styles.chipPast]}
                                  onPress={() => setMinute(m)} disabled={past}
                                  accessibilityRole="button" accessibilityState={{ selected: on, disabled: past }}>
                  <Text style={[styles.timeText, on && { color: Palette.white }]}>:{String(m).padStart(2, '0')}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.picked, inPast && { color: Palette.danger }]} accessibilityLiveRegion="polite">
            {inPast ? t('errors.sessionBadTime') : formatSessionTime(when.toISOString(), i18n.language)}
          </Text>
        </View>
      )}
      <Text style={styles.label}>{t('live.note')}</Text>
      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        maxLength={200}
        placeholder={t('live.notePlaceholder')}
        placeholderTextColor={Palette.inkMuted}
        accessibilityLabel={t('live.note')}
        returnKeyType={Platform.OS === 'ios' ? 'done' : undefined}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.planActions}>
        <TouchableOpacity style={styles.outlineBtn} onPress={onCancel} accessibilityRole="button">
          <Text style={styles.btnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryBtn, inPast && { opacity: 0.5 }]} onPress={submit} disabled={saving || inPast}
                          accessibilityRole="button" accessibilityState={{ disabled: saving || inPast }}>
          <GradientFill name="pink" radius={Radius.control} />
          {saving ? <ActivityIndicator color={Palette.ink} /> : <Text style={styles.btnText}>{session ? t('social.save') : t('live.create')}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 18, padding: 14, borderRadius: Radius.card, borderWidth: 2, borderColor: Palette.ink, gap: 10 },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.hairline },
  dotOn: { backgroundColor: Palette.pink },
  nowText: { flex: 1, fontSize: 15, fontWeight: '700', color: Palette.ink },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sessionsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: Palette.hairline },
  title: { fontFamily: DisplayFont.bold, fontSize: 20, letterSpacing: 0.6, textTransform: 'uppercase', color: Palette.ink },
  empty: { color: Palette.inkMuted, fontSize: 15 },
  session: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: '#F2F2EF' },
  sessionTime: { fontFamily: DisplayFont.black, fontSize: 18, textTransform: 'uppercase', color: Palette.ink },
  sessionNote: { fontSize: 15, color: Palette.ink, marginTop: 2 },
  sessionMeta: { fontSize: 13, color: Palette.inkMuted, marginTop: 2 },
  primaryBtn: { minHeight: MIN_TARGET, paddingHorizontal: 16, borderRadius: Radius.control, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.pink, alignItems: 'center', justifyContent: 'center' },
  outlineBtn: { minHeight: MIN_TARGET, paddingHorizontal: 16, borderRadius: Radius.control, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.white, alignItems: 'center', justifyContent: 'center' },
  dangerBtn: { borderColor: Palette.danger },
  btnText: { fontFamily: DisplayFont.bold, fontSize: 17, letterSpacing: 0.6, textTransform: 'uppercase', color: Palette.ink },
  plan: { gap: 8 },
  label: { fontFamily: DisplayFont.bold, fontSize: 16, letterSpacing: 0.6, textTransform: 'uppercase', color: Palette.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 40, paddingHorizontal: 12, borderRadius: 20, borderWidth: 2, borderColor: Palette.ink, justifyContent: 'center', backgroundColor: Palette.white },
  chipOn: { backgroundColor: Palette.asphalt },
  chipText: { fontSize: 14, fontWeight: '700', color: Palette.ink },
  chipCustom: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipPast: { opacity: 0.3 },
  custom: { gap: 8, padding: 10, borderRadius: 12, backgroundColor: '#F2F2EF' },
  subLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', color: Palette.inkMuted },
  strip: { gap: 6, paddingRight: 6 },
  dayChip: { width: 58, paddingVertical: 6, borderRadius: 12, borderWidth: 2, borderColor: Palette.ink, alignItems: 'center', backgroundColor: Palette.white },
  dayWeek: { fontSize: 12, fontWeight: '700', color: Palette.inkMuted, textTransform: 'uppercase' },
  dayNum: { fontFamily: DisplayFont.black, fontSize: 22, lineHeight: 26, color: Palette.ink },
  timeChip: { minWidth: MIN_TARGET, minHeight: MIN_TARGET, paddingHorizontal: 10, borderRadius: Radius.control, borderWidth: 2, borderColor: Palette.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.white },
  timeText: { fontFamily: DisplayFont.black, fontSize: 18, color: Palette.ink },
  picked: { fontSize: 15, fontWeight: '800', color: Palette.ink },
  input: { backgroundColor: Palette.white, borderRadius: Radius.input, paddingHorizontal: 14, paddingVertical: 10, minHeight: MIN_TARGET, borderWidth: 2, borderColor: Palette.ink, fontSize: 16, color: Palette.ink },
  planActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  error: { color: Palette.danger, fontSize: 14, fontWeight: '700' },
});
