import { CrossMatch, contributionOf, damageShare, kdaRatio } from '../../../../core/matches';
import { formatCompact, formatNumber } from '../../../../shared/date-format';

/**
 * Una métrica enfrentada entre los dos jugadores **dentro de una misma partida**, ya lista para
 * pintar.
 *
 * Las dos mitades de la barra son la proporción de cada uno sobre la suma, no un porcentaje
 * absoluto: lo que se lee de un vistazo es quién sacó más, y cuánto más. En todas las métricas
 * de esta lista más es mejor, así que el ganador es siempre el valor mayor.
 *
 * ## Por qué ya no hay una versión «de medias»
 *
 * `aggregateMetricRows` comparaba vuestras medias a lo largo de todo el cruce. Se calculaba
 * sobre el historial entero, que era posible cuando el cliente lo tenía en memoria; con la
 * paginación en servidor solo hay una página, y promediarla y llamarlo «de media le sacas 320»
 * sería una cifra inventada con aspecto de medida. Es una superficie analítica propia y se
 * sirve aparte (issue #69, §8).
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
   * Ninguno de los dos trae esa métrica. No es un empate: es que nadie la midió. La barra se
   * pinta igual para que la fila conserve su altura, pero el consumidor necesita poder decirlo.
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
 *
 * **Una fila cuyos dos lados están ausentes no se pinta.** Sin subida, eso son casi todas, y
 * una lista de «—» contra «—» ocupa el sitio sin decir nada.
 */
export function crossMetricRows(c: CrossMatch, extended = false): CrossMetricRow[] {
  const mine = c.me.stats;
  const theirs = c.them.stats;
  const duration = c.match.durationSeconds;

  const rows: CrossMetricRow[] = [
    row('kda', 'K/D/A', kdaRatio(mine), kdaRatio(theirs), {
      mineText: kdaText(mine),
      theirsText: kdaText(theirs),
      mineSub: ratioText(kdaRatio(mine)),
      theirsSub: ratioText(kdaRatio(theirs)),
    }),
    row('damage', 'Daño a campeones', mine.damageToChampions, theirs.damageToChampions, {
      mineText: amount(mine.damageToChampions),
      theirsText: amount(theirs.damageToChampions),
      mineSub: shareText(damageShare(c.me, c.myTeam)),
      theirsSub: shareText(damageShare(c.them, c.theirTeam)),
    }),
    row('cs', 'CS por minuto', perMin(mine.cs, duration), perMin(theirs.cs, duration), {
      mineText: decimalText(perMin(mine.cs, duration)),
      theirsText: decimalText(perMin(theirs.cs, duration)),
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
      mineText: plainText(mine.visionScore),
      theirsText: plainText(theirs.visionScore),
    }),
  );

  if (extended) {
    const myShare = contributionOf(c.me, c.myTeam);
    const theirShare = contributionOf(c.them, c.theirTeam);

    rows.push(
      row(
        'kp',
        'Participación en bajas',
        myShare.killParticipation,
        theirShare.killParticipation,
        {
          mineText: shareText(myShare.killParticipation) ?? '—',
          theirsText: shareText(theirShare.killParticipation) ?? '—',
        },
      ),
      row('gold', 'Oro total', mine.gold, theirs.gold, {
        mineText: amount(mine.gold),
        theirsText: amount(theirs.gold),
        mineSub: shareText(myShare.gold),
        theirsSub: shareText(theirShare.gold),
      }),
      row('tanked', 'Daño recibido', mine.damageTaken, theirs.damageTaken, {
        mineText: amount(mine.damageTaken),
        theirsText: amount(theirs.damageTaken),
      }),
    );
  }

  return rows.filter((r) => !r.noData);
}

interface RowText {
  mineText: string;
  theirsText: string;
  mineSub?: string;
  theirsSub?: string;
}

/**
 * `null`/`undefined` en cualquiera de los dos lados marca la fila como «sin datos». Un cero SÍ
 * es un dato —cero puntos de visión es una partida real— y por eso se distinguen.
 */
function row(
  key: string,
  label: string,
  mine: number | null | undefined,
  theirs: number | null | undefined,
  text: RowText,
): CrossMetricRow {
  const noData = mine == null && theirs == null;
  const a = mine ?? 0;
  const b = theirs ?? 0;
  const total = a + b;
  const minePct = total === 0 ? 50 : Math.round((a / total) * 100);

  return {
    key,
    label,
    ...text,
    minePct,
    theirsPct: 100 - minePct,
    winner: noData || a === b ? 'tie' : a > b ? 'me' : 'them',
    noData,
  };
}

function kdaText(stats: { kills?: number; deaths?: number; assists?: number }): string {
  if (stats.kills == null) return '—';
  return `${stats.kills}/${stats.deaths}/${stats.assists}`;
}

function ratioText(ratio: number | null): string | undefined {
  return ratio === null ? undefined : `${ratio.toFixed(2)} KDA`;
}

function shareText(share: number | null): string | undefined {
  return share === null ? undefined : `${share} % de su equipo`;
}

/** «—» y no «0»: lo que no se midió no es cero. */
function amount(value: number | undefined): string {
  return value == null ? '—' : formatCompact(value);
}

function plainText(value: number | undefined): string {
  return value == null ? '—' : String(value);
}

function decimalText(value: number | null): string {
  return value === null ? '—' : value.toFixed(1);
}

/** CS por minuto, derivado: el DTO trae los CS y la duración, no el ratio. */
function perMin(cs: number | undefined, durationSeconds: number | null): number | null {
  if (cs == null || !durationSeconds) return null;
  return +((cs / durationSeconds) * 60).toFixed(1);
}
