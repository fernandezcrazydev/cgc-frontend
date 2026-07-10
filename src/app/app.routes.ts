import { Routes } from '@angular/router';
import { authGuard } from './core/auth';
import { Login } from './features/login/login';
import { Shell } from './features/shell/shell';

export const routes: Routes = [
  { path: '', component: Login, title: 'Acceso · NEXUS//FORGE' },
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
        title: 'Inicio · NEXUS//FORGE',
        loadComponent: () => import('./features/shell/views/inicio').then((m) => m.Inicio),
      },
      {
        path: 'historial',
        title: 'Historial · NEXUS//FORGE',
        loadComponent: () => import('./features/shell/views/historial').then((m) => m.Historial),
      },
      {
        path: 'historial/:id',
        title: 'Partida · NEXUS//FORGE',
        loadComponent: () =>
          import('./features/shell/views/partida-detalle').then((m) => m.PartidaDetalle),
      },
      {
        path: 'grupos',
        title: 'Grupos · NEXUS//FORGE',
        loadComponent: () => import('./features/shell/views/grupos').then((m) => m.Grupos),
      },
      {
        path: 'grupos/:id',
        title: 'Grupo · NEXUS//FORGE',
        loadComponent: () =>
          import('./features/shell/views/grupo-detalle').then((m) => m.GrupoDetalle),
      },
      {
        path: 'grupos/:id/crear-partida',
        title: 'Crear partida · NEXUS//FORGE',
        loadComponent: () =>
          import('./features/shell/views/grupo-crear-partida').then((m) => m.GrupoCrearPartida),
      },
      {
        path: 'grupos/:id/partidas',
        title: 'Partidas activas · NEXUS//FORGE',
        loadComponent: () =>
          import('./features/shell/views/grupo-partidas').then((m) => m.GrupoPartidas),
      },
      {
        path: 'grupos/:id/partidas/:roomId',
        title: 'Sala · NEXUS//FORGE',
        loadComponent: () =>
          import('./features/shell/views/grupo-sala').then((m) => m.GrupoSala),
      },
      {
        path: 'grupos/:id/ranking',
        title: 'Ranking · NEXUS//FORGE',
        loadComponent: () =>
          import('./features/shell/views/grupo-ranking').then((m) => m.GrupoRanking),
      },
      {
        path: 'grupos/:id/estadisticas',
        title: 'Estadísticas · NEXUS//FORGE',
        loadComponent: () =>
          import('./features/shell/views/grupo-estadisticas').then((m) => m.GrupoEstadisticas),
      },
      {
        path: 'grupos/:id/historial',
        title: 'Historial del grupo · NEXUS//FORGE',
        loadComponent: () =>
          import('./features/shell/views/grupo-historial').then((m) => m.GrupoHistorial),
      },
      {
        path: 'perfil',
        title: 'Perfil · NEXUS//FORGE',
        loadComponent: () => import('./features/shell/views/perfil').then((m) => m.Perfil),
      },
      {
        path: 'ajustes',
        title: 'Ajustes · NEXUS//FORGE',
        loadComponent: () => import('./features/shell/views/ajustes').then((m) => m.Ajustes),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
