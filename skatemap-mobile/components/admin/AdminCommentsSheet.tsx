import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { DisplayFont, MIN_TARGET, Palette, Radius } from '../../constants/theme';
import { PaintStrip } from '../ui/PaintBits';
import { cleanLabel } from '../../utils/text';
import { deleteComment, fetchComments, type ModerationItem, type SpotComment } from '../../utils/adminApi';

interface Props {
  item: ModerationItem | null;
  onClose: () => void;
  onDeleted: (spotId: number) => void;
}

/**
 * Swipe up on a card: every report and every comment of the spot; comments can be deleted.
 * Mount it with key={spot.id} so each spot starts from a clean state.
 */
export default function AdminCommentsSheet({ item, onClose, onDeleted }: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<SpotComment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const spotId = item?.id;

  useEffect(() => {
    if (spotId === undefined) return undefined;
    let cancelled = false;
    fetchComments(spotId)
      .then((list) => { if (!cancelled) setComments(list); })
      .catch(() => { if (!cancelled) { setFailed(true); setComments([]); } });
    return () => { cancelled = true; };
  }, [spotId]);

  if (!item) return null;

  const formatDate = (value?: string | null) =>
    value ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(value)) : '';

  const confirmDelete = (comment: SpotComment) => {
    Alert.alert(t('admin.confirmDeleteComment'), comment.content.slice(0, 140), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: cleanLabel(t('admin.deleteComment')),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(comment.id);
            setComments((prev) => (prev ?? []).filter((c) => c.id !== comment.id));
            onDeleted(item.id);
          } catch {
            setFailed(true);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2} accessibilityRole="header">{item.name}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={cleanLabel(t('form.close'))}>
              <Ionicons name="close" size={22} color={Palette.white} />
            </TouchableOpacity>
          </View>
          <PaintStrip style={styles.strip} />

          <ScrollView contentContainerStyle={styles.content}>
            {item.reports.length > 0 && (
              <>
                <Text style={styles.section} accessibilityRole="header">{t('admin.reportsCount', { count: item.reportCount })}</Text>
                {item.reports.map((r) => (
                  <View key={r.id} style={styles.row}>
                    <Text style={styles.rowHead}>
                      <Text style={styles.strong}>{r.reporter}</Text>  {t(`report.reasons.${r.reason}`)}  ·  {formatDate(r.createdAt)}
                      {r.weight < 1 ? `  ·  ${t('admin.weight', { weight: r.weight })}` : ''}
                    </Text>
                    {!!r.comment && <Text style={styles.rowText}>“{r.comment}”</Text>}
                  </View>
                ))}
              </>
            )}

            <Text style={styles.section} accessibilityRole="header">{t('admin.commentsCount', { count: comments?.length ?? item.commentCount })}</Text>
            {comments === null ? (
              <ActivityIndicator color={Palette.ink} style={{ marginVertical: 16 }} />
            ) : (
              <>
                {failed && <Text style={styles.empty}>{t('admin.actionFailed')}</Text>}
                {comments.length === 0 && !failed && <Text style={styles.empty}>{t('admin.noComments')}</Text>}
                {comments.map((c) => (
                  <View key={c.id} style={[styles.row, styles.commentRow]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowHead}><Text style={styles.strong}>{c.username || t('common.user')}</Text>  ·  {formatDate(c.createdAt)}</Text>
                      <Text style={styles.rowText}>{c.content}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => confirmDelete(c)}
                      style={styles.deleteBtn}
                      accessibilityRole="button"
                      accessibilityLabel={cleanLabel(t('admin.deleteComment'))}
                    >
                      <Ionicons name="trash-outline" size={20} color={Palette.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </View>
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
    maxHeight: '88%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: {
    flexShrink: 1,
    fontFamily: DisplayFont.black,
    fontSize: 30,
    lineHeight: 32,
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
  content: { paddingBottom: 12 },
  section: {
    fontFamily: DisplayFont.bold,
    fontSize: 18,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Palette.ink,
    marginTop: 20,
    marginBottom: 8,
  },
  row: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: Palette.hairline },
  commentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowHead: { fontSize: 13, color: Palette.inkMuted },
  strong: { fontWeight: '800', color: Palette.ink },
  rowText: { marginTop: 3, fontSize: 15, lineHeight: 21, color: Palette.ink },
  empty: { marginVertical: 12, fontSize: 15, color: Palette.inkMuted, textAlign: 'center' },
  deleteBtn: {
    width: MIN_TARGET,
    height: MIN_TARGET,
    borderRadius: MIN_TARGET / 2,
    borderWidth: 2,
    borderColor: Palette.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
