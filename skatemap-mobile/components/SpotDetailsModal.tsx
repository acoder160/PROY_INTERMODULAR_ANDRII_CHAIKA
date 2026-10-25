import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import api from '../utils/api';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function SpotDetailsModal({ visible, onClose, spot, token, onSpotUpdated }: any) {
  const { t } = useTranslation();
  const router = useRouter();
  const [comments, setComments] = useState<any[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  
  const [hasVoted, setHasVoted] = useState(false);
  const [myRating, setMyRating] = useState(0); 
  const [currentRating, setCurrentRating] = useState(0); 
  
  // Controla la nota media visualmente
  const [localAvgRating, setLocalAvgRating] = useState(0); 
  
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Referencia al ScrollView para hacer auto-scroll
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible && spot) {
      setCurrentRating(0);
      setNewComment('');
      setSuccessMessage(null);
      setShowComments(false);
      
      // Resetea la nota visual con la del spot actual
      setLocalAvgRating(spot.surfaceRating || 0);
      
      fetchData();
    }
  }, [visible, spot, token]);

  const fetchData = async () => {
    setIsLoadingComments(true);
    try {
      // 1. Solo comprobamos si ya ha votado cuando el usuario tiene sesión iniciada (token)
      if (token) {
        try {
          const ratingRes = await api.get(`/ratings/check/${spot.id}`, {
            headers: { 
              Authorization: `Bearer ${token}`,
              "ngrok-skip-browser-warning": "true"
            }
          });
          if (ratingRes.data && ratingRes.data.value > 0) {
            setMyRating(ratingRes.data.value);
            setHasVoted(true);
          } else {
            setHasVoted(false);
          }
        } catch (e) {
          setHasVoted(false);
        }
      } else {
        setHasVoted(false);
        setMyRating(0);
      }

      // 2. Los comentarios se cargan siempre (con o sin token)
      const commentsRes = await api.get(`/comments/spot/${spot.id}`, {
        headers: token ? { 
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true"
        } : {
          "ngrok-skip-browser-warning": "true"
        }
      });
      setComments(commentsRes.data);
    } catch (e) {
      console.error("Error cargando datos del spot", e);
    } finally {
      setIsLoadingComments(false);
    }
  };

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
      
      await fetchData();
      onSpotUpdated(); 
      setShowComments(true); 
      
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.response?.data;
      alert(typeof errorMsg === 'string' ? errorMsg : t('popup.sendErrorConnection'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!spot) return null;

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      {/* KeyboardAvoidingView configurado */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={styles.overlay}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0} // Espacio extra para iOS
      >
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
          
          <ScrollView 
            ref={scrollViewRef} // Asignamos la referencia
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled" // IMPORTANTE para poder hacer clic en "Enviar" mientras el teclado está abierto
          >
            <Image source={{ uri: spot.mediaUrl || 'https://via.placeholder.com/400x200' }} style={styles.image} />
            
            <View style={styles.content}>
              <Text style={styles.title}>{spot.name}</Text>
              <Text style={styles.desc}>{spot.description}</Text>

              <View style={styles.ratingBox}>
                <Text style={styles.ratingTitle}>{t('popup.averageRating', { value: localAvgRating.toFixed(1) })}</Text>
                
                {hasVoted ? (
                    <View style={{ alignItems: 'center', marginTop: 10 }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#2ed573', marginBottom: 5 }}>✅ {t('popup.yourVote')}</Text>
                      <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map(star => (
                           <Text key={star} style={star <= myRating ? styles.starFull : styles.starEmpty}>★</Text>
                        ))}
                      </View>
                    </View>
                ) : (
                    <View style={{ alignItems: 'center', marginTop: 10 }}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#888', marginBottom: 5 }}>
                          {token ? t('popup.rateSpot') : t('popup.rateSpotTap')}
                        </Text>
                        <View style={styles.starsRow}>
                          {[1, 2, 3, 4, 5].map(star => (
                            <TouchableOpacity 
                                key={star} 
                                onPress={() => handleStarPress(star)}
                            >
                              <Text style={star <= currentRating ? styles.starFull : styles.starEmpty}>★</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                    </View>
                )}
              </View>

              {successMessage && (
                  <View style={styles.successBox}>
                      <Text style={styles.successText}>{successMessage}</Text>
                  </View>
              )}

              {!hasVoted && currentRating > 0 && (
                  <View style={styles.commentInputBox}>
                    <TextInput 
                        style={styles.input} 
                        placeholder={t('popup.opinionPlaceholder')} 
                        value={newComment} 
                        onChangeText={setNewComment} 
                        multiline 
                        // Cuando toca el input, aseguramos que esté a la vista
                        onFocus={() => {
                           setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 200);
                        }}
                    />
                    <TouchableOpacity style={styles.sendBtn} onPress={handleSendReview} disabled={isSubmitting}>
                      {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>{t('popup.send')}</Text>}
                    </TouchableOpacity>
                  </View>
              )}

              <TouchableOpacity style={styles.accordionHeader} onPress={() => setShowComments(!showComments)}>
                <Text style={styles.accordionTitle}>{t('popup.comments', { count: comments.length })}</Text>
                <Text>{showComments ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {showComments && (
                <View style={styles.commentsList}>
                  {isLoadingComments ? (
                     <ActivityIndicator size="small" color="#007AFF" style={{marginTop: 10}} />
                  ) : (
                    <>
                      {comments.length === 0 && <Text style={styles.noComments}>{t('popup.firstComment')}</Text>}
                      {comments.map((c: any, index: number) => (
                        <View key={index} style={styles.commentItem}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text style={styles.commentAuthor}>{c.username || t('common.user')}</Text>
                              {c.rating > 0 && (
                                  <Text style={{ color: '#f1c40f', fontSize: 10 }}>{'★'.repeat(c.rating)}</Text>
                              )}
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

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 25, borderTopRightRadius: 25, maxHeight: '90%' },
  closeBtn: { position: 'absolute', top: 15, right: 15, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  closeText: { color: 'white', fontWeight: 'bold' },
  image: { width: '100%', height: 200, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  desc: { fontSize: 14, color: '#666', marginBottom: 20 },
  
  ratingBox: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#eee' },
  ratingTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  starsRow: { flexDirection: 'row', gap: 10 },
  starFull: { fontSize: 35, color: '#f1c40f' },
  starEmpty: { fontSize: 35, color: '#e0e0e0' },
  
  successBox: { backgroundColor: '#e3fce8', padding: 12, borderRadius: 8, marginBottom: 15, alignItems: 'center', borderWidth: 1, borderColor: '#2ed573' },
  successText: { color: '#2ed573', fontWeight: 'bold', fontSize: 13 },
  
  commentInputBox: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  input: { flex: 1, backgroundColor: '#f9f9f9', borderRadius: 15, paddingHorizontal: 15, paddingVertical: 12, maxHeight: 80, borderWidth: 1, borderColor: '#ddd' },
  sendBtn: { backgroundColor: '#2ed573', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 15 },
  sendText: { color: 'white', fontWeight: 'bold' },
  
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  accordionTitle: { fontWeight: 'bold', color: '#0984e3' },
  commentsList: { paddingTop: 10 },
  noComments: { color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: 10 },
  commentItem: { backgroundColor: '#f8f9fa', padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  commentAuthor: { fontWeight: 'bold', fontSize: 12, color: '#333', marginBottom: 3 },
  commentText: { fontSize: 14, color: '#555' }
});