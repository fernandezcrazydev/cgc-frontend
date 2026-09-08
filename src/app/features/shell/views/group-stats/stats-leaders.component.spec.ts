import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StatsLeadersComponent } from './stats-leaders.component';
import { MemberStats, statsFor } from '../../../../core/group-stats';
import { Member } from '../../../../core/lobby';

function member(name: string): Member {
  return {
    name,
    tag: `${name}#EUW`,
    initials: name.slice(0, 2),
    role: 'MID',
    owner: false,
    hue: 40,
  };
}

const ROSTER = [member('EduUC'), member('Adri'), member('Victor'), member('DaniG'), member('Pau')];
const PLAYERS: MemberStats[] = statsFor('grp-1', ROSTER, 'temporada');

function createComponent(expandedTag: string | null = null, loading = false) {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const fixture = TestBed.createComponent(StatsLeadersComponent);
  fixture.componentRef.setInput('players', PLAYERS);
  fixture.componentRef.setInput('expandedTag', expandedTag);
  fixture.componentRef.setInput('loading', loading);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

describe('StatsLeadersComponent', () => {
  it('ordena por la valoración compuesta, que es lo que la tabla promete', () => {
    const { component } = createComponent();

    const ratings = component['rows']().map((p) => p.rating);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
  });

  it('pinta una fila por jugador', () => {
    const { fixture } = createComponent();

    expect(fixture.nativeElement.querySelectorAll('.ld-row')).toHaveLength(ROSTER.length);
  });

  it('solo despliega la fila que le indican', () => {
    const abierto = PLAYERS[1].member.tag;
    const { fixture } = createComponent(abierto);

    const abiertas = fixture.nativeElement.querySelectorAll('.ld-detail');
    expect(abiertas).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('.ld-row.is-open')).toHaveLength(1);
  });

  it('pide abrir la fila pulsada en vez de guardarse el estado', () => {
    const { fixture, component } = createComponent();

    let pedido: string | null = null;
    component.toggle.subscribe((tag) => (pedido = tag));
    fixture.nativeElement.querySelector('.ld-row__btn').click();

    // El primero de la tabla es el de mayor valoración, no el primero del roster.
    expect(pedido).toBe(component['rows']()[0].member.tag);
  });

  it('la fila desplegada expone su estado a un lector de pantalla', () => {
    const abierto = PLAYERS[0].member.tag;
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

    const names = component['rows']().map((p) => p.member.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('muestra las tarjetas pulsables de mejor dúo y némesis en el desglose', () => {
    const jugador = PLAYERS[0].member.tag;
    const { fixture } = createComponent(jugador);

    const duoLink = fixture.nativeElement.querySelector('.ld-affinity--duo');
    const nemesisLink = fixture.nativeElement.querySelector('.ld-affinity--nemesis');

    expect(duoLink).not.toBeNull();
    expect(nemesisLink).not.toBeNull();
    expect(duoLink.getAttribute('href')).toContain('/app/jugador/');
    expect(duoLink.getAttribute('href')).toContain('/juntos');
    expect(nemesisLink.getAttribute('href')).toContain('/app/jugador/');
    expect(nemesisLink.getAttribute('href')).toContain('/contra');
  });
});
