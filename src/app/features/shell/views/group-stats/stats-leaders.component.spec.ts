import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StatsLeadersComponent } from './stats-leaders.component';
import { PlayerStatsView, playersOf } from '../../../../core/group-stats';
import { groupStats } from './stats-fixture';

const PLAYERS: PlayerStatsView[] = playersOf(groupStats());

function createComponent(expandedUserId: string | null = null, loading = false) {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const fixture = TestBed.createComponent(StatsLeadersComponent);
  fixture.componentRef.setInput('players', PLAYERS);
  fixture.componentRef.setInput('expandedUserId', expandedUserId);
  fixture.componentRef.setInput('loading', loading);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

/** La misma tabla con los jugadores que le pases: para los bordes que el fixture base no tiene. */
function withPlayers(players: PlayerStatsView[], expandedUserId: string | null = null) {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const fixture = TestBed.createComponent(StatsLeadersComponent);
  fixture.componentRef.setInput('players', players);
  fixture.componentRef.setInput('expandedUserId', expandedUserId);
  fixture.componentRef.setInput('loading', false);
  fixture.detectChanges();
  return fixture;
}

describe('StatsLeadersComponent', () => {
  it('ordena por el rating del grupo, que es lo que la tabla promete', () => {
    const { component } = createComponent();

    const ratings = component['rows']().map((p) => p.rating ?? 0);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
  });

  /**
   * Quien no tiene fila de rating en esta modalidad **no es el peor**: es que no está puntuado. Con
   * un cero por defecto se colaría entre los últimos como si lo fuera, y nada en la tabla lo
   * distinguiría de alguien que de verdad esté a cero.
   */
  it('quien no tiene rating va al final y no se confunde con el peor', () => {
    const stats = groupStats();
    const players = playersOf({
      ...stats,
      players: [{ ...stats.players[0], rating: null, ratingRank: null }, ...stats.players.slice(1)],
    });

    const rows = withPlayers(players).componentInstance['rows']();

    expect(rows[rows.length - 1].rating).toBeNull();
  });

  it('pinta una fila por jugador', () => {
    const { fixture } = createComponent();

    expect(fixture.nativeElement.querySelectorAll('.ld-row')).toHaveLength(PLAYERS.length);
  });

  it('solo despliega la fila que le indican', () => {
    const abierto = PLAYERS[1].person.userId;
    const { fixture } = createComponent(abierto);

    const abiertas = fixture.nativeElement.querySelectorAll('.ld-detail');
    expect(abiertas).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('.ld-row.is-open')).toHaveLength(1);
  });

  it('pide abrir la fila pulsada en vez de guardarse el estado', () => {
    const { fixture, component } = createComponent();

    let pedido: string | null = null;
    component.toggle.subscribe((userId) => (pedido = userId));
    fixture.nativeElement.querySelector('.ld-row__btn').click();

    // Pide el `userId` y no el Riot ID: es la clave estable, y es lo que la vista guarda en la URL.
    expect(pedido).toBe(component['rows']()[0].person.userId);
  });

  it('la fila desplegada expone su estado a un lector de pantalla', () => {
    const abierto = PLAYERS[0].person.userId;
    const { fixture } = createComponent(abierto);

    const botones: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.ld-row__btn'),
    );
    const expandidos = botones.filter((b) => b.getAttribute('aria-expanded') === 'true');
    expect(expandidos).toHaveLength(1);
  });

  it('mientras carga no enseña filas a medias', () => {
    const { fixture } = createComponent(null, true);

    expect(fixture.nativeElement.querySelectorAll('.ld-row')).toHaveLength(0);
  });

  it('permite ordenar por KDA descendente y alternar a ascendente al pulsar de nuevo', () => {
    const { fixture, component } = createComponent();

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.ld-th'));
    const kdaButton = buttons.find((b) => b.textContent?.includes('KDA'));
    expect(kdaButton).toBeDefined();

    // 1er click: ordenar por KDA descendente
    kdaButton!.click();
    fixture.detectChanges();

    expect(component.sortColumn()).toBe('kda');
    expect(component.sortAsc()).toBe(false);
    expect(kdaButton!.classList.contains('is-active')).toBe(true);

    const kdas = component['rows']().map((p) => p.kda);
    expect(kdas).toEqual([...kdas].sort((a, b) => b - a));

    // 2do click: alternar a ascendente
    kdaButton!.click();
    fixture.detectChanges();

    expect(component.sortAsc()).toBe(true);
    const kdasAsc = component['rows']().map((p) => p.kda);
    expect(kdasAsc).toEqual([...kdasAsc].sort((a, b) => a - b));
  });

  it('permite ordenar por CS, Visión, Daño y Partidas', () => {
    const { fixture, component } = createComponent();

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.ld-th'));
    const csBtn = buttons.find((b) => b.textContent?.includes('CS'));
    const visBtn = buttons.find((b) => b.textContent?.includes('Visión'));
    const dmgBtn = buttons.find((b) => b.textContent?.includes('Daño'));
    const gamesBtn = buttons.find((b) => b.textContent?.includes('Partidas'));

    csBtn!.click();
    fixture.detectChanges();
    expect(component.sortColumn()).toBe('cs');
    const csVals = component['rows']().map((p) => p.csPerMin);
    expect(csVals).toEqual([...csVals].sort((a, b) => b - a));

    visBtn!.click();
    fixture.detectChanges();
    expect(component.sortColumn()).toBe('vision');
    const visVals = component['rows']().map((p) => p.visionScore);
    expect(visVals).toEqual([...visVals].sort((a, b) => b - a));

    dmgBtn!.click();
    fixture.detectChanges();
    expect(component.sortColumn()).toBe('damage');
    const dmgVals = component['rows']().map((p) => p.dmgK);
    expect(dmgVals).toEqual([...dmgVals].sort((a, b) => b - a));

    gamesBtn!.click();
    fixture.detectChanges();
    expect(component.sortColumn()).toBe('games');
    const gamesVals = component['rows']().map((p) => p.games);
    expect(gamesVals).toEqual([...gamesVals].sort((a, b) => b - a));
  });

  it('permite ordenar por nombre de jugador alfabéticamente', () => {
    const { fixture, component } = createComponent();

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.ld-th'));
    const nameBtn = buttons.find((b) => b.textContent?.includes('Jugador'));

    nameBtn!.click();
    fixture.detectChanges();
    expect(component.sortColumn()).toBe('name');
    expect(component.sortAsc()).toBe(true);

    const names = component['rows']().map((p) => p.person.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  /**
   * Vuelven a ser enlaces, y esta vez apuntan a algo. Dejaron de serlo porque el dúo y la némesis
   * se los inventaba el cliente y viajaban con un Riot ID, mientras que la pantalla del cruce se
   * abre por `userId`: el enlace aterrizaba en «Jugador no encontrado». Lo que este test protege es
   * exactamente eso — que el href lleve el id y no el tag.
   */
  it('enlaza el mejor dúo y la némesis al cruce, por userId', () => {
    const { fixture } = createComponent(PLAYERS[0].person.userId);

    const duo = fixture.nativeElement.querySelector('.ld-affinity--duo');
    const nemesis = fixture.nativeElement.querySelector('.ld-affinity--nemesis');

    expect(duo.tagName).toBe('A');
    expect(nemesis.tagName).toBe('A');
    // u-1 gana 5 de 6 con u-2 (su mejor dúo) y pierde 4 de 5 contra u-4 (su némesis).
    expect(duo.getAttribute('href')).toBe('/app/jugador/u-2/juntos');
    expect(nemesis.getAttribute('href')).toBe('/app/jugador/u-4/contra');
  });

  /** Y quien no ha coincidido con nadie no enseña un dúo vacío: enseña que no lo hay. */
  it('sin nadie con quien haber jugado, lo dice en vez de inventar un dúo', () => {
    const fixture = withPlayers(playersOf(groupStats({ duos: [] })), 'u-1');

    expect(fixture.nativeElement.querySelector('.ld-affinity--duo')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.ld-affinity--empty')).toHaveLength(2);
  });
});
