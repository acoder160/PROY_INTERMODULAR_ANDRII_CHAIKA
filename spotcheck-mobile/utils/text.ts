/**
 * Some translations carry decorative emoji or symbols ("New spot 📍", "✕ Cancel", "Description...").
 * The UI draws its own icons, so labels drop leading and trailing non-letter characters.
 */
export function cleanLabel(text: string): string {
  return text.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '');
}
