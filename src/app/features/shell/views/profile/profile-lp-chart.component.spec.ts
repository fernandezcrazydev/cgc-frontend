import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ProfileGroupRecord } from '../../../../core/player-profile';
import { ProfileLpChartComponent } from './profile-lp-chart.component';

function grupo(n: number, lp = 500): ProfileGroupRecord {
  return {
    id: `g${n}`,
    name: `Grupo ${n}`,
    initials: `G${n}`,
    c1: '#111',
    c2: '#222',
    role: 'Miembro',
    games: 30,
    wins: 20,
    losses: 10,
    wr: 67,
    rankPosition: n,
    lp,
    seasonName: 'Temporada 2026-Q3',
  };
}

@Component({
  standalone: true,
  imports: [ProfileLpChartComponent],
  template: `<app-profile-lp-chart [groups]="grupos()" playerTag="Daxlup#EUW" />`,
})
class Host {
  readonly grupos = signal<ProfileGroupRecord[]>([]);
}

/**
 * Lo que protege este spec es que **el perfil siga pintando la gráfica del hub** y no una copia:
 * comprueba las clases `hub-lp__*`, que son de `HubLpChartComponent`. Si alguien vuelve a dibujar
 * aquí un SVG propio, estas expectativas se caen, que es exactamente lo que deben hacer.
 *
 * El comportamiento de las tres ligas —interruptores, eje, tooltip— se prueba una sola vez, en
 * `group-hub/hub-lp-chart.component.spec.ts`. Repetirlo aquí sería probar el mismo componente dos
 * veces con otro nombre.
 */
describe('ProfileLpChartComponent', () => {
  let fixture: ComponentFixture<Host>;

  const root = () => fixture.nativeElement as HTMLElement;
  /* El de la cabecera es el de GRUPO. Dentro de la tarjeta hay otros: el de temporada de cada
     liga, que es cosa de la gráfica y se prueba en su propio spec. */
  const selectorDeGrupo = () =>
    root().querySelector<HTMLSelectElement>('.hub-card__head nf-select select');

  function setGrupos(list: ProfileGroupRecord[]): void {
    fixture.componentInstance.grupos.set(list);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('sin grupos no dibuja ninguna curva', () => {
    setGrupos([]);

    expect(root().querySelector('.hub-lp__plot')).toBeNull();
  });

  it('delega en la gráfica del hub, con su título propio', () => {
    setGrupos([grupo(1, 780)]);

    expect(root().querySelector('app-hub-lp-chart')).not.toBeNull();
    expect(root().querySelector('.hub-card__title')?.textContent).toContain(
      'Tu evolución de LP por liga',
    );
    expect(root().querySelector('.hub-lp__svg')).not.toBeNull();
  });

  it('trae las tres ligas del grupo, cada una con su interruptor', () => {
    setGrupos([grupo(1, 780)]);

    const ligas = Array.from(root().querySelectorAll('.hub-lp__league-name')).map((n) =>
      n.textContent?.trim(),
    );
    expect(ligas).toEqual(['Competitivo', 'Equilibrado', 'Caos']);
  });

  it('con un solo grupo no hay nada que elegir y el desplegable no se pinta', () => {
    setGrupos([grupo(1, 780)]);

    expect(selectorDeGrupo()).toBeNull();
  });

  it('con varios grupos el desplegable de la cabecera elige grupo, no temporada', () => {
    setGrupos([grupo(1, 780), grupo(2, 450)]);

    const opciones = Array.from(selectorDeGrupo()!.options).map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Grupo 1', 'Grupo 2']);
  });

  it('cambiar de grupo cambia la curva', () => {
    setGrupos([grupo(1, 780), grupo(2, 450)]);

    const antes = root().querySelector('.hub-lp__line')?.getAttribute('d');

    const select = selectorDeGrupo()!;
    select.value = 'g2';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(root().querySelector('.hub-lp__line')?.getAttribute('d')).not.toBe(antes);
  });

  /**
   * Los ids de temporada son de la liga de UN grupo. Arrastrar «Temp. 2» al grupo siguiente
   * enseñaría su temporada 2, que no tiene nada que ver, o ninguna.
   */
  it('cambiar de grupo suelta la temporada elegida y vuelve a la más reciente', () => {
    setGrupos([grupo(1, 780), grupo(2, 450)]);

    // La semilla es determinista: si deja de dar una liga con historia, este test avisa en vez
    // de pasar sin comprobar nada.
    const select = () =>
      root().querySelector<HTMLSelectElement>('.hub-lp__league-season select')!;
    expect(select()).not.toBeNull();

    const reciente = select().value;
    const otra = [...select().options].find((o) => o.value !== reciente)!;
    select().value = otra.value;
    select().dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(select().value).toBe(otra.value);

    const grupoSelect = selectorDeGrupo()!;
    grupoSelect.value = 'g2';
    grupoSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    grupoSelect.value = 'g1';
    grupoSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(select().value).toBe(reciente);
  });

  it('si el grupo elegido desaparece de la lista, la gráfica cae al primero que quede', () => {
    setGrupos([grupo(1, 780), grupo(2, 450)]);

    const select = selectorDeGrupo()!;
    select.value = 'g2';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    setGrupos([grupo(1, 780)]);

    expect(selectorDeGrupo()).toBeNull();
    expect(root().querySelector('.hub-lp__plot')).not.toBeNull();
  });
});
