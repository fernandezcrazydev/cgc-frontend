import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { HallOfFameComponent } from './hall-of-fame.component';
import { MEDALS, MedalBoard, medalBoardsFor } from '../../../../core/group-medals';
import { Member } from '../../../../core/lobby';

function member(name: string, overrides: Partial<Member> = {}): Member {
  return {
    name,
    tag: `${name}#EUW`,
    initials: name.slice(0, 2),
    role: 'MID',
    owner: false,
    hue: 200,
    ...overrides,
  };
}

const ROSTER = [member('EduUC'), member('Adri'), member('Victor'), member('DaniG')];

function createComponent(boards: readonly MedalBoard[], loading = false) {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(HallOfFameComponent);
  fixture.componentRef.setInput('boards', boards);
  fixture.componentRef.setInput('loading', loading);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

describe('HallOfFameComponent', () => {
  let boards: MedalBoard[];

  beforeEach(() => {
    boards = medalBoardsFor('grp-1', ROSTER, 'temporada', ROSTER[0].tag);
  });

  it('pinta las veinte medallas del catálogo', () => {
    const { fixture } = createComponent(boards);

    expect(boards).toHaveLength(MEDALS.length);
    expect(fixture.nativeElement.querySelectorAll('.hof-medal')).toHaveLength(20);
  });

  it('agrupa por familia respetando el orden del catálogo', () => {
    const { component } = createComponent(boards);

    const familias = component['groups']().map((g) => g.family);
    expect(familias).toEqual(['combate', 'objetivos', 'economia', 'equipo', 'constancia', 'humor']);
    // Ninguna medalla se pierde por el camino.
    const total = component['groups']().reduce((n, g) => n + g.boards.length, 0);
    expect(total).toBe(20);
  });

  it('pide abrir la medalla que se pulsa, sin navegar por su cuenta', () => {
    const { fixture, component } = createComponent(boards);

    let abierta: string | null = null;
    component.open.subscribe((id) => (abierta = id));
    fixture.nativeElement.querySelector('.hof-medal').click();

    expect(abierta).toBe(boards[0].medal.id);
  });

  it('distingue en reposo las medallas que ya son tuyas', () => {
    const { fixture } = createComponent(boards);

    const marcadas = fixture.nativeElement.querySelectorAll('.hof-medal.is-mine').length;
    const lideradas = boards.filter((b) => b.me?.rank === 1).length;
    expect(marcadas).toBe(lideradas);
  });

  it('mientras carga no enseña medallas a medio hacer', () => {
    const { fixture } = createComponent([], true);

    expect(fixture.nativeElement.querySelectorAll('.hof-medal')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.hof').getAttribute('aria-busy')).toBe('true');
  });

  it('sin partidas lo dice, en vez de enseñar una rejilla vacía', () => {
    const { fixture } = createComponent([]);

    expect(fixture.nativeElement.querySelector('.hof__empty')).not.toBeNull();
  });
});
