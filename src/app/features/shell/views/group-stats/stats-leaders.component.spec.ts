import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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
    providers: [provideHttpClient(), provideHttpClientTesting()],
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
});
