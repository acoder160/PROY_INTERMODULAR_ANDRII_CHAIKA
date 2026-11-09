import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, useWindowDimensions, TextInput, ActivityIndicator } from 'react-native';
import api from '../../utils/api';
import { cleanLabel } from '../../utils/text';
import { useAuth } from '../../context/AuthContext';
import SkateMap from '../../components/skatemap';
import SpotFormModal from '../../components/SpotFormModal';
import CameraOverlay from '../../components/CameraOverlay';
import { uploadImageToCloudinary } from '../../utils/cloudinary';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Palette, DisplayFont, MIN_TARGET } from '../../constants/theme';
import GradientFill from '../../components/ui/GradientFill';
import { useLocation } from '../../hooks/useLocation';
import { useSpots } from '../../hooks/useSpots';
import { useLiveCounts } from '../../hooks/useLiveCounts';
import SpotDetailsModal from '../../components/SpotDetailsModal';
import FilterModal, { DEFAULT_FILTERS, type FilterState } from '../../components/FilterModal';
import LanguageModal from '../../components/LanguageModal';
import { useTranslation } from 'react-i18next';
import MapFab from '../../components/MapFab';
import ReportModal from '../../components/ReportModal';

// Errores de moderación que el backend envía con un código: se muestran traducidos
const MODERATION_ERRORS: Record<string, string> = {
  photo_rejected: 'errors.photoRejected',
  photo_unclear: 'errors.photoUnclear',
  photo_not_place: 'errors.photoNotPlace',
  text_rejected: 'errors.textRejected',
};

/** The spot list DTO, as far as the search results need it. */
interface SearchResult {
  filters: {
    types: string[];
    difficulty: string[];
    minRating: number;
    distanceKm: number;
    keywords: string[];
  };
  aiUsed: boolean;
  spots: any[];
}

const NO_FAVORITES: number[] = [];

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user, token, isAdmin } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  
  const { userLocation, handleRecenter } = useLocation();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef<any>(null); 
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [isAddingMode, setIsAddingMode] = useState(false);
  const [newSpotLocation, setNewSpotLocation] = useState<{lat: number, lng: number} | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', spotType: 'STREET', difficultyLevel: 'INTERMEDIATE' });
  
  const [selectedSpot, setSelectedSpot] = useState<any | null>(null);
  const [reportSpot, setReportSpot] = useState<any | null>(null);
  const closeReport = useCallback(() => setReportSpot(null), []);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const { spots, fetchSpots, isOffline } = useSpots(token);
  const [extraSpots, setExtraSpots] = useState<any[]>([]);
  const [focus, setFocus] = useState<{ lat: number; lng: number; id: number } | null>(null);
  const liveCounts = useLiveCounts();

  // Saved spots: one list for the map popup and the spot sheet, so both always agree
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    api.get('/favorites')
      .then((res) => { if (!cancelled && Array.isArray(res.data)) setFavoriteIds(res.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);
  const visibleFavoriteIds = token ? favoriteIds : NO_FAVORITES;

  const toggleFavorite = useCallback(async (spotId: number) => {
    if (!token) {
      Alert.alert(t('auth.loginRequiredTitle'), undefined, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.login'), onPress: () => router.push('/login') },
      ]);
      return;
    }
    const saved = favoriteIds.includes(spotId);
    const apply = (on: boolean) => setFavoriteIds((prev) => (on ? [...prev.filter((id) => id !== spotId), spotId] : prev.filter((id) => id !== spotId)));
    apply(!saved);
    try {
      if (saved) await api.delete(`/favorites/${spotId}`);
      else await api.put(`/favorites/${spotId}`);
    } catch {
      apply(saved); // put it back
    }
  }, [token, favoriteIds, router, t]);

  // ?spot=123 from the feed, a profile, a notification or a push: fly there and open it. A spot the
  // cached list doesn't have yet (just added, or the list is stale) is fetched on its own.
  const { spot: spotParam } = useLocalSearchParams<{ spot?: string }>();
  const linkedSpotId = Number(spotParam) || null;
  useEffect(() => {
    if (!linkedSpotId) return undefined;
    let cancelled = false;
    const open = (spot: any) => {
      setSelectedSpot(spot);
      setFocus({ lat: spot.latitude, lng: spot.longitude, id: spot.id });
      router.setParams({ spot: undefined } as any);
    };
    const known = spots.find((s: any) => s.id === linkedSpotId);
    if (known) {
      open(known);
    } else {
      api.get(`/spots/${linkedSpotId}`)
        .then((res) => {
          if (cancelled) return;
          setExtraSpots((prev) => (prev.some((s) => s.id === res.data.id) ? prev : [...prev, res.data]));
          open(res.data);
        })
        .catch(() => { if (!cancelled) router.setParams({ spot: undefined } as any); });
    }
    return () => { cancelled = true; };
  }, [linkedSpotId, spots, router]);

  // Estados para los filtros
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);

  // The photo is uploaded as soon as it is taken, so the AI can suggest the form's values while the
  // user types, and a "create anyway" retry doesn't upload it again
  const [suggesting, setSuggesting] = useState(false);
  const flowRef = useRef(0); // bumps on every new photo or reset: late answers are dropped
  const uploadRef = useRef<Promise<string> | null>(null);
  const editedRef = useRef<Set<string>>(new Set()); // type / level chosen by the user: the AI leaves them alone

  // Search in plain words
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);

  const runSearch = async () => {
    const query = searchText.trim();
    if (!query || searching) return;
    setSearching(true);
    setSearchFailed(false);
    try {
      const res = await api.post('/search', {
        query,
        lat: userLocation?.lat,
        lng: userLocation?.lng,
      });
      const result = res.data as SearchResult;
      setSearchResult(result);
      const best = result.spots[0];
      if (best) setFocus({ lat: best.latitude, lng: best.longitude, id: best.id });
    } catch {
      setSearchResult(null);
      setSearchFailed(true);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchText('');
    setSearchResult(null);
    setSearchFailed(false);
  };

  // Lógica para recargar spots (ahora funciona también sin token para invitados)
  const handleReloadSpots = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);

    try {
      await fetchSpots();
    } catch (error) {
      console.error("Error recargando spots:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      handleReloadSpots();
    }, [token, fetchSpots])
  );

  useEffect(() => { 
    handleRecenter(true, setStatusMessage); 
  }, [handleRecenter]);

  const startAddingProcess = async () => {
    // Si el usuario NO está autenticado, le pedimos iniciar sesión antes de abrir la cámara
    if (!user || !token) {
      Alert.alert(
        t('auth.loginRequiredTitle'),
        t('auth.loginRequiredAdd'),
        [
          { text: t('common.cancel'), style: "cancel" },
          { text: t('common.login'), onPress: () => router.push('/login') }
        ]
      );
      return;
    }

    if (isAddingMode) {
      handleCloseForm();
      return;
    }

    setStatusMessage(t('status.preparingCamera'));
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        setStatusMessage(null);
        Alert.alert(cleanLabel(t('status.cameraDenied')), undefined, [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.openSettings'), onPress: () => { Linking.openSettings().catch(() => {}); } },
        ]);
        return;
      }
    }
    
    let loc = userLocation;
    if (!loc) {
        setStatusMessage(t('status.waitingGps'));
        loc = await handleRecenter(true, setStatusMessage);
        if(!loc) return; 
    }

    setStatusMessage(null);
    setShowCamera(true); 
  };

  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (statusTimer.current) clearTimeout(statusTimer.current); }, []);

  // Aviso breve en la píldora de estado (sustituye a los alert() de éxito)
  const showStatus = (message: string) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatusMessage(message);
    statusTimer.current = setTimeout(() => setStatusMessage(null), 3000);
  };

  const resetAddFlow = () => {
    flowRef.current += 1;
    uploadRef.current = null;
    setSuggesting(false);
    setModalVisible(false); setIsAddingMode(false); setNewSpotLocation(null); setCapturedPhoto(null); setStatusMessage(null);
    setFormError(null);
    setFormData({ name: '', description: '', spotType: 'STREET', difficultyLevel: 'INTERMEDIATE' });
  };

  // Cerrar el formulario con una foto hecha la perdería: se pide confirmación
  const handleCloseForm = () => {
    if (!capturedPhoto) { resetAddFlow(); return; }
    Alert.alert(t('form.discardTitle'), t('form.discardMessage'), [
      { text: t('form.keepEditing'), style: 'cancel' },
      { text: t('form.discard'), style: 'destructive', onPress: resetAddFlow },
    ]);
  };


  /** Uploads the photo now and asks the AI for tags; the form stays editable the whole time. */
  const startUploadAndSuggest = (uri: string) => {
    const flow = ++flowRef.current;
    editedRef.current = new Set();
    const upload = uploadImageToCloudinary(uri);
    uploadRef.current = upload;
    upload
      .then(async (url) => {
        if (flow !== flowRef.current) return;
        setSuggesting(true);
        try {
          const res = await api.post('/ai/suggest-tags', { mediaUrl: url });
          const tags = res.data as { available: boolean; spotType?: string; difficulty?: string; name?: string; description?: string };
          if (flow !== flowRef.current || !tags?.available) return;
          // Only fill what is still empty: whatever the user already typed or picked wins
          setFormData((prev) => ({
            ...prev,
            name: prev.name.trim() ? prev.name : tags.name ?? prev.name,
            description: prev.description.trim() ? prev.description : tags.description ?? prev.description,
            spotType: !editedRef.current.has('spotType') && tags.spotType ? tags.spotType : prev.spotType,
            difficultyLevel: !editedRef.current.has('difficultyLevel') && tags.difficulty ? tags.difficulty : prev.difficultyLevel,
          }));
        } catch {
          // no suggestion: the user fills the form as before
        } finally {
          if (flow === flowRef.current) setSuggesting(false);
        }
      })
      .catch(() => {}); // an upload failure shows up on save, which retries it
  };

  const onFormChange = (next: typeof formData) => {
    if (next.spotType !== formData.spotType) editedRef.current.add('spotType');
    if (next.difficultyLevel !== formData.difficultyLevel) editedRef.current.add('difficultyLevel');
    setFormData(next);
  };

  const ensureUploaded = async (uri: string): Promise<string> => {
    if (uploadRef.current) {
      try {
        return await uploadRef.current;
      } catch {
        // the early upload failed: try once more now
      }
    }
    const retry = uploadImageToCloudinary(uri);
    uploadRef.current = retry;
    return retry;
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      setStatusMessage(t('status.processingPhoto'));
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      setCapturedPhoto(photo.uri);
      startUploadAndSuggest(photo.uri);
      setShowCamera(false);
      setIsAddingMode(true);
      setStatusMessage(t('status.tapCircle'));
      handleRecenter(true, setStatusMessage); 
    }
  };

  const handleSaveSpot = async (force = false) => {
    if (!user || !token) {
      router.push('/login');
      return;
    }
    setFormError(null);
    if (!newSpotLocation || !formData.name.trim() || !capturedPhoto) { setFormError(t('errors.missingData')); return; }

    setIsUploading(true);
    let finalImageUrl: string;

    try {
      finalImageUrl = await ensureUploaded(capturedPhoto);
    } catch {
      setFormError(t('errors.uploadFailed'));
      setIsUploading(false); return;
    }

    try {
      await api.post(`/spots`, {
        ...formData, latitude: newSpotLocation.lat, longitude: newSpotLocation.lng, mediaUrl: finalImageUrl,
        ...(force ? { force: true } : {}),
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      resetAddFlow();
      showStatus(cleanLabel(t('errors.spotCreated')));
      fetchSpots();
    } catch (error: any) {
      const data = error.response?.data;
      if (data?.code === 'duplicate_candidate' && data.candidate) {
        promptDuplicate(data.candidate, data.meters);
        return;
      }
      // A refused photo is deleted by the server: the next save has to upload it again
      if (typeof data?.code === 'string' && data.code.startsWith('photo_')) uploadRef.current = null;
      const serverError = error.response?.data?.error; // Captura errores de Bucket4j
      const serverMessage = error.response?.data?.message; // Captura errores de IA o Validación
      const moderationKey = MODERATION_ERRORS[error.response?.data?.code];

      const finalMsg = (moderationKey && t(moderationKey)) || serverError || serverMessage ||
        (typeof error.response?.data === 'string' ? error.response?.data : null);

      // El formulario sigue abierto con los datos y la foto: el usuario puede reintentar
      setFormError(finalMsg || t('errors.saveFailed'));
    } finally {
      setIsUploading(false); 
    }
  };

  /** "Is this the same spot?": open the existing one, or create it anyway (force). */
  const promptDuplicate = (candidate: any, meters: number) => {
    Alert.alert(
      t('duplicate.title'),
      t('duplicate.message', { name: candidate.name, meters: Math.round(Number(meters) || 0) }),
      [
        {
          text: t('duplicate.openExisting'),
          onPress: () => {
            resetAddFlow();
            setExtraSpots((prev) => (prev.some((s) => s.id === candidate.id) ? prev : [...prev, candidate]));
            setSelectedSpot(candidate);
            setFocus({ lat: candidate.latitude, lng: candidate.longitude, id: candidate.id });
          },
        },
        { text: t('duplicate.createAnyway'), onPress: () => { handleSaveSpot(true); } },
        { text: t('common.cancel'), style: 'cancel' },
      ],
    );
  };

  // --- LÓGICA DE FILTRADO (Haversine Formula) ---
  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radio de la tierra en km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const activeFilterCount = (filters.spotType !== 'ALL' ? 1 : 0) + (filters.minRating > 0 ? 1 : 0) + (filters.maxDistance > 0 ? 1 : 0);

  // Spots opened by link that the cached list does not have yet
  const allSpots = extraSpots.length ? [...spots, ...extraSpots.filter((x) => !spots.some((s: any) => s.id === x.id))] : spots;
  const filteredSpots = searchResult ? searchResult.spots : allSpots.filter((spot: any) => {
    // Filtro por tipo
    if (filters.spotType !== 'ALL' && spot.spotType !== filters.spotType && spot.type !== filters.spotType) return false;
    
    // Filtro por valoración (estrellas)
    if (filters.minRating > 0 && (spot.surfaceRating || 0) < filters.minRating) return false;

    // Filtro por distancia (si hay ubicación de usuario)
    if (filters.maxDistance > 0 && userLocation) {
      const distance = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, spot.latitude, spot.longitude);
      if (distance > filters.maxDistance) return false;
    }

    return true;
  });

  return (
    <View style={[styles.container, { flex: 1 }]}>
      
      <View style={styles.mapContainer}>
        <SkateMap 
          spots={filteredSpots} 
          userLocation={userLocation} 
          isAddingMode={isAddingMode} 
          onMapClick={(lat, lng) => { setNewSpotLocation({lat, lng}); setModalVisible(true); }}
          onNotice={showStatus}
          focus={focus}
          onSpotClick={(spotId) => {
             const spot = allSpots.find((s: any) => s.id === spotId);
             if (spot) setSelectedSpot(spot);
          }}
          favoriteIds={token ? favoriteIds : null}
          onToggleFavorite={toggleFavorite}
          liveCounts={liveCounts}
        />
      </View>

      {/* Barra superior asfalto: filtros (izquierda) y cuenta (derecha) */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <GradientFill name="topBar" />
        <TouchableOpacity
          onPress={() => setFilterModalVisible(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={activeFilterCount > 0 ? `${t('map.filtersActive')}: ${activeFilterCount}` : t('map.filters')}
          style={[styles.pill, styles.filterPill]}
        >
          <Ionicons name="options" size={20} color={Palette.white} />
          <Text style={styles.pillText} numberOfLines={1}>{t('map.filters')}</Text>
          {activeFilterCount > 0 && (
            <View style={styles.countBadge}><Text style={styles.countBadgeText}>{activeFilterCount}</Text></View>
          )}
        </TouchableOpacity>

        <View style={styles.barRight}>
        <TouchableOpacity
          onPress={() => setLanguageModalVisible(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('common.language')}
          style={styles.globeBtn}
        >
          <Ionicons name="globe-outline" size={22} color={Palette.white} />
        </TouchableOpacity>

        {isAdmin && (
          <TouchableOpacity
            onPress={() => router.push('/admin')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('admin.moderation')}
            style={styles.globeBtn}
          >
            <Ionicons name="shield-checkmark-outline" size={22} color={Palette.white} />
          </TouchableOpacity>
        )}

        {user ? (
          <TouchableOpacity
            onPress={() => router.navigate('/(tabs)/profile' as any)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={user}
            accessibilityHint={t('social.profile')}
            style={[styles.pill, styles.userPill, styles.accountGroup]}
          >
            <Ionicons name="person" size={18} color={Palette.ink} />
            <Text style={[styles.pillText, styles.userPillText]} numberOfLines={1}>{user}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.push('/login')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('map.enter')}
            style={[styles.pill, styles.userPill, styles.accountGroup]}
          >
            <Ionicons name="person" size={18} color={Palette.ink} />
            <Text style={[styles.pillText, styles.userPillText]} numberOfLines={1}>{t('map.enter')}</Text>
          </TouchableOpacity>
        )}
        </View>
      </View>

      {/* Search in plain words ("smooth ledges for beginners near me") */}
      <View style={[styles.searchRow, { top: insets.top + 8 + 56 + 8 }]}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={Palette.ink} />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder={t('search.placeholder')}
            placeholderTextColor="#5b5b5b"
            returnKeyType="search"
            onSubmitEditing={runSearch}
            maxLength={200}
            autoCorrect={false}
            accessibilityLabel={t('search.submit')}
          />
          {searching ? (
            <ActivityIndicator size="small" color={Palette.ink} />
          ) : (searchText.length > 0 || searchResult || searchFailed) ? (
            <TouchableOpacity onPress={clearSearch} accessibilityRole="button" accessibilityLabel={t('search.clear')} hitSlop={10}>
              <Ionicons name="close-circle" size={22} color={Palette.ink} />
            </TouchableOpacity>
          ) : null}
        </View>
        {(searchResult || searchFailed) && (
          <View style={styles.searchInfo} accessibilityLiveRegion="polite">
            <Text style={styles.searchInfoText}>
              {searchFailed
                ? t('search.failed')
                : searchResult && searchResult.spots.length === 0
                  ? t('search.noResults')
                  : t('search.results', { count: searchResult?.spots.length ?? 0 })}
            </Text>
            {searchResult && (
              <View style={styles.chipRow}>
                {[
                  ...searchResult.filters.types.map((x) => t(`types.${x}`, { defaultValue: x })),
                  ...searchResult.filters.difficulty.map((x) => t(`difficulty.${x}`, { defaultValue: x })),
                  ...(searchResult.filters.minRating > 0 ? [t('search.chipRating', { value: searchResult.filters.minRating })] : []),
                  ...(searchResult.filters.distanceKm > 0 ? [t('search.chipDistance', { km: searchResult.filters.distanceKm })] : []),
                  ...searchResult.filters.keywords,
                ].map((chip, i) => (
                  <View key={`${chip}-${i}`} style={styles.chip}><Text style={styles.chipText}>{chip}</Text></View>
                ))}
                {!searchResult.aiUsed && <Text style={styles.searchHint}>{t('search.noAi')}</Text>}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Avisos: modo offline */}
      <View pointerEvents="none" style={[styles.notices, { top: insets.top + 8 + 56 + 12 + (searchResult || searchFailed ? 130 : 56) }]}>
        {isOffline && (
          <View style={styles.offlineBadge}>
            <Ionicons name="cloud-offline" size={16} color={Palette.ink} />
            <Text style={styles.offlineText}>{t('map.offlineMode')}</Text>
          </View>
        )}
      </View>

      {(statusMessage || (isAddingMode && !newSpotLocation)) && (
        <View style={[styles.addingNotice, { bottom: insets.bottom + 108 }]} accessibilityLiveRegion="polite">
          <Text style={styles.addingNoticeText}>{cleanLabel(statusMessage || t('status.tapCircle'))}</Text>
        </View>
      )}

      {/* Recargar (abajo a la izquierda) */}
      <MapFab
        icon="refresh"
        label={t('map.reloadSpots')}
        onPress={handleReloadSpots}
        spinning={isRefreshing}
        style={{ left: 20, bottom: insets.bottom + 32 }}
      />

      {/* Centrar GPS (abajo a la derecha) */}
      <MapFab
        icon="locate"
        label={t('map.centerOnMe')}
        onPress={() => handleRecenter(false, setStatusMessage)}
        style={{ right: 20, bottom: insets.bottom + 32 }}
      />

      {/* Añadir spot (centro abajo): la acción principal, pintura rosa */}
      <TouchableOpacity
        style={[
          styles.fab,
          isAddingMode ? styles.fabClose : styles.fabAdd,
          // Nunca encima de los botones laterales: 20px de margen + 56px de botón + 10px de aire a cada lado
          { bottom: insets.bottom + 32, maxWidth: windowWidth - 2 * (20 + 56 + 10) },
        ]}
        onPress={startAddingProcess}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={isAddingMode ? t('map.cancelAddSpot') : t('map.addSpot')}
      >
        {!isAddingMode && <GradientFill name="pink" radius={14} />}
        <Ionicons name={isAddingMode ? 'close' : 'add'} size={28} color={isAddingMode ? Palette.white : Palette.ink} />
        {!isAddingMode && (
          <Text style={styles.fabText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {t('map.addSpot')}
          </Text>
        )}
      </TouchableOpacity>

      {/* MODALES */}
      <SpotFormModal 
        visible={modalVisible}
        onClose={handleCloseForm}
        onSave={() => { handleSaveSpot(); }}
        formData={formData}
        setFormData={onFormChange}
        capturedPhoto={capturedPhoto}
        isUploading={isUploading}
        errorMessage={formError}
        suggesting={suggesting}
      />

      <SpotDetailsModal
        key={selectedSpot?.id ?? 'none'}
        visible={!!selectedSpot}
        spot={selectedSpot} 
        token={token}
        userLocation={userLocation}
        onClose={() => setSelectedSpot(null)} 
        onSpotUpdated={() => { fetchSpots(); }}
        onSpotDeleted={() => { setExtraSpots([]); fetchSpots(); }}
        onReport={() => { setReportSpot(selectedSpot); setSelectedSpot(null); }}
        isFavorite={!!selectedSpot && visibleFavoriteIds.includes(selectedSpot.id)}
        liveCount={selectedSpot ? liveCounts[selectedSpot.id] ?? 0 : 0}
        onToggleFavorite={toggleFavorite}
      />

      {reportSpot && <ReportModal key={reportSpot.id} spot={reportSpot} onClose={closeReport} />}

      <FilterModal 
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        setFilters={setFilters}
        resultCount={filteredSpots.length}
        hasLocation={!!userLocation}
      />

      <LanguageModal visible={languageModalVisible} onClose={() => setLanguageModalVisible(false)} />

      {showCamera && (
        <CameraOverlay cameraRef={cameraRef} onCapture={takePicture} onCancel={() => { setShowCamera(false); setStatusMessage(null); }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.concrete },
  mapContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flex: 1, elevation: 0 },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: Palette.asphalt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    zIndex: 10,
    elevation: 6,
  },
  pill: {
    minHeight: MIN_TARGET,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Palette.white,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillText: {
    fontFamily: DisplayFont.bold,
    fontSize: 18,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Palette.white,
    flexShrink: 1,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: Palette.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: { fontFamily: DisplayFont.black, fontSize: 15, color: Palette.ink },
  accountGroup: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterPill: { flexShrink: 1 },
  barRight: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  globeBtn: {
    width: MIN_TARGET,
    height: MIN_TARGET,
    borderRadius: MIN_TARGET / 2,
    borderWidth: 2,
    borderColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userPill: { backgroundColor: Palette.white, borderColor: Palette.white, flexShrink: 1 },
  userPillText: { color: Palette.ink, maxWidth: 140 },

  searchRow: { position: 'absolute', left: 16, right: 16, zIndex: 10, gap: 6 },
  searchBox: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Palette.ink,
    backgroundColor: Palette.white,
  },
  searchInput: { flex: 1, fontSize: 16, color: Palette.ink, paddingVertical: 8 },
  searchInfo: {
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Palette.white,
    backgroundColor: Palette.asphalt,
  },
  searchInfoText: { color: Palette.white, fontSize: 14, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: { paddingVertical: 2, paddingHorizontal: 10, borderRadius: 12, backgroundColor: Palette.pink },
  chipText: { color: Palette.ink, fontSize: 13, fontWeight: '700' },
  searchHint: { color: Palette.white, fontSize: 12, opacity: 0.85 },

  notices: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 10 },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Palette.yellow,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  offlineText: { color: Palette.ink, fontSize: 14, fontWeight: '700', flexShrink: 1 },

  addingNotice: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '88%',
    backgroundColor: Palette.asphalt,
    borderWidth: 2,
    borderColor: Palette.white,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 22,
    zIndex: 10,
  },
  addingNoticeText: { color: Palette.white, fontSize: 15, fontWeight: '700', textAlign: 'center' },

  fab: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 10,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Palette.ink,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabAdd: { backgroundColor: Palette.pink, paddingHorizontal: 16, minWidth: 144 },
  fabClose: { backgroundColor: Palette.asphalt, width: 56, borderColor: Palette.white },
  fabText: { fontFamily: DisplayFont.black, fontSize: 22, letterSpacing: 0.8, textTransform: 'uppercase', color: Palette.ink, flexShrink: 1 },
});
