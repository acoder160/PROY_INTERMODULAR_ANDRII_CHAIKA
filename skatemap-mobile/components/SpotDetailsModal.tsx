import React, { useState, useEffect, useRef, type ComponentRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, DisplayFont, Radius, MIN_TARGET } from '../constants/theme';
import GradientFill from '../components/ui/GradientFill';
import { TypeChip, DifficultyMarks, StarRating, PaintStrip } from './ui/PaintBits';
import api from '../utils/api';
import { cleanLabel } from '../utils/text';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function SpotDetailsModal({ visible, onClose, spot, token, onSpotUpdated, onReport, userLocation }: any) {
  const { t } = useTranslation();
  const router = useRouter();
  // El estado se reinicia al cambiar de spot: el padre monta este componente con key={spot.id}
  const [comments, setComments] = useState<any[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [commentsFailed, setCommentsFailed] = useState(false);

  const [hasVoted, setHasVoted] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [currentRating, setCurrentRating] = useState(0);

  // Controla la nota media visualmente
  const [localAvgRating, setLocalAvgRating] = useState<number>(spot?.surfaceRating || 0);

  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Referencia al ScrollView para hacer auto-scroll
  const scrollViewRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const spotId = spot?.id;

  // Cada cambio de reloadKey (reintentar, tras enviar una reseña) vuelve a pedir los datos
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => {
    setIsLoadingComments(true);
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    if (!visible || spotId === undefined) return;
    let cancelled = false;
    const headers = token
      ? { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      : { 'ngrok-skip-browser-warning': 'true' };

    (async () => {
      // 1. Solo comprobamos si ya ha votado cuando el usuario tiene sesión iniciada (token)
      if (token) {
        try {
          const ratingRes = await api.get(`/ratings/check/${spotId}`, { headers });
          if (cancelled) return;
          if (ratingRes.data && ratingRes.data.value > 0) {
            setMyRating(ratingRes.data.value);
            setHasVoted(true);
          } else {
            setHasVoted(false);
          }
        } catch {
          if (!cancelled) setHasVoted(false);
        }
      }

      // 2. Los comentarios se cargan siempre (con o sin token)
      try {
        const commentsRes = await api.get(`/comments/spot/${spotId}`, { headers });
        if (cancelled) return;
        setComments(Array.isArray(commentsRes.data) ? commentsRes.data : []);
        setCommentsFailed(false);
      } catch (e) {
        if (cancelled) return;
        // Sin servidor es un estado esperado (la hoja muestra "Reintentar"): log, no pantalla roja de LogBox
        console.log('No se pudieron cargar los comentarios:', (e as Error)?.message ?? e);
        setCommentsFailed(true);
      } finally {
        if (!cancelled) setIsLoadingComments(false);
      }
    })();

    return () => { cancelled = true; };
  }, [visible, spotId, token, reloadKey]);

  const handleStarPress = (star: number) => {
    // Si es un invitado (sin token), le pedimos iniciar sesión al intentar valorar
    if (!token) {
      Alert.alert(
        t('auth.loginRequiredTitle'),
        t('auth.loginRequiredRate'),
        [
          { text: t('common.cancel'), style: "cancel" },
          { 
            text: t('common.login'), 
            onPress: () => {
              onClose();
              router.push('/login');
            } 
          }
        ]
      );
      return;
    }

    setCurrentRating(star);
    // Bajamos suavemente para que vea el input
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleSendReview = async () => {
    if (!token) {
      onClose();
      router.push('/login');
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      // Guardamos lo que devuelve Spring Boot
      const response = await api.post(`/ratings/${spot.id}`, { value: currentRating }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true"
        } 
      });

      if (newComment.trim().length > 0) {
        await api.post(`/comments/${spot.id}`, { content: newComment }, {
          headers: { 
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true"
          } 
        });
      }

      setHasVoted(true);
      setMyRating(currentRating);
      setSuccessMessage(t('popup.thanks'));
      
      if (response.data && response.data.newAverage) {
         setLocalAvgRating(response.data.newAverage);
      }
      
      reload();
      onSpotUpdated(); 
      setShowComments(true); 
      
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.response?.data;
      setErrorMessage(typeof errorMsg === 'string' ? errorMsg : t('popup.sendErrorConnection'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!spot) return null;

  const spotType = (spot.spotType || spot.type || 'STREET').toUpperCase();
  const difficulty = (spot.difficultyLevel || 'INTERMEDIATE').toUpperCase();
  const distanceKm = userLocation ? haversineKm(userLocation.lat, userLocation.lng, spot.latitude, spot.longitude) : null;
  const distanceText = distanceKm === null ? null : distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`;

  const openDirections = () => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}&travelmode=walking`);
  };

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={cleanLabel(t('form.close'))}
          >
            <Ionicons name="close" size={22} color={Palette.white} />
          </TouchableOpacity>
          {onReport && (
            <TouchableOpacity
              style={[styles.closeBtn, styles.reportBtn]}
              onPress={() => onReport(spot.id)}
              accessibilityRole="button"
              accessibilityLabel={t('report.title')}
            >
              <Ionicons name="flag-outline" size={20} color={Palette.white} />
            </TouchableOpacity>
          )}

          <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {spot.mediaUrl ? (
              <Image source={{ uri: spot.mediaUrl }} style={styles.image} accessibilityIgnoresInvertColors />
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]}>
                <GradientFill name="concrete" diagonal />
                <Ionicons name="camera-outline" size={36} color={Palette.inkMuted} />
              </View>
            )}

            <View style={styles.content}>
              <Text style={styles.title}>{spot.name}</Text>
              <PaintStrip style={{ marginVertical: 10 }} />

              <View style={styles.factsRow}>
                <View style={{ gap: 8, flexShrink: 1 }}>
                  <TypeChip type={spotType} label={t(`types.${spotType}`, { defaultValue: spotType })} />
                  <DifficultyMarks level={difficulty} label={t(`difficulty.${difficulty}`, { defaultValue: difficulty })} />
                </View>
                {distanceText && <Text style={styles.distance}>{distanceText}</Text>}
              </View>

              {!!spot.description && <Text style={styles.desc}>{spot.description}</Text>}

              <TouchableOpacity style={styles.directionsBtn} onPress={openDirections} accessibilityRole="button">
                <GradientFill name="pink" radius={24} />
                <Ionicons name="navigate" size={22} color={Palette.ink} />
                <Text style={styles.directionsText}>{t('popup.directions')}</Text>
              </TouchableOpacity>

              <View style={styles.ratingBox}>
                <Text style={styles.ratingNumber}>{localAvgRating.toFixed(1)}</Text>
                <View style={{ flex: 1 }}>
                  <StarRating value={Math.round(localAvgRating)} size={22} label={(n) => `${n} / 5`} />
                  <Text style={styles.ratingTitle}>{t('popup.averageRating', { value: localAvgRating.toFixed(1) })}</Text>
                </View>
              </View>

              <View style={styles.rateBox}>
                <Text style={styles.rateLabel}>
                  {hasVoted ? t('popup.yourVote') : token ? t('popup.rateSpot') : t('popup.rateSpotTap')}
                </Text>
                {hasVoted ? (
                  <StarRating value={myRating} label={(n) => `${n} / 5`} />
                ) : (
                  <StarRating value={currentRating} onChange={handleStarPress} label={(n) => `${n} / 5`} />
                )}
              </View>

              {successMessage && (
                <View style={styles.successBox} accessibilityLiveRegion="polite">
                  <Ionicons name="checkmark-circle" size={20} color={Palette.positive} />
                  <Text style={styles.successText}>{successMessage}</Text>
                </View>
              )}
              {errorMessage && (
                <View style={styles.errorBox} accessibilityLiveRegion="assertive">
                  <Ionicons name="alert-circle" size={20} color={Palette.danger} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {!hasVoted && currentRating > 0 && (
                <View style={styles.commentInputBox}>
                  <TextInput
                    style={styles.input}
                    placeholder={t('popup.opinionPlaceholder')}
                    placeholderTextColor={Palette.inkMuted}
                    value={newComment}
                    onChangeText={setNewComment}
                    multiline
                    onFocus={() => {
                      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 200);
                    }}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, isSubmitting && { opacity: 0.7 }]}
                    onPress={handleSendReview}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                  >
                    <GradientFill name="pink" radius={14} />
                    {isSubmitting ? <ActivityIndicator color={Palette.ink} /> : <Text style={styles.sendText}>{t('popup.send')}</Text>}
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => setShowComments(!showComments)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showComments }}
              >
                <Text style={styles.accordionTitle}>{t('popup.comments', { count: comments.length })}</Text>
                <Ionicons name={showComments ? 'chevron-up' : 'chevron-down'} size={22} color={Palette.ink} />
              </TouchableOpacity>

              {showComments && (
                <View style={styles.commentsList}>
                  {isLoadingComments ? (
                    <ActivityIndicator size="small" color={Palette.ink} style={{ marginTop: 10 }} />
                  ) : (
                    <>
                      {commentsFailed ? (
                        <View style={styles.commentsFailed} accessibilityLiveRegion="polite">
                          <Text style={styles.noComments}>{t('popup.commentsFailed')}</Text>
                          <TouchableOpacity
                            style={styles.retryBtn}
                            onPress={reload}
                            accessibilityRole="button"
                          >
                            <Ionicons name="refresh" size={18} color={Palette.ink} />
                            <Text style={styles.retryText}>{t('common.retry')}</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        comments.length === 0 && <Text style={styles.noComments}>{cleanLabel(t('popup.firstComment'))}</Text>
                      )}
                      {comments.map((c: any, index: number) => (
                        <View key={c.id ?? index} style={styles.commentItem}>
                          <View style={styles.commentHead}>
                            <Text style={styles.commentAuthor}>{c.username || t('common.user')}</Text>
                            {c.rating > 0 && <StarRating value={c.rating} size={14} label={(n) => `${n} / 5`} />}
                          </View>
                          <Text style={styles.commentText}>{c.content}</Text>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(28,28,28,0.6)', justifyContent: 'flex-end' },
  card: { backgroundColor: Palette.sheet, borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet, maxHeight: '92%', overflow: 'hidden' },
  closeBtn: { position: 'absolute', top: 12, right: 12, zIndex: 10, backgroundColor: Palette.asphalt, width: MIN_TARGET, height: MIN_TARGET, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Palette.white },
  // Denunciar: mismo botón, a la izquierda de la X
  reportBtn: { right: 12 + MIN_TARGET + 8 },
  image: { width: '100%', height: 200 },
  imagePlaceholder: { backgroundColor: Palette.concrete, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 32 },
  title: { fontFamily: DisplayFont.black, fontSize: 36, lineHeight: 38, color: Palette.ink, textTransform: 'uppercase', letterSpacing: 0.4 },
  factsRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  distance: { fontFamily: DisplayFont.black, fontSize: 48, lineHeight: 50, color: Palette.ink },
  desc: { fontSize: 16, lineHeight: 22, color: Palette.inkMuted, marginTop: 14 },
  directionsBtn: { marginTop: 16, minHeight: 52, borderRadius: 26, backgroundColor: Palette.pink, borderWidth: 2, borderColor: Palette.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  directionsText: { fontFamily: DisplayFont.black, fontSize: 22, letterSpacing: 1, color: Palette.ink, textTransform: 'uppercase' },

  ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: Palette.hairline },
  ratingNumber: { fontFamily: DisplayFont.black, fontSize: 44, color: Palette.ink },
  ratingTitle: { fontSize: 13, color: Palette.inkMuted, marginTop: 2 },
  rateBox: { marginTop: 12, padding: 14, borderRadius: Radius.card, borderWidth: 2, borderColor: Palette.ink, gap: 6 },
  rateLabel: { fontSize: 15, fontWeight: '700', color: Palette.ink },

  successBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, marginTop: 12, backgroundColor: '#E2F4E8' },
  successText: { color: Palette.positive, fontWeight: '700', fontSize: 14, flexShrink: 1 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, marginTop: 12, backgroundColor: '#FCE8E6' },
  errorText: { color: Palette.danger, fontWeight: '700', fontSize: 14, flexShrink: 1 },

  commentInputBox: { flexDirection: 'row', gap: 10, marginTop: 14 },
  input: { flex: 1, backgroundColor: Palette.white, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, minHeight: MIN_TARGET, maxHeight: 96, borderWidth: 2, borderColor: Palette.ink, fontSize: 16, color: Palette.ink },
  sendBtn: { backgroundColor: Palette.pink, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 16, borderWidth: 2, borderColor: Palette.ink, minHeight: MIN_TARGET },
  sendText: { fontFamily: DisplayFont.black, fontSize: 18, letterSpacing: 0.8, color: Palette.ink, textTransform: 'uppercase' },

  accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: MIN_TARGET, marginTop: 14, borderBottomWidth: 1, borderBottomColor: Palette.hairline },
  accordionTitle: { fontFamily: DisplayFont.bold, fontSize: 20, letterSpacing: 0.6, color: Palette.ink, textTransform: 'uppercase' },
  commentsList: { paddingTop: 10 },
  commentsFailed: { alignItems: 'center', gap: 4 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TARGET, paddingHorizontal: 16, borderRadius: Radius.control, borderWidth: 2, borderColor: Palette.ink },
  retryText: { fontFamily: DisplayFont.bold, fontSize: 18, letterSpacing: 0.6, textTransform: 'uppercase', color: Palette.ink },
  noComments: { color: Palette.inkMuted, textAlign: 'center', marginTop: 10, fontSize: 15 },
  commentItem: { padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: Palette.hairline },
  commentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commentAuthor: { fontWeight: '700', fontSize: 14, color: Palette.ink },
  commentText: { fontSize: 15, lineHeight: 21, color: Palette.inkMuted },
});
