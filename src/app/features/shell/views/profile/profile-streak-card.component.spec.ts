import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PlayerRecentMatch, StreakType } from '../../../../core/player-profile';
import { ProfileStreakCard } from './profile-streak-card.component';

function partida(n: number, won: boolean, extra: Partial<PlayerRecentMatch> = {}): PlayerRecentMatch {
  return {
    id: `match-${n}`,
    championId: 103,
    won,
    kills: 5,
    deaths: 2,
    assists: 7,
    kda: '5/2/7',
    lpDelta: won ? 20 : -15,
    role: 'MID',
    dateFormatted: `Hace ${n}d`,
    durationFormatted: '28:14',
    isMvp: false,
    ...extra,
  };
}

@Component({
  standalone: true,
  imports: [ProfileStreakCard],
  template: `
    <app-profile-streak-card
      [matches]="partidas()"
      [currentStreak]="racha()"
      [streakType]="tipo()"
    />
  `,
})
class Host {
  readonly partidas = signal<PlayerRecentMatch[]>([]);
  readonly racha = signal(1);
  readonly tipo = signal<StreakType>('L');
}

describe('ProfileStreakCard', () => {
  let fixture: ComponentFixture<Host>;

  const root = () => fixture.nativeElement as HTMLElement;
  const nodos = () => Array.from(root().querySelectorAll<HTMLButtonElement>('.pf-match-node'));
  const resumen = () => root().querySelector('.pf-streak-summary')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const insignia = () => root().querySelector('.pf-streak-badge')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  function conPartidas(list: PlayerRecentMatch[]): void {
    fixture.componentInstance.partidas.set(list);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  /** El motivo de existir del rediseño: la tarjeta no nace vacía. */
  it('arranca con la última partida seleccionada y el resumen ya abierto', () => {
    conPartidas([partida(3, true), partida(2, false), partida(1, true, { kda: '9/1/4' })]);

    expect(root().querySelector('.pf-streak-summary')).not.toBeNull();
    expect(resumen()).toContain('9/1/4');
    expect(nodos()[2].getAttribute('aria-pressed')).toBe('true');
    expect(nodos()[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('el resumen sigue a la partida que se elige con un clic o con hover', () => {
    conPartidas([partida(2, false, { kda: '0/8/1' }), partida(1, true, { kda: '9/1/4' })]);

    nodos()[0].dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    expect(resumen()).toContain('0/8/1');
    expect(resumen()).toContain('Derrota');
    expect(resumen()).toContain('-15 LP');

    nodos()[1].click();
    fixture.detectChanges();
    expect(resumen()).toContain('9/1/4');
  });

  it('el resumen es un enlace hacia el detalle de la partida', () => {
    conPartidas([partida(1, true)]);

    const link = root().querySelector<HTMLAnchorElement>('a.pf-streak-summary');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toContain('/app/historial/match-1');
  });

  /** El resumen es persistente: antes era un tooltip y se iba al salir el ratón. */
  it('el resumen no desaparece al quitar el ratón de encima', () => {
    conPartidas([partida(2, true), partida(1, false)]);

    nodos()[0].dispatchEvent(new MouseEvent('mouseenter'));
    nodos()[0].dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();

    expect(root().querySelector('.pf-streak-summary')).not.toBeNull();
  });

  it('conserva la selección si la lista se recalcula con las mismas partidas', () => {
    const lista = [partida(2, false, { kda: '0/8/1' }), partida(1, true)];
    conPartidas(lista);
    nodos()[0].click();
    fixture.detectChanges();

    conPartidas([...lista]);

    expect(resumen()).toContain('0/8/1');
  });

  it('salta a la última partida cuando la lista cambia por completo', () => {
    conPartidas([partida(2, false), partida(1, true)]);
    nodos()[0].click();
    fixture.detectChanges();

    conPartidas([partida(9, true, { kda: '3/3/3' })]);

    expect(resumen()).toContain('3/3/3');
  });

  it('escribe únicamente la cifra y la letra concisa de la racha (ej. 1D, 4V)', () => {
    conPartidas([partida(1, false)]);

    expect(insignia()).toBe('1D');
    expect(insignia()).not.toContain('1L');
    expect(insignia()).not.toContain('derrota');

    fixture.componentInstance.racha.set(4);
    fixture.componentInstance.tipo.set('W');
    fixture.detectChanges();

    expect(insignia()).toBe('4V');
    expect(insignia()).not.toContain('victorias');
  });

  it('cada nodo lleva un nombre accesible, porque solo pinta una letra', () => {
    conPartidas([partida(1, true, { isMvp: true })]);

    const etiqueta = nodos()[0].getAttribute('aria-label') ?? '';
    expect(etiqueta).toContain('Victoria');
    expect(etiqueta).toContain('MVP');
  });

  it('sin partidas enseña el estado vacío', () => {
    conPartidas([]);

    expect(root().querySelector('.empty-state__text')?.textContent).toContain('Todavía no hay partidas');
  });
});
