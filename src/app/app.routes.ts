import { Routes } from '@angular/router';
import { Login } from './features/login/login';
import { Shell } from './features/shell/shell';

export const routes: Routes = [
  { path: '', component: Login, title: 'Acceso · NEXUS//FORGE' },
  {
    path: 'app',
    component: Shell,
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
        path: 'grupos',
        title: 'Grupos · NEXUS//FORGE',
        loadComponent: () => import('./features/shell/views/grupos').then((m) => m.Grupos),
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
