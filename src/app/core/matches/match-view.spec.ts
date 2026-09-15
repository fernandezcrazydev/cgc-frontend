import { describe, expect, it } from 'vitest';
import { participantShortName } from './match-view';
import { participantFixture } from './match-fixtures';

/**
 * El nombre corto existe para las cajas estrechas —las menciones de honor, el podio—, donde la
 * región se come el ancho sin distinguir a nadie: dentro de un grupo suelen jugar todos en la
 * misma. El completo sigue yendo al `title`.
 */
describe('participantShortName', () => {
  it('quita la región del Riot ID', () => {
    expect(participantShortName(participantFixture({ userId: 'u1', slot: 'A', riotId: 'CrazyDragon#EUW' })))
      .toBe('CrazyDragon');
  });

  it('un nombre sin etiqueta se queda como está', () => {
    expect(participantShortName(participantFixture({ userId: 'u1', slot: 'A', riotId: null, discordUsername: 'Edu' })))
      .toBe('Edu');
  });

  it('sin identidad ninguna, el respaldo sigue siendo legible', () => {
    expect(participantShortName(participantFixture({ userId: 'u1', slot: 'A', riotId: null, discordUsername: null })))
      .toBe('Sin identificar');
  });
});
