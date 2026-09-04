import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HubTriviaComponent } from './hub-trivia.component';
import { HubTrivia } from '../../../../core/group-hub';

function dato(id: string): HubTrivia {
  return {
    id,
    icon: 'tower',
    kicker: 'Control de mapa',
    value: '73%',
    headline: 'de victorias con la primera torre',
    detail: 'Sobre 32 partidas',
    meter: 73,
    meterLabel: '73% de victorias',
  };
}

const ITEMS = [dato('t1'), dato('t2'), dato('t3')];

describe('HubTriviaComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createComponent(items: HubTrivia[] = ITEMS) {
    const fixture = TestBed.createComponent(HubTriviaComponent);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  it('empieza en el primer dato con la cuenta atrás a cero', () => {
    const { component } = createComponent();

    expect(component.index()).toBe(0);
    expect(component.percent()).toBe(0);
  });

  it('va llenando la rayita del dato activo', () => {
    const { component } = createComponent();

    vi.advanceTimersByTime(HubTriviaComponent.TTL / 2);

    expect(component.percent()).toBeGreaterThan(40);
    expect(component.percent()).toBeLessThan(60);
    expect(component.index()).toBe(0);
  });

  it('pasa al siguiente dato cuando se agota el tiempo', () => {
    const { component } = createComponent();

    vi.advanceTimersByTime(HubTriviaComponent.TTL);

    expect(component.index()).toBe(1);
    expect(component.percent()).toBe(0);
  });

  it('da la vuelta al llegar al último', () => {
    const { component } = createComponent();

    vi.advanceTimersByTime(HubTriviaComponent.TTL * 3);

    expect(component.index()).toBe(0);
  });

  it('detiene y reinicia la cuenta atrás al pasar el cursor', () => {
    const { component } = createComponent();
    vi.advanceTimersByTime(HubTriviaComponent.TTL * 0.8);

    component.pause();

    expect(component.paused()).toBe(true);
    expect(component.percent()).toBe(0);

    // En pausa el tiempo no corre: el dato no se cambia debajo de quien lo está leyendo.
    vi.advanceTimersByTime(HubTriviaComponent.TTL * 2);
    expect(component.index()).toBe(0);
  });

  it('las flechas pasan de dato y devuelven el tiempo entero', () => {
    const { component } = createComponent();
    vi.advanceTimersByTime(HubTriviaComponent.TTL * 0.9);

    component.next();

    expect(component.index()).toBe(1);
    expect(component.percent()).toBe(0);

    component.prev();
    expect(component.index()).toBe(0);
  });

  it('no rota con un solo dato', () => {
    const { component } = createComponent([ITEMS[0]]);

    vi.advanceTimersByTime(HubTriviaComponent.TTL * 3);

    expect(component.index()).toBe(0);
  });
});
