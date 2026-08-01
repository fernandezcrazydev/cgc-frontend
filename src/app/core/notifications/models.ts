/**
 * Interfaces espejo de los DTOs del backend de notificaciones. Replican EXACTAMENTE
 * lo que viaja por HTTP (como `CurrentUser` ↔ `MeResponse`): si el backend cambia el
 * contrato, se cambia aquí, no se parchea en las vistas.
 *
 * Fuente: `com.cgc.cc.notifications.adapters.in.controller.response` del backend.
 */

/**
 * Tipos de notificación que la campana sabe mostrar (`NotificationType` en el backend).
 * El backend añade tipos sin migración, así que el campo `type` viaja como `string` y
 * esta unión es solo la ayuda de tipado para lo ya conocido.
 *
 * `RIOT_ACCOUNT_PAIRED`/`RIOT_ACCOUNT_VERIFIED`/`RIOT_ACCOUNT_TAKEN_OVER` llegan cuando el
 * usuario vincula, verifica o pierde su cuenta de Riot desde la app de escritorio
 * (`cgc-scraper`); las tres traen `riotId` en `data` y las dos primeras también `region`.
 *
 * `FEEDBACK_SUBMITTED` llega cuando alguien envía un reporte, y **solo a los ADMIN** (nunca
 * al propio autor, aunque lo sea): trae `feedbackId`, `kind` (`BUG`/`PROPOSAL`/`INCIDENT`) y
 * `title`, este último ya recortado por el backend para caber en la campana.
 */
export type NotificationType =
  | 'INVITED_TO_GROUP'
  | 'RIOT_ACCOUNT_PAIRED'
  | 'RIOT_ACCOUNT_VERIFIED'
  | 'RIOT_ACCOUNT_TAKEN_OVER'
  | 'FEEDBACK_SUBMITTED';

/**
 * Una entrada de la campana. `type` es el nombre del enum; `data` es un mapa de
 * strings cuyo contenido depende del `type` (para `INVITED_TO_GROUP`: `groupId`,
 * `groupName`, `invitationId`). `read` ya viene resuelto por el backend (no expone
 * `readAt`); `createdAt` es ISO-8601 y se formatea en presentación.
 */
export interface NotificationResponse {
  id: string;
  type: string;
  data: Record<string, string>;
  read: boolean;
  createdAt: string;
}

/** El contador del badge de la campana (`GET /me/notifications/unread-count`). */
export interface UnreadCountResponse {
  count: number;
}
