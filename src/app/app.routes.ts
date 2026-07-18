import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/auth';
import { Login } from './features/login/login';
import { Shell } from './features/shell/shell';

export const routes: Routes = [
  { path: '', component: Login, title: 'Acceso · Sale perso' },
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
        title: 'Inicio · Sale perso',
        loadComponent: () => import('./features/shell/views/inicio').then((m) => m.Inicio),
      },
      {
        path: 'historial',
        title: 'Historial · Sale perso',
        loadComponent: () => import('./features/shell/views/historial').then((m) => m.Historial),
      },
      {
        path: 'historial/:id',
        title: 'Partida · Sale perso',
        loadComponent: () =>
          import('./features/shell/views/partida-detalle').then((m) => m.PartidaDetalle),
      },
      {
        path: 'grupos',
        title: 'Grupos · Sale perso',
        loadComponent: () => import('./features/shell/views/grupos').then((m) => m.Grupos),
      },
      {
        path: 'grupos/:id',
        title: 'Grupo · Sale perso',
        loadComponent: () =>
          import('./features/shell/views/grupo-detalle').then((m) => m.GrupoDetalle),
      },
      {
        path: 'grupos/:id/crear-partida',
        title: 'Crear partida · Sale perso',
        loadComponent: () =>
          import('./features/shell/views/grupo-crear-partida').then((m) => m.GrupoCrearPartida),
      },
      {
        path: 'grupos/:id/partidas',
        title: 'Partidas activas · Sale perso',
        loadComponent: () =>
          import('./features/shell/views/grupo-partidas').then((m) => m.GrupoPartidas),
      },
      {
        path: 'grupos/:id/partidas/:roomId',
        title: 'Sala · Sale perso',
        loadComponent: () =>
          import('./features/shell/views/grupo-sala').then((m) => m.GrupoSala),
      },
      {
        path: 'grupos/:id/ranking',
        title: 'Ranking · Sale perso',
        loadComponent: () =>
          import('./features/shell/views/grupo-ranking').then((m) => m.GrupoRanking),
      },
      {
        path: 'grupos/:id/estadisticas',
        title: 'Estadísticas · Sale perso',
        loadComponent: () =>
          import('./features/shell/views/grupo-estadisticas').then((m) => m.GrupoEstadisticas),
      },
      {
        path: 'grupos/:id/historial',
        title: 'Historial del grupo · Sale perso',
        loadComponent: () =>
          import('./features/shell/views/grupo-historial').then((m) => m.GrupoHistorial),
      },
      {
        path: 'perfil',
        title: 'Perfil · Sale perso',
        loadComponent: () => import('./features/shell/views/perfil').then((m) => m.Perfil),
      },
      {
        path: 'ajustes',
        title: 'Ajustes · Sale perso',
        loadComponent: () => import('./features/shell/views/ajustes').then((m) => m.Ajustes),
      },
      // Administración: además del authGuard del padre, exige rol ADMIN (el backend revalida).
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
    ],
  },
  { path: '**', redirectTo: '' },
];
