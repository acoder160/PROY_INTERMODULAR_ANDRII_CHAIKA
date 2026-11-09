// Una pintura por tipo de spot (regla Colour-Is-Type, ver DESIGN.md)
export const SPOT_TYPE_PAINT = {
  STREET: 'var(--paint-orange)',
  RAIL: 'var(--paint-yellow)',
  RAMPS: 'var(--paint-blue)',
  PARK: 'var(--paint-green)',
  SKATEPARK: 'var(--paint-green)',
  LEDGE: 'var(--sheet)',
};

// Algunas traducciones llevan emoji o símbolos decorativos ("✕ Cancel"); la interfaz dibuja sus iconos
export function cleanLabel(text) {
  return String(text ?? '').replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '');
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const directionsUrl = (spot) =>
  `https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}&travelmode=walking`;

export const DEFAULT_FILTERS = { spotType: 'ALL', minRating: 0, maxDistance: 0 };
