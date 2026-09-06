import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/auth';
import { Login } from './features/login/login';
import { Shell } from './features/shell/shell';

export const routes: Routes = [
  { path: '', component: Login, title: 'Acceso · Sale Custom' },
  // Debe ir antes del comodín '**'. Es la redirectUri registrada en el backend.
  {
    path: 'callback',
    loadComponent: () => import('./features/auth/callback').then((m) => m.Callback),
  },
  {
    path: 'app',
    component: Shell,
    // Sin token o sin perfil en BD no se entra: el shell asume un usuario real.
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: 'Inicio · Sale Custom',
        loadComponent: () => import('./features/shell/views/inicio').then((m) => m.Inicio),
      },
      {
        path: 'historial',
        title: 'Historial · Sale Custom',
        loadComponent: () => import('./features/shell/views/match-history/historial').then((m) => m.Historial),
      },
      {
        path: 'historial/:id',
        title: 'Partida · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/match-history/partida-detalle').then((m) => m.PartidaDetalle),
      },
      {
        path: 'grupos',
        title: 'Grupos · Sale Custom',
        loadComponent: () => import('./features/shell/views/group/grupos').then((m) => m.Grupos),
      },
      {
        path: 'grupos/:id',
        title: 'Grupo · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/group/grupo-detalle').then((m) => m.GrupoDetalle),
      },
      {
        path: 'grupos/:id/perfil',
        title: 'Perfil del grupo · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/group/grupo-perfil').then((m) => m.GrupoPerfil),
      },
      // La zona de juego, con un nivel por objeto del dominio (`FlujoJuego.md` §2): el
      // tablón lista lo que hay, la convocatoria es la llamada a jugar, y la sala son los
      // diez. Las tres rutas anteriores —`partidas`, `partidas/:roomId` y
      // `crear-partida`— redirigen más abajo para no romper enlaces ya repartidos.
      {
        path: 'grupos/:id/tablon',
        title: 'Tablón · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/group-board/tablon').then((m) => m.Tablon),
      },
      {
        path: 'grupos/:id/convocatoria/:lobbyId',
        title: 'Convocatoria · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/group-lobby/convocatoria').then((m) => m.Convocatoria),
      },
      {
        path: 'grupos/:id/sala/:salaId',
        title: 'Sala · Sale Custom',
        loadComponent: () => import('./features/shell/views/group-room/sala').then((m) => m.Sala),
      },
      {
        path: 'grupos/:id/ranking',
        title: 'Ranking · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/group/grupo-ranking').then((m) => m.GrupoRanking),
      },
      {
        path: 'grupos/:id/tierlist',
        title: 'Tierlist · Sale Custom',
        loadComponent: () => import('./features/shell/views/group/tierlist').then((m) => m.Tierlist),
      },
      {
        path: 'grupos/:id/estadisticas',
        title: 'Estadísticas · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/group-stats/grupo-estadisticas').then(
            (m) => m.GrupoEstadisticas,
          ),
      },
      {
        path: 'grupos/:id/discord',
        title: 'Discord · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/group/grupo-discord').then((m) => m.GrupoDiscord),
      },
      {
        path: 'grupos/:id/historial',
        title: 'Historial del grupo · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/group/grupo-historial').then((m) => m.GrupoHistorial),
      },
      {
        path: 'tierlist',
        redirectTo: 'grupos',
      },
      {
        path: 'perfil',
        title: 'Perfil · Sale Custom',
        loadComponent: () => import('./features/shell/views/profile/perfil').then((m) => m.Perfil),
      },
      {
        path: 'perfil/:id',
        title: 'Perfil de jugador · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/profile/perfil-miembro').then((m) => m.PerfilMiembro),
      },
      // Cruce con otro jugador (Fase 4): CrossLayout gestiona el estado y la cabecera compartida,
      // mientras que las vistas hijas (Historial, Versus, Sinergia y Detalle) se cargan sin parpadeos.
      {
        path: 'jugador/:playerId',
        loadComponent: () =>
          import('./features/shell/views/cross/cross-layout').then((m) => m.CrossLayout),
        children: [
          {
            path: '',
            title: 'Historial cruzado · Sale Custom',
            loadComponent: () =>
              import('./features/shell/views/cross/historial-cruzado').then((m) => m.HistorialCruzado),
          },
          {
            path: 'contra',
            title: 'Cara a cara · Sale Custom',
            loadComponent: () => import('./features/shell/views/cross/versus').then((m) => m.Versus),
          },
          {
            path: 'contra/:matchId',
            title: 'Duelo directo · Sale Custom',
            data: { relation: 'enemy' },
            loadComponent: () =>
              import('./features/shell/views/cross/cross-match-detail').then((m) => m.CrossMatchDetail),
          },
          {
            path: 'juntos',
            title: 'Sinergia de dúo · Sale Custom',
            loadComponent: () => import('./features/shell/views/cross/synergy').then((m) => m.Synergy),
          },
          {
            path: 'juntos/:matchId',
            title: 'Sinergia en la partida · Sale Custom',
            data: { relation: 'ally' },
            loadComponent: () =>
              import('./features/shell/views/cross/cross-match-detail').then((m) => m.CrossMatchDetail),
          },
        ],
      },
      // Redirects de compatibilidad para enlaces profundos
      { path: 'grupos/:id/crear-partida', redirectTo: 'grupos/:id/tablon' },
      { path: 'grupos/:id/partidas', pathMatch: 'full', redirectTo: 'grupos/:id/tablon' },
      { path: 'grupos/:id/partidas/:roomId', redirectTo: 'grupos/:id/convocatoria/:roomId' },
      { path: 'versus/:playerId', redirectTo: 'jugador/:playerId/contra' },
      { path: 'versus/:playerId/:matchId', redirectTo: 'jugador/:playerId/contra/:matchId' },
      { path: 'synergy/:playerId', redirectTo: 'jugador/:playerId/juntos' },
      { path: 'synergy/:playerId/:matchId', redirectTo: 'jugador/:playerId/juntos/:matchId' },
      { path: 'historial-cruzado/:playerId', redirectTo: 'jugador/:playerId' },
      {
        path: 'ajustes',
        title: 'Ajustes · Sale Custom',
        loadComponent: () => import('./features/shell/views/ajustes').then((m) => m.Ajustes),
      },
      // Administración: además del authGuard del padre, exige rol ADMIN (el backend revalida).
      {
        path: 'admin',
        title: 'Administración · Sale Custom',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/shell/views/admin/admin').then((m) => m.AdminDirectory),
      },
      {
        path: 'admin/feedback',
        title: 'Feedback · Admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/shell/views/admin/admin-feedback').then((m) => m.AdminFeedback),
      },
      {
        path: 'admin/feedback/:id',
        title: 'Reporte · Admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/shell/views/admin/admin-feedback-detalle').then((m) => m.AdminFeedbackDetalle),
      },
      {
        path: 'admin/riot-metricas',
        title: 'Métricas API Riot · Admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/shell/views/admin/admin-riot-metricas').then((m) => m.AdminRiotMetricas),
      },
      {
        path: 'admin/seguridad',
        title: 'Registro de seguridad · Admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/shell/views/admin/admin-seguridad').then((m) => m.AdminSeguridad),
      },
      // 404 dentro del shell: una ruta desconocida bajo /app se queda en la
      // aplicación (con navegación y salida) en vez de rebotar al login.
      {
        path: '**',
        title: 'Página no encontrada · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/no-encontrado').then((m) => m.NoEncontrado),
      },
    ],
  },
  // Comodín de nivel raíz: solo alcanza a quien no tiene sesión, y para ese
  // el login sí es el destino correcto.
  { path: '**', redirectTo: '' },
];
