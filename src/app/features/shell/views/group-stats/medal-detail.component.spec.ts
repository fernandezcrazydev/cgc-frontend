import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MedalDetailComponent } from './medal-detail.component';
import { MedalBoard, medalBoardsFor } from '../../../../core/group-medals';
import { Member } from '../../../../core/lobby';

function member(name: string): Member {
  return {
    name,
    tag: `${name}#EUW`,
    initials: name.slice(0, 2),
    role: 'MID',
    owner: false,
    hue: 120,
  };
}

const ROSTER = [member('EduUC'), member('Adri'), member('Victor'), member('DaniG')];

function boardsFor(meTag: string | null): MedalBoard[] {
  return medalBoardsFor('grp-1', ROSTER, 'temporada', meTag);
}

/** Una medalla que alguien ha ganado de verdad; las de a cero se quedan sin dueño. */
function claimed(meTag: string | null): MedalBoard {
  const board = boardsFor(meTag).find((b) => b.leader !== null);
  expect(board).toBeDefined();
  return board!;
}

function createComponent(board: MedalBoard | null) {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(MedalDetailComponent);
  fixture.componentRef.setInput('board', board);
  fixture.detectChanges();
  return fixture;
}

describe('MedalDetailComponent', () => {
  it('encabeza con el líder actual y su cifra', () => {
    const board = claimed(ROSTER[0].tag);
    const fixture = createComponent(board);

    const nombre = fixture.nativeElement.querySelector('.md__leader-name').textContent.trim();
    expect(nombre).toBe(board.leader!.member.name);
  });

  it('enseña el podio, como mucho de tres', () => {
    const board = claimed(ROSTER[0].tag);
    const fixture = createComponent(board);

    const filas = fixture.nativeElement.querySelectorAll('.md__podium-row');
    expect(filas.length).toBe(3);
    expect(filas[0].getAttribute('data-podium')).toBe('1');
  });

  it('a quien no lidera le dice cuánto le falta para el primer puesto', () => {
    const board = boardsFor(ROSTER[0].tag).find((b) => b.me && b.me.rank > 1);
    expect(board).toBeDefined();

    const fixture = createComponent(board!);
    const texto = fixture.nativeElement.querySelector('.md__me-gap').textContent;
    expect(texto).toContain('Te faltan');
    expect(texto).toContain(board!.leader!.member.name);
  });

  it('a quien ya lidera no le promete un adelantamiento imposible', () => {
    const board = boardsFor(ROSTER[0].tag).find((b) => b.me?.rank === 1);
    expect(board).toBeDefined();

    const fixture = createComponent(board!);
    expect(board!.gap).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.md__me-gap--first'),
    ).not.toBeNull();
  });

  it('a quien no está en el grupo no le inventa un puesto', () => {
    const board = claimed(null);
    const fixture = createComponent(board);

    expect(board.me).toBeNull();
    expect(board.progress).toBeNull();
    expect(fixture.nativeElement.querySelector('.md__me')).toBeNull();
    // El líder y el podio sí se enseñan: son del grupo, no tuyos.
    expect(fixture.nativeElement.querySelector('.md__leader')).not.toBeNull();
  });

  it('sin medalla abierta no pinta nada', () => {
    const fixture = createComponent(null);

    expect(fixture.nativeElement.querySelector('.md')).toBeNull();
  });

  it('una medalla que nadie ha ganado no corona a nadie con un cero', () => {
    // Con un roster tan corto es normal que alguna métrica rara se quede a cero.
    const vacia = boardsFor(ROSTER[0].tag).find((b) => b.leader === null);
    if (!vacia) return;

    const fixture = createComponent(vacia);

    expect(vacia.podium).toHaveLength(0);
    expect(vacia.me).toBeNull();
    expect(fixture.nativeElement.querySelector('.md__vacant')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.md__leader')).toBeNull();
  });
});
