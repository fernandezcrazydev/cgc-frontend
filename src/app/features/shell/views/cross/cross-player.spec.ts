import { describe, expect, it } from 'vitest';
import { Member } from '../../../../core/lobby';
import { buildCrossMatches } from '../../../../core/matches';
import { matchFixture, participantFixture } from '../../../../core/matches/match-fixtures';
import { avatarGradient, nameOf, resolveCrossPlayer } from './cross-player';

/**
 * `resolveCrossPlayer` decide si una de las cuatro vistas del cruce enseña a alguien o su 404,
 * y no tenía ninguna prueba. Distinguir «no existe» de «existe pero no habéis coincidido» es
 * justo lo que separa un 404 de un estado vacío, así que es lo que se afirma aquí.
 */
const roster: Member[] = [
  {
    userId: 'UUID-Con-Mayusculas',
    name: 'Pix3lQueen',
    tag: 'Pix3lQueen#LAN',
    role: 'Miembro',
    initials: 'PQ',
    owner: false,
    hue: 200,
  },
];

/** Una partida en la que el usuario y `riotId` coinciden en bandos opuestos. */
function cruce(riotId: string) {
  const me = participantFixture({ id: 'me', team: 'blue', riotId: 'Yo#LAN' });
  const other = participantFixture({ id: 'ellos', team: 'red', riotId });
  return buildCrossMatches(
    [matchFixture({ id: 'p1', blue: [me], red: [other], userParticipant: me })],
    riotId,
  );
}

describe('resolveCrossPlayer', () => {
  it('resuelve por el tag completo, sin distinguir mayúsculas', () => {
    expect(resolveCrossPlayer('pix3lqueen#lan', roster, [])?.name).toBe('Pix3lQueen');
  });

  /*
   * El id estable se comparaba contra la clave ya pasada a minúsculas, así que esta rama no
   * podía acertar nunca con un id que llevase mayúsculas: se caía al tag sin que se notase.
   */
  it('resuelve también por el id estable, respetando sus mayúsculas', () => {
    expect(resolveCrossPlayer('UUID-Con-Mayusculas', roster, [])?.name).toBe('Pix3lQueen');
  });

  it('resuelve a quien ya no está en el roster pero sí en vuestras partidas', () => {
    const quien = resolveCrossPlayer('Antiguo#LAN', [], cruce('Antiguo#LAN'));

    expect(quien).not.toBeNull();
    expect(quien!.name).toBe('Antiguo');
    expect(quien!.tag).toBe('Antiguo#LAN');
  });

  it('devuelve null —que es el 404— cuando no está en ninguna de las dos fuentes', () => {
    expect(resolveCrossPlayer('NoExiste#EUW', roster, [])).toBeNull();
  });

  it('un parámetro vacío o en blanco es un 404, no el primer jugador que haya', () => {
    expect(resolveCrossPlayer('', roster, cruce('Antiguo#LAN'))).toBeNull();
    expect(resolveCrossPlayer('   ', roster, cruce('Antiguo#LAN'))).toBeNull();
  });

  it('el roster manda sobre las partidas: es donde vive la identidad visual', () => {
    const quien = resolveCrossPlayer('Pix3lQueen#LAN', roster, cruce('Pix3lQueen#LAN'));

    expect(quien!.hue).toBe(200);
    expect(quien!.tag).toBe('Pix3lQueen#LAN');
  });
});

describe('nameOf', () => {
  it('se queda con el nombre y deja fuera la región', () => {
    expect(nameOf('Pix3lQueen#LAN')).toBe('Pix3lQueen');
  });

  it('un nombre sin región se devuelve tal cual, no vacío', () => {
    expect(nameOf('Pix3lQueen')).toBe('Pix3lQueen');
  });
});

describe('avatarGradient', () => {
  it('el mismo tono da siempre el mismo degradado', () => {
    expect(avatarGradient(200)).toBe(avatarGradient(200));
    expect(avatarGradient(200)).not.toBe(avatarGradient(20));
  });
});
