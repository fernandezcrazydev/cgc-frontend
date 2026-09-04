import { ActiveSession } from './models';

/**
 * Cómo se llama una sesión en pantalla. Puro y sin estado, así que se puede probar sin montar
 * nada: es la única lógica de esta pantalla que puede equivocarse en voz alta.
 *
 * El backend manda familias y `null` cuando no sabe, a propósito. **Aquí ese `null` no se rellena
 * con una suposición**: "Dispositivo desconocido" es honesto e inofensivo, mientras que inventar
 * "Chrome en Windows" sobre el portátil Linux de alguien es exactamente lo que le hace pensar que
 * le han entrado en la cuenta. Media respuesta también vale: si solo se sabe el sistema, se dice
 * el sistema.
 */
export function sessionLabel(session: ActiveSession): string {
  const { browser, operatingSystem } = session;
  if (browser && operatingSystem) return `${browser} en ${operatingSystem}`;
  if (browser) return browser;
  if (operatingSystem) return operatingSystem;
  return session.kind === 'DESKTOP_APP' ? 'App de escritorio' : 'Dispositivo desconocido';
}

/** Copy amable de cada scope; uno sin traducir se pinta tal cual (no rompe). */
const SCOPE_LABELS: Record<string, string> = {
  'profile:read': 'Leer perfil',
  'matches:upload': 'Subir partidas',
};

/**
 * Los permisos de una sesión de escritorio, en una línea. Las de navegador no traen scopes: los
 * suyos son fontanería OIDC y el backend no los manda, así que aquí no hay nada que pintar.
 */
export function scopeLabels(scopes: string[]): string {
  return scopes.map((scope) => SCOPE_LABELS[scope] ?? scope).join(' · ');
}
