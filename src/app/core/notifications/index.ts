/* Superficie pública del dominio de notificaciones. El resto de la app importa de aquí
 * (`core/notifications`) y nunca de los ficheros sueltos: así `NotificationsApi` queda
 * privado y puede cambiar sin arrastrar a nadie. */
export { NotificationsStore, type NotificationsStatus } from './notifications-store';
export {
  type NotificationResponse,
  type NotificationType,
  type NotificationSemanticLevel,
  type UnreadCountResponse,
} from './models';
export {
  notificationView,
  timeAgo,
  type NotificationView,
  type InviteView,
} from './notification-view';
export { SEED_NOTIFICATIONS } from './seed-notifications';
