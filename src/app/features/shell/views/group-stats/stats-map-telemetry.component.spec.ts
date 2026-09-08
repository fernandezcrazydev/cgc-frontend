import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StatsMapTelemetryComponent } from './stats-map-telemetry.component';
import { MapTelemetry } from '../../../../core/group-stats';

const MOCK_TELEMETRY: MapTelemetry = {
  side: {
    games: 40,
    blueWins: 22,
    redWins: 18,
    bluePct: 55,
    redPct: 45,
  },
  pacing: {
    averageDuration: '28:45',
    killsPerMinute: 2.1,
    totalKillsPerGame: 60,
    firstBloodWinrate: 68,
  },
  objectives: [
    {
      id: 'dragon',
      label: 'Primer dragón',
      winrate: 72,
      wins: 18,
      games: 25,
      impact: 'Alto',
      iconUrl: '/assets/objectives/dragon.png',
    },
    {
      id: 'grubs',
      label: 'Larvas del vacío',
      winrate: 68,
      wins: 17,
      games: 25,
      impact: 'Medio',
      iconUrl: '/assets/objectives/grubs.png',
    },
    {
      id: 'herald',
      label: 'Heraldo de la grieta',
      winrate: 65,
      wins: 15,
      games: 23,
      impact: 'Medio',
      iconUrl: '/assets/objectives/herald.png',
    },
    {
      id: 'baron',
      label: 'Primer barón',
      winrate: 88,
      wins: 22,
      games: 25,
      impact: 'Decisivo',
      iconUrl: '/assets/objectives/baron.png',
    },
    {
      id: 'tower',
      label: 'Primera torre',
      winrate: 78,
      wins: 21,
      games: 27,
      impact: 'Alto',
      iconUrl: '/assets/objectives/tower.png',
    },
  ],
};

function createComponent(telemetry: MapTelemetry | null, loading = false) {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(StatsMapTelemetryComponent);
  fixture.componentRef.setInput('telemetry', telemetry);
  fixture.componentRef.setInput('loading', loading);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

describe('StatsMapTelemetryComponent', () => {
  it('muestra Equipo azul y Equipo rojo en lugar de bando', () => {
    const { fixture } = createComponent(MOCK_TELEMETRY);
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Equipo azul');
    expect(text).toContain('Equipo rojo');
    expect(text).not.toContain('Bando azul');
    expect(text).not.toContain('Bando rojo');
  });

  it('muestra los cinco objetivos incluyendo las larvas (grubs) con sus iconos', () => {
    const { fixture } = createComponent(MOCK_TELEMETRY);
    const items = fixture.nativeElement.querySelectorAll('.tm-objective');

    expect(items).toHaveLength(5);

    const labels = Array.from(items).map(
      (el) => (el as HTMLElement).querySelector('.tm-objective__label')?.textContent?.trim(),
    );
    expect(labels).toEqual([
      'Primer dragón',
      'Larvas del vacío',
      'Heraldo de la grieta',
      'Primer barón',
      'Primera torre',
    ]);

    const images = fixture.nativeElement.querySelectorAll('.tm-objective__icon');
    expect(images).toHaveLength(5);
  });

  it('muestra esqueletos de carga mientras loading es true', () => {
    const { fixture } = createComponent(null, true);
    expect(fixture.nativeElement.querySelector('.st-card').getAttribute('aria-busy')).toBe('true');
  });

  it('muestra mensaje vacío cuando no hay datos suficientes', () => {
    const { fixture } = createComponent(null, false);
    expect(fixture.nativeElement.querySelector('.st-card__empty')).not.toBeNull();
  });

  it('aplica la clase is-highlighted cuando coincide con highlightedObjectiveId', () => {
    const { fixture } = createComponent(MOCK_TELEMETRY);
    fixture.componentRef.setInput('highlightedObjectiveId', 'dragon');
    fixture.detectChanges();

    const highlighted = fixture.nativeElement.querySelectorAll('.tm-objective.is-highlighted');
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].querySelector('.tm-objective__label')?.textContent?.trim()).toBe('Primer dragón');
  });

  it('emite objectiveHover al interactuar con el ratón sobre un objetivo', () => {
    const { fixture, component } = createComponent(MOCK_TELEMETRY);
    let hovered: string | null | undefined;
    component.objectiveHover.subscribe((val: string | null) => (hovered = val));

    const firstItem = fixture.nativeElement.querySelector('.tm-objective');
    firstItem.dispatchEvent(new MouseEvent('mouseenter'));
    expect(hovered).toBe('dragon');

    firstItem.dispatchEvent(new MouseEvent('mouseleave'));
    expect(hovered).toBeNull();
  });

  it('renderiza la franja de ritmo con duración media, KPM y primera sangre', () => {
    const { fixture } = createComponent(MOCK_TELEMETRY);
    const pacing = fixture.nativeElement.querySelector('.tm-pacing');
    expect(pacing).not.toBeNull();
    expect(pacing.textContent).toContain('28:45');
    expect(pacing.textContent).toContain('2.1');
    expect(pacing.textContent).toContain('68%');
  });
});
