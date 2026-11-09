// Datos del responsable para la página /legal (aviso legal, normas y privacidad).
// Rellénalos en skatemap-web/.env (no se suben al repositorio):
//   VITE_OPERATOR_NAME=Tu nombre
//   VITE_CONTACT_EMAIL=tu@email.com
// Mientras falten se muestran estos marcadores, para que se note que hay que completarlos.
export const LEGAL = {
  operator: import.meta.env.VITE_OPERATOR_NAME?.trim() || '[Operator name]',
  email: import.meta.env.VITE_CONTACT_EMAIL?.trim() || 'contact@example.com',
  updated: '2026-11-09',
};
