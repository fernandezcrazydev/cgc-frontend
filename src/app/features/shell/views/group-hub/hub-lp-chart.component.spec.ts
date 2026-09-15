import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { HubLeagueSeries, HubLpPoint } from '../../../../core/group-hub';
import { StatModality } from '../../../../core/group-stats';
import { HubLpChartComponent, LeagueSeasonChange } from './hub-lp-chart.component';

/** El eje es «días de temporada»: toda curva arranca en el día 0, su primera partida. */
function puntos(duracionDias: number, lps: number[]): HubLpPoint[] {
  const paso = lps.length > 1 ? duracionDias / (lps.length - 1) : 0;
  return lps.map((lp, i) => {
    const day = Math.round(i * paso);
    return { label: 'día ' + day, day, lp };
  });
}

function liga(
  modality: StatModality,
  label: string,
  points: HubLpPoint[],
  extra: Partial<HubLeagueSeries> = {},
): HubLeagueSeries {
  const lp = points.length ? points[points.length - 1].lp : 0;
  return {
    modality,
    label,
    seasons: points.length ? [{ id: 's1', label: 'Temp. 1 · Liga de Otoño 2026' }] : [],
    seasonId: points.length ? 's1' : '',
    seasonLabel: points.length ? 'Temp. 1 · Liga de Otoño 2026' : 'Sin empezar',
    started: points.length > 0,
    points,
    rank: 2,
    lp,
    netLp: points.length ? lp - points[0].lp : 0,
    winrate: 60,
    ...extra,
  };
}

/** Temporada de seis meses: el eje llega al día 150. */
const COMPETITIVO = liga('COMPETITIVE', 'Competitivo', puntos(150, [100, 200, 300]));
/** Temporada de dos meses: acaba antes en el eje, que es justo lo que debe verse. */
const EQUILIBRADO = liga('BALANCED', 'Equilibrado', puntos(60, [400, 450, 500]));
/** Sin empezar: nace a nulo y arranca con su primera partida (`FlujoJuego.md` §3.2). */
const CAOS_SIN_EMPEZAR = liga('CHAOS', 'Caos', [], { started: false });

/** Competitivo con tres temporadas jugadas: el caso que estrena el desplegable. */
const COMPETITIVO_CON_HISTORIA = liga('COMPETITIVE', 'Competitivo', puntos(150, [100, 200, 300]), {
  seasons: [
    { id: 's3', label: 'Temp. 3 · Copa del Nexo' },
    { id: 's2', label: 'Temp. 2 · Liga de Otoño 2026' },
    { id: 's1', label: 'Temp. 1 · Copa del Nexo' },
  ],
  seasonId: 's3',
  seasonLabel: 'Temp. 3 · Copa del Nexo',
});

@Component({
  standalone: true,
  imports: [HubLpChartComponent],
  template: `<app-hub-lp-chart
    [leagues]="ligas()"
    [loading]="cargando()"
    (leagueSeasonChange)="elegido.push($event)"
  />`,
})
class Host {
  readonly ligas = signal<HubLeagueSeries[]>([]);
  readonly cargando = signal(false);
  readonly elegido: LeagueSeasonChange[] = [];
}

describe('HubLpChartComponent · las tres ligas del grupo', () => {
  let fixture: ComponentFixture<Host>;

  const root = () => fixture.nativeElement as HTMLElement;
  const lineas = () => root().querySelectorAll('.hub-lp__line');
  /* El interruptor es el bloque de arriba de la tarjeta, no la tarjeta entera: dentro de la
     tarjeta vive el desplegable de temporada, y un `select` no puede ir dentro de un `button`. */
  const chips = () =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('.hub-lp__league-toggle'));
  const chip = (nombre: string) => chips().find((b) => b.textContent?.includes(nombre))!;
  const tarjeta = (nombre: string) => chip(nombre).closest('.hub-lp__league')!;

  function conLigas(list: HubLeagueSeries[]): void {
    fixture.componentInstance.ligas.set(list);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('pinta una línea por liga empezada, y ninguna por las que no', () => {
    conLigas([COMPETITIVO, EQUILIBRADO, CAOS_SIN_EMPEZAR]);

    expect(chips().length).toBe(3);
    expect(lineas().length).toBe(2);
  });

  it('cada liga dice en qué punto está: puesto, LP, neto y winrate', () => {
    conLigas([COMPETITIVO, EQUILIBRADO, CAOS_SIN_EMPEZAR]);

    const texto = chip('Competitivo').textContent!;
    expect(texto).toContain('2.º');
    expect(texto).toContain('300 LP');
    expect(texto).toContain('+200 LP');
    expect(texto).toContain('60% de victorias');
  });

  it('una liga sin empezar lo dice y no se puede encender', () => {
    conLigas([COMPETITIVO, EQUILIBRADO, CAOS_SIN_EMPEZAR]);

    const caos = chip('Caos');
    expect(caos.disabled).toBe(true);
    expect(caos.textContent).toContain('Sin empezar');
  });

  it('apagar una liga la quita de la gráfica y la deja marcada como apagada', () => {
    conLigas([COMPETITIVO, EQUILIBRADO, CAOS_SIN_EMPEZAR]);
    expect(lineas().length).toBe(2);

    chip('Equilibrado').click();
    fixture.detectChanges();

    expect(lineas().length).toBe(1);
    expect(chip('Equilibrado').getAttribute('aria-pressed')).toBe('false');
    expect(tarjeta('Equilibrado').classList).toContain('is-off');
  });

  it('volver a pulsarla la enciende otra vez', () => {
    conLigas([COMPETITIVO, EQUILIBRADO, CAOS_SIN_EMPEZAR]);

    chip('Equilibrado').click();
    fixture.detectChanges();
    chip('Equilibrado').click();
    fixture.detectChanges();

    expect(lineas().length).toBe(2);
    expect(chip('Equilibrado').getAttribute('aria-pressed')).toBe('true');
  });

  /** El caso que motivó los interruptores: «me apetece ver mi progreso solo en Caos». */
  it('con una sola liga encendida la gráfica es suya, y estrena su relleno', () => {
    conLigas([COMPETITIVO, EQUILIBRADO, CAOS_SIN_EMPEZAR]);

    chip('Competitivo').click();
    fixture.detectChanges();

    expect(lineas().length).toBe(1);
    expect(root().querySelectorAll('.hub-lp__area').length).toBe(1);
    // El eje se reescala a lo que queda: Equilibrado va de 400 a 500 LP.
    const cotas = Array.from(root().querySelectorAll('.hub-lp__axis')).map((t) => t.textContent);
    expect(cotas[0]).toContain('400 LP');
    expect(cotas[cotas.length - 1]).toContain('500 LP');
  });

  it('con dos o más ligas no se rellena ninguna: tres áreas superpuestas no se leen', () => {
    conLigas([COMPETITIVO, EQUILIBRADO, CAOS_SIN_EMPEZAR]);

    expect(root().querySelectorAll('.hub-lp__area').length).toBe(0);
  });

  it('el tooltip trae una fila por liga visible', () => {
    conLigas([COMPETITIVO, EQUILIBRADO, CAOS_SIN_EMPEZAR]);
    expect(root().querySelectorAll('.hub-lp__tooltip-row').length).toBe(2);

    chip('Competitivo').click();
    fixture.detectChanges();
    expect(root().querySelectorAll('.hub-lp__tooltip-row').length).toBe(1);
  });

  it('apagadas todas, lo dice en vez de enseñar un lienzo vacío', () => {
    conLigas([COMPETITIVO, EQUILIBRADO, CAOS_SIN_EMPEZAR]);

    chip('Competitivo').click();
    fixture.detectChanges();
    chip('Equilibrado').click();
    fixture.detectChanges();

    expect(root().querySelector('.hub-lp__plot')).toBeNull();
    // Caos no está apagada, está sin empezar: el texto no puede hablar de "las tres".
    expect(root().textContent).toContain('No hay ninguna liga encendida');
  });

  it('sin ninguna liga empezada explica que arrancan con su primera partida', () => {
    conLigas([
      liga('COMPETITIVE', 'Competitivo', [], { started: false }),
      liga('BALANCED', 'Equilibrado', [], { started: false }),
      CAOS_SIN_EMPEZAR,
    ]);

    expect(root().querySelector('.hub-lp__plot')).toBeNull();
    expect(root().textContent).toContain('Ninguna de las tres ligas ha empezado');
  });

  /* ── Temporadas: cada liga lleva la suya (`FlujoJuego.md` §3.1, §3.5) ── */

  it('con una sola temporada dice cuál es, sin desplegable que no decide nada', () => {
    conLigas([COMPETITIVO, EQUILIBRADO, CAOS_SIN_EMPEZAR]);

    expect(root().querySelectorAll('nf-combobox').length).toBe(0);
    expect(root().querySelector('.hub-lp__league-season-name')?.textContent).toContain(
      'Temp. 1 · Liga de Otoño 2026',
    );
  });

  it('una liga con historia estrena SU desplegable, y solo ella', () => {
    conLigas([COMPETITIVO_CON_HISTORIA, EQUILIBRADO, CAOS_SIN_EMPEZAR]);

    const comboboxes = root().querySelectorAll('nf-combobox');
    expect(comboboxes.length).toBe(1);
    const input = root().querySelector<HTMLInputElement>('.hub-lp__league-season .nf-combobox__input');
    expect(input).not.toBeNull();
    expect(input!.value).toBe('Temp. 3 · Copa del Nexo');
  });

  /** El ordinal es lo que distingue dos temporadas que el owner llamó igual (§3.4). */
  it('elegir otra temporada lo pide fuera, diciendo de qué liga se trata', () => {
    conLigas([COMPETITIVO_CON_HISTORIA, EQUILIBRADO, CAOS_SIN_EMPEZAR]);

    const input = root().querySelector<HTMLInputElement>('.hub-lp__league-season .nf-combobox__input')!;
    input.focus();
    fixture.detectChanges();

    const options = Array.from(root().querySelectorAll<HTMLElement>('.hub-lp__league-season .nf-combobox__option'));
    expect(options.length).toBe(3);
    const optS1 = options.find((o) => o.textContent?.includes('Temp. 1'))!;
    optS1.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.elegido).toEqual([
      { modality: 'COMPETITIVE', seasonId: 's1' },
    ]);
  });

  it('una liga que no ha jugado nunca no dice ninguna temporada', () => {
    conLigas([COMPETITIVO, EQUILIBRADO, CAOS_SIN_EMPEZAR]);

    const caos = root().querySelectorAll('.hub-lp__league')[2];
    expect(caos.querySelector('nf-combobox')).toBeNull();
    expect(caos.querySelector('.hub-lp__league-season-name')).toBeNull();
  });

  /* ── El eje ─────────────────────────────────────────────────────────── */

  it('el eje habla en días de temporada, desde la primera partida', () => {
    conLigas([COMPETITIVO, EQUILIBRADO, CAOS_SIN_EMPEZAR]);

    const extremos = root().querySelectorAll('.hub-lp__scale span');
    expect(extremos[0].textContent).toContain('Primera partida');
    expect(extremos[1].textContent).toContain('Día 150');
  });

  /** Una temporada corta acaba antes en el eje en vez de estirarse hasta parecer igual de larga. */
  it('la temporada corta no se estira al ancho del lienzo', () => {
    conLigas([COMPETITIVO, EQUILIBRADO, CAOS_SIN_EMPEZAR]);

    const [competitivo, equilibrado] = root().querySelectorAll('.hub-lp__line');
    const finalDe = (path: Element) => {
      const d = path.getAttribute('d')!;
      return Number(d.slice(d.lastIndexOf('L') + 1).split(',')[0]);
    };
    expect(finalDe(equilibrado)).toBeLessThan(finalDe(competitivo));
  });

  it('mientras carga no enseña ni leyenda ni lienzo, solo su hueco', () => {
    conLigas([COMPETITIVO, EQUILIBRADO, CAOS_SIN_EMPEZAR]);
    fixture.componentInstance.cargando.set(true);
    fixture.detectChanges();

    expect(root().querySelectorAll('nf-skeleton').length).toBe(2);
    expect(root().querySelector('.hub-lp__legend')).toBeNull();
  });
});
