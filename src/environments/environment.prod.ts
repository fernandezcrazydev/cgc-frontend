/**
 * Entorno de PRODUCCIÓN. Angular sustituye environment.ts por este archivo
 * en el build de producción (ver `fileReplacements` en angular.json).
 *
 * Front y backend comparten origen: Caddy sirve la SPA en `/` y hace de proxy hacia
 * Spring de `/api`, `/oauth2`, `/login`, `/connect` y `/.well-known`. Por eso aquí no
 * hay un host distinto para la API.
 *
 * `authority` debe coincidir EXACTAMENTE con el `issuer` que anuncia el backend en
 * /.well-known/openid-configuration (lo fija PUBLIC_BASE_URL en env/prod.env del
 * backend). Si no coinciden al carácter, angular-auth-oidc-client rechaza los tokens y
 * el login falla sin explicar por qué.
 */
const apiBaseUrl = 'https://salecustom.es';

export const environment = {
  production: true,
  apiBaseUrl,
  apiUrl: `${apiBaseUrl}/api/v1`,
  authority: apiBaseUrl,
  clientId: 'cgc-web',
};
