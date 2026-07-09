/**
 * Entorno de DESARROLLO (por defecto con `ng serve`).
 *
 * El backend hace de Authorization Server (emite nuestros JWT) y de API.
 * Discord solo es el proveedor de identidad: el navegador nunca habla con él
 * directamente, lo hace el backend.
 */
const apiBaseUrl = 'http://localhost:8080';

export const environment = {
  production: false,
  apiBaseUrl,
  /** Nuestra API versionada. Es la ruta a la que el interceptor añade el Bearer. */
  apiUrl: `${apiBaseUrl}/api/v1`,
  /** Emisor de los tokens: se descubre por /.well-known/openid-configuration. */
  authority: apiBaseUrl,
  /** Debe coincidir con el RegisteredClient del backend (AuthorizationSecurityConfig). */
  clientId: 'cgc-web',
};
