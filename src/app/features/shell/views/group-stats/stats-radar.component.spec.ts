import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StatsRadarComponent } from './stats-radar.component';
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
  const fixture = TestBed.createComponent(StatsRadarComponent);
  fixture.componentRef.setInput('telemetry', telemetry);
  fixture.componentRef.setInput('loading', loading);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

describe('StatsRadarComponent', () => {
  it('dibuja el radar pentagonal con 5 vértices de objetivos', () => {
    const { fixture } = createComponent(MOCK_TELEMETRY);

    const svg = fixture.nativeElement.querySelector('.st-radar__svg');
    expect(svg).not.toBeNull();

    const nodes = fixture.nativeElement.querySelectorAll('.st-radar__node');
    expect(nodes).toHaveLength(5);

    const polygon = fixture.nativeElement.querySelector('.st-radar__data-poly');
    expect(polygon).not.toBeNull();
    expect(polygon.getAttribute('points')).toBeTruthy();
  });

  it('muestra esqueletos de carga mientras loading es true', () => {
    const { fixture } = createComponent(null, true);
    expect(fixture.nativeElement.querySelector('.st-card').getAttribute('aria-busy')).toBe('true');
  });

  it('muestra mensaje vacío cuando no hay datos suficientes', () => {
    const { fixture } = createComponent(null, false);
    expect(fixture.nativeElement.querySelector('.st-card__empty')).not.toBeNull();
  });

  it('actualiza el texto del pie al interactuar con un vértice', () => {
    const { fixture, component } = createComponent(MOCK_TELEMETRY);

    component.hoveredId.set('dragon');
    fixture.detectChanges();

    const caption = fixture.nativeElement.querySelector('.st-radar__caption');
    expect(caption.textContent).toContain('Primer dragón');
    expect(caption.textContent).toContain('72%');
  });

  it('actualiza hoveredId y añade la clase is-hovered al pasar el ratón por un vértice', () => {
    const { fixture, component } = createComponent(MOCK_TELEMETRY);
    const nodes = fixture.nativeElement.querySelectorAll('.st-radar__node');

    nodes[0].dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    expect(component.hoveredId()).toBe('dragon');
    expect(nodes[0].classList.contains('is-hovered')).toBe(true);

    nodes[0].dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();

    expect(component.hoveredId()).toBeNull();
    expect(nodes[0].classList.contains('is-hovered')).toBe(false);
  });
});
