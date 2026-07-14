# Sale perso — Custom Game Creator (cgc-frontend)

Documentación de contexto de la aplicación. Todo el dato es **mock** (en memoria,
seedeado de forma determinista); estos documentos describen la **lógica de negocio**
que ya está implementada en el front, los puntos de integración con el backend y los
casos límite detectados.

## ¿Qué es?

App Angular 22 (standalone, signals, zoneless-style con `computed`/`effect`) para
montar **partidas personalizadas 5v5** estilo League of Legends dentro de **grupos**:

- Creas/gestionas **grupos** (roster, invitaciones, admins, perks por jugador).
- Montas **partidas** de dos formas: **manual** (el capitán elige a los 10 y configura
  restricciones en un wizard de 5 pasos) o **sala abierta** (la gente se apunta).
- Un **matchmaker** interno reparte a los 10 en Azul vs Rojo equilibrando elo y
  respetando reglas (duos, versus, duelos de línea).
- La partida vive en una **sala** con ciclo de vida (`drafting → waiting/live`), se
  resuelve a mano o por **import** del scraper de escritorio, y produce cambios de MMR.
- Estadísticas, ranking, premios, badges, perfil de jugador e historial — todo
  derivado de datos seedeados deterministas.

## Índice de documentos

| Documento | Contenido |
|-----------|-----------|
| [architecture.md](architecture.md) | Stack, estructura de carpetas, routing, stores, patrón de estado |
| [domain-model.md](domain-model.md) | Entidades (Group, Member, MatchRoom, Notification…) y sus relaciones |
| [match-lifecycle.md](match-lifecycle.md) | Wizard de creación, ciclo de la sala, resultados, import, revanchas |
| [matchmaking.md](matchmaking.md) | Algoritmo de reparto, roles, reglas, MMR |
| [stats-and-data.md](stats-and-data.md) | Cómo se generan stats/ranking/premios/badges/perfil (seeding) |
| [edge-cases.md](edge-cases.md) | **Casos límite y cosas no contempladas** (revisión de lógica) |

## Convenciones del proyecto

- **Idioma:** UI y copy en español. Identificadores de rol/región en mayúsculas.
- **Diseño:** sistema NEXUS//FORGE (tokens `--nf-*`, componentes `nf-*` en `src/app/ui`).
  Es el nombre del **design system**, no el de la app (la app es **Sale perso**); de ahí el prefijo `nf-`.
- **Estado:** todo en signals dentro de servicios `@Injectable({ providedIn: 'root' })`.
- **Backend:** marcado en el código con `BACKEND NOTE:`. El front está diseñado para
  que solo cambie la fuente de datos (los métodos de los stores ya tienen la forma final).
</content>
</invoke>
