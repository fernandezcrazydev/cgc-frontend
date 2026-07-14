# Arquitectura

## Stack

- **Angular 22**, componentes **standalone**, **signals** (`signal` / `computed` /
  `effect`), templates con control-flow nuevo (`@if`, `@for`, `@switch`).
- Routing con **lazy `loadComponent`** por vista.
- Estado compartido en servicios **root-provided**; no hay NgRx ni HTTP — todo mock
  en memoria.
- Sistema de diseño propio **NEXUS//FORGE** en `src/app/ui` (`nf-button`, `nf-badge`,
  `nf-window`, `nf-select`, `nf-toggle`, `nf-toast`, `nf-avatar-picker`, `nf-pagination`).
  Es el nombre del design system, no el de la app (**Sale perso**); por eso el prefijo `nf-`.

## Estructura de carpetas

```
src/app/
  core/            ← lógica de dominio + stores (sin UI)
    lobby.ts            modelos + datos seed (GROUPS, CHAMPIONS, NOTIFICATIONS, CURRENT_USER)
    group-store.ts      GroupStore: grupos, rosters, invitaciones, perks, admins
    match-store.ts      MatchStore: salas/partidas (drafting/waiting/live), resultados
    matchmaking.ts      algoritmo de reparto Azul/Rojo + elo interno
    notification-store.ts  NotificationStore: campana + panel "requiere atención"
    toast.ts            ToastService
    group-ranking.ts    seeding determinista (hash + mulberry32) + ranking
    group-stats.ts      stats por miembro, resumen, leaderboards, premios
    group-badges.ts     badges cross-surface (MVP + premios) derivados de stats
    member-detail.ts    tarjeta expandida de un miembro (champs, roles, h2h)
    player-profile.ts   perfil agregado cross-grupo del usuario
    match-history.ts    historial de partidas del usuario (seed)
    perks.ts            catálogo fijo de perks (estilo de juego)
  features/
    login/           pantalla de acceso (mock)
    shell/           layout (sidebar + header + bottom-nav) con <router-outlet>
      views/         una vista por ruta (ver routing)
  ui/                componentes del design system
  styles/tokens/     tokens CSS
```

## Routing (`app.routes.ts`)

```
''                                       → Login
'app'  (Shell)
  ''                  → redirect inicio
  inicio
  historial            / historial/:id
  grupos               / grupos/:id
  grupos/:id/crear-partida
  grupos/:id/partidas  / grupos/:id/partidas/:roomId   (sala)
  grupos/:id/ranking
  grupos/:id/estadisticas
  grupos/:id/historial
  perfil
  ajustes
'**'                                     → redirect a Login
```

Cada vista de grupo lee `:id` por `paramMap` (vía `toSignal`) y, en un `effect`,
sincroniza `GroupStore.select(id)` para que header/sidebar reflejen el grupo activo
en deep-link.

## Patrón de estado

- **Stores root** mantienen `signal`s privadas y exponen lecturas reactivas
  (`computed` / `asReadonly`) y mutadores. Las escrituras siempre crean objetos nuevos
  (inmutabilidad) para que los `computed` se recalculen.
- Las vistas derivan todo con `computed` y nunca mutan datos directamente.
- **Latencia simulada** con `setTimeout` (loaders de emparejamiento/lanzamiento).
- **Determinismo:** los datos "aleatorios" se generan con `hash(string)` + PRNG
  `mulberry32`/`seeded`, sembrados por tag/grupo/scope, así una misma entrada siempre
  renderiza los mismos números (ver [stats-and-data.md](stats-and-data.md)).

## Usuario actual

`CURRENT_USER = N1ghtfang#LAN` (constante en `lobby.ts`). No hay auth real ni sesión;
el login solo navega. Ver el caso límite importante sobre este usuario en
[edge-cases.md](edge-cases.md).
</content>
