import {
  CrossAggregate,
  CrossMatch,
  contributionOf,
  damageShare,
  kdaRatio,
} from '../../../../core/matches';
import { formatCompact, formatNumber } from '../../../../shared/date-format';

/**
 * Una métrica enfrentada entre los dos jugadores, ya lista para pintar.
 *
 * Las dos mitades de la barra son la proporción de cada uno sobre la suma, no un porcentaje
 * absoluto: lo que se lee de un vistazo es quién sacó más, y cuánto más. En todas las métricas
 * de esta lista más es mejor, así que el ganador es siempre el valor mayor.
 */
export interface CrossMetricRow {
  key: string;
  label: string;
  mineText: string;
  theirsText: string;
  /** Segunda línea opcional, para el contexto que la cifra sola no da (la cuota de daño). */
  mineSub?: string;
  theirsSub?: string;
  minePct: number;
  theirsPct: number;
  winner: 'me' | 'them' | 'tie';
  /**
   * Los dos a cero. No es un empate: es que esa métrica no la trae ninguna de las partidas del
   * conjunto. La barra se pinta igual para que la fila conserve su altura, pero el consumidor
   * necesita poder decir que ahí no se ha medido nada.
   */
  noData: boolean;
}

/**
 * Las métricas comparables de una partida cruzada.
 *
 * `extended` añade las que solo tienen sitio en la página de detalle. El desplegable de la
 * lista se ojea y la página se estudia: si el desplegable enseñara las diez, la lista sería una
 * pared de datos y la página no tendría razón de existir — es la misma regla que ya sigue la
 * alineación del historial normal.
 */
export function crossMetricRows(c: CrossMatch, extended = false): CrossMetricRow[] {
  const mine = c.me.stats;
  const theirs = c.them.stats;

  const rows: CrossMetricRow[] = [
    row('kda', 'K/D/A', kdaRatio(mine), kdaRatio(theirs), {
      mineText: `${mine.kills}/${mine.deaths}/${mine.assists}`,
      theirsText: `${theirs.kills}/${theirs.deaths}/${theirs.assists}`,
      mineSub: `${kdaRatio(mine).toFixed(2)} KDA`,
      theirsSub: `${kdaRatio(theirs).toFixed(2)} KDA`,
    }),
    row(
      'damage',
      'Daño a campeones',
      mine.totalDamageToChampions,
      theirs.totalDamageToChampions,
      {
        mineText: formatCompact(mine.totalDamageToChampions),
        theirsText: formatCompact(theirs.totalDamageToChampions),
        mineSub: `${damageShare(c.me, c.myTeam)} % de su equipo`,
        theirsSub: `${damageShare(c.them, c.theirTeam)} % de su equipo`,
      },
    ),
    row('cs', 'CS por minuto', mine.csPerMin, theirs.csPerMin, {
      mineText: mine.csPerMin.toFixed(1),
      theirsText: theirs.csPerMin.toFixed(1),
    }),
  ];

  // El oro del minuto 14 solo se pinta cuando lo traen los dos: media barra con un lado
  // vacío se lee como «hizo cero», que no es lo que dice un dato ausente.
  if (mine.goldAt14 !== undefined && theirs.goldAt14 !== undefined) {
    rows.splice(2, 0, {
      ...row('gold14', 'Oro en el minuto 14', mine.goldAt14, theirs.goldAt14, {
        mineText: formatNumber(mine.goldAt14),
        theirsText: formatNumber(theirs.goldAt14),
      }),
    });
  }

  rows.push(
    row('vision', 'Puntos de visión', mine.visionScore, theirs.visionScore, {
      mineText: String(mine.visionScore),
      theirsText: String(theirs.visionScore),
    }),
  );

  if (!extended) return rows;

  const myShare = contributionOf(c.me, c.myTeam);
  const theirShare = contributionOf(c.them, c.theirTeam);

  rows.push(
    row('kp', 'Participación en bajas', myShare.killParticipation, theirShare.killParticipation, {
      mineText: `${myShare.killParticipation} %`,
      theirsText: `${theirShare.killParticipation} %`,
    }),
    row('gold', 'Oro total', mine.gold, theirs.gold, {
      mineText: formatCompact(mine.gold),
      theirsText: formatCompact(theirs.gold),
      mineSub: `${myShare.gold} % de su equipo`,
      theirsSub: `${theirShare.gold} % de su equipo`,
    }),
    row('tanked', 'Daño recibido', mine.damageTaken, theirs.damageTaken, {
      mineText: formatCompact(mine.damageTaken),
      theirsText: formatCompact(theirs.damageTaken),
    }),
  );

  return rows;
}

/**
 * Las mismas métricas, pero promediadas sobre un conjunto de partidas: es lo que convierte
 * «esa vez le sacaste 700 de oro» en «de media le sacas 320». Se pinta con las mismas filas
 * y las mismas barras que la comparativa de una partida a propósito — es el mismo gesto de
 * lectura en las dos pantallas.
 */
export function aggregateMetricRows(a: CrossAggregate): CrossMetricRow[] {
  return [
    // No es la media de los KDA de cada partida, sino el KDA del conjunto: suma de bajas y
    // asistencias entre suma de muertes. Llamarlo «medio» decía otra cosa.
    row('kda', 'KDA acumulado', a.kdaMe, a.kdaThem, {
      mineText: a.kdaMe.toFixed(2),
      theirsText: a.kdaThem.toFixed(2),
    }),
    row('damage', 'Cuota de daño en su equipo', a.damageShareMe, a.damageShareThem, {
      mineText: `${a.damageShareMe} %`,
      theirsText: `${a.damageShareThem} %`,
    }),
    row('cs', 'CS por minuto', a.csPerMinMe, a.csPerMinThem, {
      mineText: a.csPerMinMe.toFixed(1),
      theirsText: a.csPerMinThem.toFixed(1),
    }),
    row('vision', 'Puntos de visión', a.visionMe, a.visionThem, {
      mineText: String(a.visionMe),
      theirsText: String(a.visionThem),
    }),
  ];
}

interface RowText {
  mineText: string;
  theirsText: string;
  mineSub?: string;
  theirsSub?: string;
}

function row(
  key: string,
  label: string,
  mine: number,
  theirs: number,
  text: RowText,
): CrossMetricRow {
  const total = mine + theirs;
  // Sin datos (los dos a cero) la barra se reparte a medias en vez de desaparecer: así la fila
  // conserva su altura y la lista no da un salto cuando llega una partida sin ese dato. Pero se
  // marca como `noData`: un 50/50 se lee como «empatáis», y no es eso lo que dice el dato.
  const noData = total === 0;
  const minePct = noData ? 50 : Math.round((mine / total) * 100);

  return {
    key,
    label,
    ...text,
    minePct,
    theirsPct: 100 - minePct,
    winner: noData || mine === theirs ? 'tie' : mine > theirs ? 'me' : 'them',
    noData,
  };
}
