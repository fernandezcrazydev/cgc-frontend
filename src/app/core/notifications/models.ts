/**
 * Interfaces espejo de los DTOs del backend de notificaciones. Replican EXACTAMENTE
 * lo que viaja por HTTP (como `CurrentUser` ↔ `MeResponse`): si el backend cambia el
 * contrato, se cambia aquí, no se parchea en las vistas.
 *
 * Fuente: `com.cgc.cc.notifications.adapters.in.controller.response` del backend.
 */

/**
 * Tipos de notificación que la campana sabe mostrar (`NotificationType` en el backend).
 * Hoy solo existe uno; el backend añade tipos sin migración, así que el campo `type`
 * viaja como `string` y esta unión es solo la ayuda de tipado para lo ya conocido.
 */
export type NotificationType = 'INVITED_TO_GROUP';

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
