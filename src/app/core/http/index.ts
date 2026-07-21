/* Superficie pública del manejo de errores HTTP. Se importa de `core/http`, nunca del fichero
 * suelto. */
export {
  parseApiError,
  messageForError,
  errorMessage,
  type ApiError,
  type ApiFieldError,
} from './api-error';
export { SessionRecovery, sessionRecoveryInterceptor } from './session-recovery';
