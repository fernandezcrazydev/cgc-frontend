import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MedalDetailComponent } from './medal-detail.component';
import { MedalBoard, medalBoardsOf, playersOf } from '../../../../core/group-stats';
import { groupStats, player } from './stats-fixture';

const ME = 'u-1';

function boardsFor(meUserId: string | null): MedalBoard[] {
  return medalBoardsOf(playersOf(groupStats()), meUserId);
}

/** Una medalla que alguien ha ganado de verdad; las de a cero se quedan sin dueño. */
function claimed(meUserId: string | null): MedalBoard {
  const board = boardsFor(meUserId).find((b) => b.leader !== null);
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
  it('encabeza con el líder actual, su cifra y su trofeo dorado', () => {
    const board = claimed(ME);
    const fixture = createComponent(board);

    const nombre = fixture.nativeElement.querySelector('.md__leader-name').textContent.trim();
    expect(nombre).toBe(board.leader!.person.name);
    const trofeo = fixture.nativeElement.querySelector('.md__leader-trophy');
    expect(trofeo).not.toBeNull();
    expect(trofeo.getAttribute('src')).toBe('/assets/trofeos/Trofeo1.webp');
  });

  it('enseña el podio, como mucho de tres con sus trofeos de metagame', () => {
    const board = claimed(ME);
    const fixture = createComponent(board);

    const filas = fixture.nativeElement.querySelectorAll('.md__podium-row');
    expect(filas.length).toBe(3);
    expect(filas[0].getAttribute('data-podium')).toBe('1');
    const trofeo1 = filas[0].querySelector('.md__podium-trophy');
    const trofeo2 = filas[1].querySelector('.md__podium-trophy');
    const trofeo3 = filas[2].querySelector('.md__podium-trophy');
    expect(trofeo1?.getAttribute('src')).toBe('/assets/trofeos/Trofeo1.webp');
    expect(trofeo2?.getAttribute('src')).toBe('/assets/trofeos/Trofeo2.webp');
    expect(trofeo3?.getAttribute('src')).toBe('/assets/trofeos/Trofeo3.webp');
  });

  it('a quien no lidera le dice cuánto le falta para el primer puesto', () => {
    const board = boardsFor(ME).find((b) => b.me && b.me.rank > 1);
    expect(board).toBeDefined();

    const fixture = createComponent(board!);
    const texto = fixture.nativeElement.querySelector('.md__me-gap').textContent;
    expect(texto).toContain('Te faltan');
    expect(texto).toContain(board!.leader!.person.name);
  });

  it('a quien ya lidera no le promete un adelantamiento imposible', () => {
    const board = boardsFor(ME).find((b) => b.me?.rank === 1);
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
    const vacia = boardsFor(ME).find((b) => b.leader === null);
    if (!vacia) return;

    const fixture = createComponent(vacia);

    expect(vacia!.podium).toHaveLength(0);
    expect(vacia!.me).toBeNull();
    expect(fixture.nativeElement.querySelector('.md__vacant')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.md__leader')).toBeNull();
  });
});
