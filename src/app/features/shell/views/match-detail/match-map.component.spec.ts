import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MatchTimelineStore } from '../../../../core/matches';
import {
  matchFixture,
  participantFixture,
} from '../../../../core/matches/match-fixtures';
import { Match, MatchTimelinePositions } from '../../../../core/matches/models';
import { MatchMapComponent } from './match-map.component';

const ME = 'me-uuid';
const RIVAL = 'rival-uuid';

function partida(): Match {
  return matchFixture({
    id: 'm1',
    a: [participantFixture({ userId: ME, slot: 'A', riotId: 'Yo#LAN' })],
    b: [participantFixture({ userId: RIVAL, slot: 'B', riotId: 'Rival#LAN' })],
  });
}

const DOS_MINUTOS: MatchTimelinePositions = {
  available: true,
  frames: [
    {
      minute: 0,
      positions: [
        { userId: ME, teamSlot: 'A', x: 0, y: 0, totalGold: 500, level: 1 },
        { userId: RIVAL, teamSlot: 'B', x: 14870, y: 14870, totalGold: 500, level: 1 },
      ],
    },
    {
      minute: 1,
      positions: [
        { userId: ME, teamSlot: 'A', x: 7435, y: 7435, totalGold: 900, level: 2 },
      ],
    },
  ],
};

/**
 * El mapa de presencia (`cgc-backend#96`).
 *
 * <p>Lo que este spec protege es <strong>la conversión de coordenadas</strong>, que es donde vive el
 * único error de verdad de esta pantalla: la `y` del juego crece hacia arriba y la de la pantalla
 * hacia abajo. Sin el volteo el mapa sale del revés, la base azul aparece arriba, y eso no lo nota
 * quien no conoce el mapa — que es justo la definición de una mentira que no se detecta mirando.
 */
describe('MatchMapComponent', () => {
  let fixture: ComponentFixture<MatchMapComponent>;
  let positions: WritableSignal<MatchTimelinePositions>;
  let status: WritableSignal<string>;

  async function montar(datos: MatchTimelinePositions = DOS_MINUTOS, estado = 'ready') {
    positions = signal(datos);
    status = signal(estado);

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [MatchMapComponent],
        providers: [
          {
            provide: MatchTimelineStore,
            useValue: {
              positions,
              positionsStatus: status,
              ensurePositions: () => Promise.resolve(),
              reloadPositions: () => Promise.resolve(),
            },
          },
        ],
      })
      .compileComponents();

    fixture = TestBed.createComponent(MatchMapComponent);
    fixture.componentRef.setInput('matchId', 'm1');
    fixture.componentRef.setInput('match', partida());
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /** Un punto por jugador del minuto que se está mirando, con su nombre encima. */
  it('pinta un punto por jugador del minuto activo', async () => {
    const el = await montar();

    expect(el.querySelectorAll('.mm__dot')).toHaveLength(2);
    expect(el.textContent).toContain('Yo');
    expect(el.textContent).toContain('Rival');
  });

  /**
   * <strong>La `y` se voltea.</strong> Una posición en (0,0) es la esquina de abajo a la izquierda
   * del juego, que en pantalla es abajo del todo: `top` tiene que ser 100, no 0.
   */
  it('voltea la y del juego, que crece al reves que la de la pantalla', async () => {
    await montar();
    const component = fixture.componentInstance as unknown as {
      dots: () => { userId: string; left: number; top: number }[];
    };

    const abajoIzquierda = component.dots().find((d) => d.userId === ME);
    expect(abajoIzquierda?.left).toBe(0);
    expect(abajoIzquierda?.top).toBe(100);

    const arribaDerecha = component.dots().find((d) => d.userId === RIVAL);
    expect(arribaDerecha?.left).toBe(100);
    expect(arribaDerecha?.top).toBe(0);
  });

  /** El minuto lo mueve la persona, y al moverlo cambian los puntos. */
  it('cambiar de minuto cambia los puntos', async () => {
    const el = await montar();
    const component = fixture.componentInstance as unknown as {
      minute: { set: (v: number) => void };
    };

    component.minute.set(1);
    fixture.detectChanges();

    expect(el.querySelectorAll('.mm__dot')).toHaveLength(1);
  });

  /**
   * Una exportación reducida trae eventos y no trae recorrido. Se dice cuál de las dos cosas falta
   * en vez de dejar el hueco, y no se pinta un mapa vacío que se lea como «no se movió nadie».
   */
  it('sin posiciones lo dice, y no pinta un mapa vacio', async () => {
    const el = await montar({ available: true, frames: [] });

    expect(el.textContent).toContain('no tiene posiciones guardadas');
    expect(el.querySelector('.mm__dot')).toBeNull();
  });

  it('un fallo de red ofrece reintentar', async () => {
    const el = await montar(DOS_MINUTOS, 'error');

    expect(el.textContent).toContain('Reintentar');
  });

  it('mientras viaja reserva el hueco del mapa con un esqueleto', async () => {
    const el = await montar(DOS_MINUTOS, 'loading');

    expect(el.querySelector('nf-skeleton')).not.toBeNull();
    expect(el.querySelector('.mm__dot')).toBeNull();
  });

  /**
   * Lo que este bloque NO enseña, y no es un olvido: la timeline del cliente de LoL no trae eventos
   * de ward, así que un control de visión aquí sería la maqueta de 36 coordenadas otra vez. El pie
   * lo dice en voz alta para que nadie lo pida como si faltara por conectar.
   */
  it('dice en pantalla que no hay wards, en vez de dejar el hueco sin explicar', async () => {
    const el = await montar();

    expect(el.textContent).toContain('No hay wards');
  });
});
