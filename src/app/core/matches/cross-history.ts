/**
 * El cruce entre el usuario de la sesión y otro jugador.
 *
 * **El cruce es un filtro, no un endpoint**: `GET /me/matches?with={userId}` son las partidas en
 * las que coincidisteis, y `&relation=ALLY|ENEMY` las acota a en las que fuisteis compañeros o
 * rivales. El recuento sale de `GET /me/matches/summary`, que acepta los mismos parámetros.
 * Quién filtra, ordena y pagina es el servidor.
 *
 * Lo único que queda aquí es emparejar, dentro de una partida que ya viene acotada, tu asiento
 * con el suyo. No es adivinar la relación: los dos asientos están delante, con su hueco de
 * equipo, que es exactamente lo que lee el backend para filtrar.
 *
 * ## Lo que se borró, y por qué no volverá por esta puerta
 *
 * `aggregateCross`, `buildCrossPartners`, `bestAllyOf`, `nemesisOf` y `CROSS_MIN_SAMPLE` ya no
 * existen. Calculaban medias comparadas —CS por minuto, rachas vivas, emparejamientos de campeón
 * repetidos— sobre la lista ENTERA del usuario, y con la paginación en servidor esa lista ya no
 * está en el cliente: lo único que hay es la página en pantalla. Sumar seis filas y llamarlo
 * «vuestro récord» sería peor que no darlo.
 *
 * BACKEND NOTE: esas medias son una superficie analítica propia y se sirven aparte (issue #69,
 * §8). Hasta entonces las tarjetas que dependían de ellas no se pintan a cero: se retiran.
 */
import { CrossRelation } from './match-filtering';
import { Match, MatchParticipant, TeamSummary } from './models';
import { teamBySlot } from './match-view';

export type { CrossRelation };

/** Una partida en la que coincidisteis, ya resuelta desde los dos lados. */
export interface CrossMatch {
  /** El id de la partida: sirve de clave de `@for` y de parámetro de ruta. */
  id: string;
  match: Match;
  /** Leído de los dos huecos de equipo. Nunca se adivina. */
  relation: CrossRelation;
  me: MatchParticipant;
  them: MatchParticipant;
  myTeam: TeamSummary;
  theirTeam: TeamSummary;
  /** Misma posición: es lo que convierte «coincidimos» en «nos enfrentamos de verdad». */
  sameLane: boolean;
}

/**
 * Empareja cada partida de la página con el asiento del otro jugador.
 *
 * Si una fila no trae a ninguno de los dos, se descarta en silencio: el servidor ya la filtró
 * por `with`, así que eso solo puede pasar con una respuesta inconsistente, y pintar media
 * comparación es peor que no pintar la fila.
 */
export function toCrossMatches(
  matches: readonly Match[],
  otherUserId: string,
): CrossMatch[] {
  if (!otherUserId) return [];
  const out: CrossMatch[] = [];

  for (const match of matches) {
    const me = match.userParticipant;
    if (!me) continue;

    const them = [...match.teams[0].participants, ...match.teams[1].participants].find(
      (p) => p.userId === otherUserId,
    );
    // Que el jugador buscado seas tú mismo no es un cruce, es tu propio historial.
    if (!them || them.userId === me.userId) continue;

    out.push({
      id: match.id,
      match,
      relation: them.slot === me.slot ? 'ally' : 'enemy',
      me,
      them,
      myTeam: teamBySlot(match, me.slot),
      theirTeam: teamBySlot(match, them.slot),
      sameLane: me.role === them.role,
    });
  }

  return out;
}
