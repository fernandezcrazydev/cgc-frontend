/**
 * Entorno de PRODUCCIÓN. Angular sustituye environment.ts por este archivo
 * en el build de producción (ver `fileReplacements` en angular.json).
 * TODO: reemplaza apiBaseUrl por la URL real del backend antes de desplegar.
 */
const apiBaseUrl = 'https://api.tu-dominio.com';

export const environment = {
  production: true,
  apiBaseUrl,
  apiUrl: `${apiBaseUrl}/api/v1`,
  authority: apiBaseUrl,
  clientId: 'cgc-web',
};
