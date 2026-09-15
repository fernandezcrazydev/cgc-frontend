import { describe, expect, it } from 'vitest';
import { toCrossMatches } from '../../../../core/matches';
import { matchFixture, participantFixture } from '../../../../core/matches/match-fixtures';
import { avatarGradient, nameOf, resolveCrossPlayer } from './cross-player';

/**
 * `resolveCrossPlayer` decide si las vistas del cruce enseñan a alguien o su 404. Distinguir
 * «no existe» de «existe pero no habéis coincidido» es justo lo que separa un 404 de un estado
 * vacío, así que es lo que se afirma aquí.
 *
 * La identidad es el `userId`, que es lo que entiende el parámetro `with=` del endpoint, y el
 * nombre sale del propio asiento: desde el contrato nuevo cada uno de los diez trae su nombre de
 * Discord y su avatar haya subida o no, así que no hace falta ningún censo.
 */
const RIVAL = '22222222-2222-2222-2222-222222222222';
const ME = '11111111-1111-1111-1111-111111111111';

/** Una partida en la que el usuario y el rival coinciden en bandos opuestos. */
function cruce(over: { riotId?: string | null; discordUsername?: string | null } = {}) {
  const me = participantFixture({ userId: ME, slot: 'A', riotId: 'Yo#LAN' });
  const other = participantFixture({
    userId: RIVAL,
    slot: 'B',
    riotId: over.riotId === undefined ? 'Pix3lQueen#LAN' : over.riotId,
    discordUsername: over.discordUsername === undefined ? 'pix3lqueen' : over.discordUsername,
    avatarUrl: 'https://cdn/avatar.png',
  });
  return toCrossMatches(
    [matchFixture({ id: 'p1', a: [me], b: [other], userParticipant: me })],
    RIVAL,
  );
}

describe('resolveCrossPlayer', () => {
  it('sale del asiento del cruce, con su nombre y su avatar', () => {
    const quien = resolveCrossPlayer(RIVAL, cruce());

    expect(quien?.name).toBe('Pix3lQueen');
    expect(quien?.userId).toBe(RIVAL);
    expect(quien?.avatarUrl).toBe('https://cdn/avatar.png');
  });

  /*
   * Sin subida no hay Riot ID —el de hoy podría ser ya de otra persona— pero el nombre de
   * Discord llega igual. Es el caso que antes dejaba la cabecera muda.
   */
  it('sin subida lo nombra por su Discord', () => {
    const quien = resolveCrossPlayer(RIVAL, cruce({ riotId: null }));

    expect(quien?.name).toBe('pix3lqueen');
  });

  /** Solo cuando la cuenta se borró: la partida siguió pasando, y su hueco se pinta igual. */
  it('sin ninguna de las dos identidades lo dice, en vez de dejar el hueco en blanco', () => {
    const quien = resolveCrossPlayer(RIVAL, cruce({ riotId: null, discordUsername: null }));

    expect(quien?.name).toBe('Sin identificar');
  });

  it('devuelve null —que es el 404— cuando no habéis coincidido', () => {
    expect(resolveCrossPlayer(RIVAL, [])).toBeNull();
    expect(resolveCrossPlayer('otro-uuid', cruce())).toBeNull();
  });

  it('un parámetro vacío o en blanco es un 404, no el primer jugador que haya', () => {
    expect(resolveCrossPlayer('', cruce())).toBeNull();
    expect(resolveCrossPlayer('   ', cruce())).toBeNull();
  });
});

describe('toCrossMatches', () => {
  it('lee la relación de los dos huecos de equipo, no la adivina', () => {
    const me = participantFixture({ userId: ME, slot: 'A' });
    const aliado = participantFixture({ userId: RIVAL, slot: 'A' });
    const rival = participantFixture({ userId: RIVAL, slot: 'B' });

    const juntos = toCrossMatches(
      [matchFixture({ id: 'j', a: [me, aliado], b: [], userParticipant: me })],
      RIVAL,
    );
    const contra = toCrossMatches(
      [matchFixture({ id: 'c', a: [me], b: [rival], userParticipant: me })],
      RIVAL,
    );

    expect(juntos[0].relation).toBe('ally');
    expect(contra[0].relation).toBe('enemy');
  });

  it('una partida en la que el otro no aparece se descarta, no se pinta a medias', () => {
    const me = participantFixture({ userId: ME, slot: 'A' });
    const ajeno = participantFixture({ userId: 'tercero', slot: 'B' });

    expect(
      toCrossMatches([matchFixture({ id: 'x', a: [me], b: [ajeno], userParticipant: me })], RIVAL),
    ).toEqual([]);
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
