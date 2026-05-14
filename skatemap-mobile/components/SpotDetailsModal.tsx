import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, Image, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard } from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '../constants/api';

export default function SpotDetailsModal({ visible, onClose, spot, token, onSpotUpdated }: any) {
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
    if (visible && spot && token) {
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
      try {
        const ratingRes = await axios.get(`${API_BASE_URL}/api/ratings/check/${spot.id}`, {
          headers: { Authorization: `Bearer ${token}` }
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

      const commentsRes = await axios.get(`${API_BASE_URL}/api/comments/spot/${spot.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(commentsRes.data);
    } catch (e) {
      console.error("Error cargando datos del spot", e);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleSendReview = async () => {
    setIsSubmitting(true);
    setSuccessMessage(null);
    try {
      // Guardamos lo que devuelve Spring Boot
      const response = await axios.post(`${API_BASE_URL}/api/ratings/${spot.id}`, { value: currentRating }, { 
        headers: { Authorization: `Bearer ${token}` } 
      });

      if (newComment.trim().length > 0) {
        await axios.post(`${API_BASE_URL}/api/comments/${spot.id}`, { content: newComment }, { 
          headers: { Authorization: `Bearer ${token}` } 
        });
      }

      setHasVoted(true);
      setMyRating(currentRating);
      setSuccessMessage("¡Gracias por tu valoración! 🛹");
      
      if (response.data && response.data.newAverage) {
         setLocalAvgRating(response.data.newAverage);
      }
      
      await fetchData();
      onSpotUpdated(); 
      setShowComments(true); 
      
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.response?.data;
      alert(typeof errorMsg === 'string' ? errorMsg : 'Hubo un error al enviar. Por favor, revisa tu conexión.');
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
                {}
                <Text style={styles.ratingTitle}>Puntuación media: {localAvgRating.toFixed(1)}/5</Text>
                
                {hasVoted ? (
                    <View style={{ alignItems: 'center', marginTop: 10 }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#2ed573', marginBottom: 5 }}>✅ Tu voto:</Text>
                      <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map(star => (
                           <Text key={star} style={star <= myRating ? styles.starFull : styles.starEmpty}>★</Text>
                        ))}
                      </View>
                    </View>
                ) : (
                    <View style={{ alignItems: 'center', marginTop: 10 }}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#888', marginBottom: 5 }}>Valora este spot:</Text>
                        <View style={styles.starsRow}>
                          {[1, 2, 3, 4, 5].map(star => (
                            <TouchableOpacity 
                                key={star} 
                                onPress={() => {
                                    setCurrentRating(star);
                                    // Bajamos suavemente para que vea el input
                                    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
                                }}
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
                        placeholder="Escribe tu opinión (opcional)..." 
                        value={newComment} 
                        onChangeText={setNewComment} 
                        multiline 
                        // Cuando toca el input, aseguramos que esté a la vista
                        onFocus={() => {
                           setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 200);
                        }}
                    />
                    <TouchableOpacity style={styles.sendBtn} onPress={handleSendReview} disabled={isSubmitting}>
                      {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>Enviar</Text>}
                    </TouchableOpacity>
                  </View>
              )}

              <TouchableOpacity style={styles.accordionHeader} onPress={() => setShowComments(!showComments)}>
                <Text style={styles.accordionTitle}>Ver {comments.length} Comentarios</Text>
                <Text>{showComments ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {showComments && (
                <View style={styles.commentsList}>
                  {isLoadingComments ? (
                     <ActivityIndicator size="small" color="#007AFF" style={{marginTop: 10}} />
                  ) : (
                    <>
                      {comments.length === 0 && <Text style={styles.noComments}>Sé el primero en comentar.</Text>}
                      {comments.map((c: any, index: number) => (
                        <View key={index} style={styles.commentItem}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text style={styles.commentAuthor}>{c.username || 'Usuario'}</Text>
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