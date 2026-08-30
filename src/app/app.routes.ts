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
        loadComponent: () => import('./features/shell/views/historial').then((m) => m.Historial),
      },
      {
        path: 'historial/:id',
        title: 'Partida · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/partida-detalle').then((m) => m.PartidaDetalle),
      },
      {
        path: 'grupos',
        title: 'Grupos · Sale Custom',
        loadComponent: () => import('./features/shell/views/grupos').then((m) => m.Grupos),
      },
      {
        path: 'grupos/:id',
        title: 'Grupo · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/grupo-detalle').then((m) => m.GrupoDetalle),
      },
      {
        path: 'grupos/:id/crear-partida',
        title: 'Crear partida · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/grupo-crear-partida').then((m) => m.GrupoCrearPartida),
      },
      {
        path: 'grupos/:id/partidas',
        title: 'Partidas activas · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/grupo-partidas').then((m) => m.GrupoPartidas),
      },
      {
        path: 'grupos/:id/partidas/:roomId',
        title: 'Sala · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/grupo-sala').then((m) => m.GrupoSala),
      },
      {
        path: 'grupos/:id/ranking',
        title: 'Ranking · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/grupo-ranking').then((m) => m.GrupoRanking),
      },
      {
        path: 'grupos/:id/estadisticas',
        title: 'Estadísticas · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/grupo-estadisticas').then((m) => m.GrupoEstadisticas),
      },
      {
        path: 'grupos/:id/discord',
        title: 'Discord · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/grupo-discord').then((m) => m.GrupoDiscord),
      },
      {
        path: 'grupos/:id/historial',
        title: 'Historial del grupo · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/grupo-historial').then((m) => m.GrupoHistorial),
      },
      {
        path: 'tierlist',
        title: 'Tierlist · Sale Custom',
        loadComponent: () => import('./features/shell/views/tierlist').then((m) => m.Tierlist),
      },
      {
        path: 'perfil',
        title: 'Perfil · Sale Custom',
        loadComponent: () => import('./features/shell/views/perfil').then((m) => m.Perfil),
      },
      {
        path: 'perfil/:id',
        title: 'Perfil de jugador · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/perfil-miembro').then((m) => m.PerfilMiembro),
      },
      // Cara a cara con otro jugador, en dos niveles. Las rutas sin `:matchId` son las medias
      // acumuladas (todo lo jugado en contra, todo lo jugado junto) y las que lo llevan son el
      // duelo o la cooperación de esa partida concreta. Las tres de primer nivel comparten
      // cabecera y conmutador, así que se navega entre ellas sin volver al perfil.
      {
        path: 'versus/:playerId',
        title: 'Cara a cara · Sale Custom',
        loadComponent: () => import('./features/shell/views/versus').then((m) => m.Versus),
      },
      {
        path: 'versus/:playerId/:matchId',
        title: 'Duelo directo · Sale Custom',
        // La ruta declara de qué lado espera encontraros: si la partida no fue un
        // enfrentamiento, la vista responde 404 en vez de etiquetarla mal.
        data: { relation: 'enemy' },
        loadComponent: () =>
          import('./features/shell/views/cross/cross-match-detail').then((m) => m.CrossMatchDetail),
      },
      {
        path: 'synergy/:playerId',
        title: 'Sinergia de dúo · Sale Custom',
        loadComponent: () => import('./features/shell/views/synergy').then((m) => m.Synergy),
      },
      {
        path: 'synergy/:playerId/:matchId',
        title: 'Sinergia en la partida · Sale Custom',
        data: { relation: 'ally' },
        loadComponent: () =>
          import('./features/shell/views/cross/cross-match-detail').then((m) => m.CrossMatchDetail),
      },
      {
        path: 'historial-cruzado/:playerId',
        title: 'Historial cruzado · Sale Custom',
        loadComponent: () =>
          import('./features/shell/views/historial-cruzado').then((m) => m.HistorialCruzado),
      },
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
        loadComponent: () => import('./features/shell/views/admin').then((m) => m.AdminDirectory),
      },
      {
        path: 'admin/feedback',
        title: 'Feedback · Admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/shell/views/admin-feedback').then((m) => m.AdminFeedback),
      },
      {
        path: 'admin/feedback/:id',
        title: 'Reporte · Admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/shell/views/admin-feedback-detalle').then((m) => m.AdminFeedbackDetalle),
      },
      {
        path: 'admin/riot-metricas',
        title: 'Métricas API Riot · Admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/shell/views/admin-riot-metricas').then((m) => m.AdminRiotMetricas),
      },
      {
        path: 'admin/seguridad',
        title: 'Registro de seguridad · Admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/shell/views/admin-seguridad').then((m) => m.AdminSeguridad),
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
