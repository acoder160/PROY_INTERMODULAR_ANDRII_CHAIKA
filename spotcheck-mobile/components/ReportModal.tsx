import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { DisplayFont, MIN_TARGET, Palette, Radius } from '../constants/theme';
import { hasLegalPage, openLegalPage } from '../utils/legal';
import GradientFill from './ui/GradientFill';
import { ChoicePill, PaintStrip } from './ui/PaintBits';
import api from '../utils/api';
import { cleanLabel } from '../utils/text';
import { useAuth } from '../context/AuthContext';

// Mismas razones que el backend (ReportReason) y que spotcheck-web/src/components/ReportSheet.jsx
export const REPORT_REASONS = ['SPAM', 'INAPPROPRIATE', 'FAKE', 'WRONG_LOCATION', 'DANGEROUS', 'OTHER'] as const;
// Comments and profiles have no location, so those two reasons do not apply to them
const CONTENT_REASONS = ['SPAM', 'INAPPROPRIATE', 'DANGEROUS', 'OTHER'] as const;
const MAX_COMMENT = 300;

const errorKey = (error: any) => {
  const code = error?.response?.data?.code;
  const status = error?.response?.status;
  if (code === 'already_reported' || status === 409) return 'report.already';
  if (code === 'own_spot' || code === 'own_content') return 'report.own';
  if (status === 429) return 'report.tooMany';
  return 'report.failed';
};

interface ReportModalProps {
  spot?: { id: number; name?: string } | null;
  /** Reports a comment or a profile instead of a spot: the POST path and the name shown in the subtitle. */
  endpoint?: string;
  subject?: string;
  onClose: () => void;
}

/** "Report" sheet: a reason is required, details are optional. The review (AI + admin) runs on the server. */
export default function ReportModal({ spot, endpoint, subject, onClose }: ReportModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'sent') return undefined;
    const timer = setTimeout(onClose, 2200);
    return () => clearTimeout(timer);
  }, [status, onClose]);

  if (!spot && !endpoint) return null;

  const submit = async () => {
    if (!reason || status !== 'idle') return;
    setStatus('sending');
    setError(null);
    try {
      await api.post(endpoint ?? `/spots/${spot?.id}/reports`, { reason, comment: comment.trim() || null });
      setStatus('sent');
    } catch (e) {
      setError(t(errorKey(e)));
      setStatus('idle');
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">{t('report.title')}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={cleanLabel(t('form.close'))}
            >
              <Ionicons name="close" size={22} color={Palette.white} />
            </TouchableOpacity>
          </View>
          <PaintStrip style={styles.strip} />

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.subtitle}>{t('report.subtitle', { name: subject ?? (spot?.name || t('webview.unnamed')) })}</Text>

            {!user ? (
              <Text style={styles.text}>{t('report.loginText')}</Text>
            ) : status === 'sent' ? (
              <View style={[styles.notice, styles.noticeSuccess]} accessibilityLiveRegion="polite">
                <Ionicons name="checkmark-circle" size={20} color={Palette.positive} />
                <Text style={[styles.noticeText, { color: Palette.positive }]}>{t('report.sent')}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle} accessibilityRole="header">{t('report.reasonLabel')}</Text>
                <View style={styles.reasons} accessibilityRole="radiogroup">
                  {(endpoint ? CONTENT_REASONS : REPORT_REASONS).map((r) => (
                    <ChoicePill
                      key={r}
                      display={false}
                      selected={reason === r}
                      onPress={() => setReason(r)}
                      label={t(`report.reasons.${r}`)}
                    />
                  ))}
                </View>

                <Text style={styles.sectionTitle}>{t('report.commentLabel')}</Text>
                <TextInput
                  style={styles.input}
                  multiline
                  maxLength={MAX_COMMENT}
                  placeholder={t('report.commentPlaceholder')}
                  placeholderTextColor={Palette.inkMuted}
                  value={comment}
                  onChangeText={setComment}
                  accessibilityLabel={t('report.commentLabel')}
                />
                <Text style={styles.counter}>{comment.length} / {MAX_COMMENT}</Text>

                {!!error && (
                  <View style={[styles.notice, styles.noticeError]} accessibilityLiveRegion="assertive">
                    <Ionicons name="alert-circle" size={20} color={Palette.danger} />
                    <Text style={[styles.noticeText, { color: Palette.danger }]}>{error}</Text>
                  </View>
                )}
              </>
            )}

            {hasLegalPage && (
              <TouchableOpacity onPress={openLegalPage} accessibilityRole="link" style={styles.legalLink}>
                <Text style={styles.legalText}>{t('report.howItWorks')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {status !== 'sent' && (
            <TouchableOpacity
              onPress={user ? submit : () => { onClose(); router.push('/login'); }}
              disabled={!!user && (!reason || status === 'sending')}
              activeOpacity={0.85}
              style={[styles.primaryBtn, !!user && !reason && styles.primaryBtnDisabled]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!user && !reason, busy: status === 'sending' }}
            >
              <GradientFill name="pink" radius={28} />
              {status === 'sending' ? (
                <ActivityIndicator color={Palette.ink} />
              ) : (
                <>
                  {!!user && <Ionicons name="flag" size={20} color={Palette.ink} />}
                  <Text style={styles.primaryText} numberOfLines={1}>{user ? t('report.send') : t('common.login')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(28,28,28,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Palette.sheet,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: '92%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: {
    flexShrink: 1,
    fontFamily: DisplayFont.black,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Palette.ink,
  },
  closeBtn: {
    width: MIN_TARGET,
    height: MIN_TARGET,
    borderRadius: MIN_TARGET / 2,
    backgroundColor: Palette.asphalt,
    borderWidth: 2,
    borderColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strip: { marginTop: 12 },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 16 },
  subtitle: { marginTop: 14, fontSize: 16, lineHeight: 22, fontWeight: '700', color: Palette.ink },
  text: { marginTop: 10, fontSize: 15, lineHeight: 21, color: Palette.inkMuted },
  sectionTitle: {
    fontFamily: DisplayFont.bold,
    fontSize: 18,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Palette.ink,
    marginTop: 20,
    marginBottom: 10,
  },
  reasons: { gap: 8 },
  input: {
    minHeight: 84,
    maxHeight: 140,
    padding: 12,
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: Radius.card,
    fontSize: 16,
    color: Palette.ink,
    textAlignVertical: 'top',
  },
  counter: { marginTop: 6, fontSize: 13, color: Palette.inkMuted, textAlign: 'right' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 12, borderRadius: 12 },
  noticeSuccess: { backgroundColor: '#E2F4E8' },
  noticeError: { backgroundColor: '#FCE8E6' },
  noticeText: { flex: 1, fontSize: 14, fontWeight: '700' },
  legalLink: { marginTop: 16, minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' },
  legalText: {
    fontSize: 14,
    fontWeight: '700',
    color: Palette.ink,
    textDecorationLine: 'underline',
    textDecorationColor: Palette.pink,
  },
  primaryBtn: {
    marginTop: 12,
    minHeight: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Palette.ink,
    backgroundColor: Palette.pink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryText: {
    fontFamily: DisplayFont.black,
    fontSize: 22,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Palette.ink,
    flexShrink: 1,
  },
});
