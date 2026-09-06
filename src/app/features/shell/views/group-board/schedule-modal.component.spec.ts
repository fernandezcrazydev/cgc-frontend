import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduleDraft, ScheduleModalComponent } from './schedule-modal.component';
import { MAX_SLOTS } from '../../../../core/lobbies';

/** Ancla temporal fija: si dependiera de «ahora», las horas ofrecidas cambiarían solas. */
const NOW = new Date(2026, 8, 8, 12, 0);

function createComponent() {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(ScheduleModalComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

describe('ScheduleModalComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('arranca en hoy y sin ninguna hora elegida', () => {
    const { component } = createComponent();

    expect(component['selectedDay']()).toBe('2026-09-08');
    expect(component['picked']()).toEqual([]);
  });

  /** Todas las horas ofrecidas, sin importar en qué banda hayan caído. */
  function todasLasHoras(component: ScheduleModalComponent) {
    return component['bands']().flatMap((b) => b.hours);
  }

  it('deja proponer como mucho seis horas', () => {
    const { component } = createComponent();

    for (const hour of todasLasHoras(component)) component['toggleHour'](hour.value);

    expect(MAX_SLOTS).toBe(6);
    expect(component['picked']()).toHaveLength(6);
    expect(component['atLimit']()).toBe(true);
  });

  it('reparte las horas en tarde y noche, con el corte en las 20:00', () => {
    const { component } = createComponent();

    const bandas = component['bands']();
    expect(bandas.map((b) => b.id)).toEqual(['tarde', 'noche']);
    expect(bandas[0].hours.every((h) => Number(h.label.slice(0, 2)) < 20)).toBe(true);
    expect(bandas[1].hours.every((h) => Number(h.label.slice(0, 2)) >= 20)).toBe(true);
  });

  it('una banda sin horas no se pinta', () => {
    // A las 21:30 ya no queda tarde que ofrecer.
    vi.setSystemTime(new Date(2026, 8, 8, 21, 30));
    const { component } = createComponent();

    expect(component['bands']().map((b) => b.id)).toEqual(['noche']);
  });

  it('enseña el mes y el día elegido escrito entero', () => {
    const { fixture, component } = createComponent();

    expect(component['month']()).toBe('septiembre');
    expect(fixture.nativeElement.querySelector('.sm__chosen').textContent).toContain(
      'de septiembre',
    );
  });

  it('marca los fines de semana, que es cuando se juegan las customs', () => {
    const { fixture } = createComponent();

    // Del martes 8 al lunes 21: catorce días llevan cuatro sábados y domingos.
    expect(fixture.nativeElement.querySelectorAll('.sm-day.is-weekend')).toHaveLength(4);
  });

  it('lo elegido se acumula en «vas a proponer» y se quita desde ahí', () => {
    const { fixture, component } = createComponent();

    const primera = todasLasHoras(component)[0].value;
    component['toggleHour'](primera);
    fixture.detectChanges();

    const chip: HTMLButtonElement = fixture.nativeElement.querySelector('.sm-chip');
    expect(chip.textContent).toContain(primera.slice(11));

    chip.click();
    expect(component['picked']()).toEqual([]);
  });

  it('al llegar al tope, las horas no elegidas se apagan', () => {
    const { fixture, component } = createComponent();

    for (const hour of todasLasHoras(component).slice(0, 6)) component['toggleHour'](hour.value);
    fixture.detectChanges();

    const apagadas: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.sm-hour'),
    );
    expect(apagadas.filter((b) => b.disabled).length).toBeGreaterThan(0);
    // Las ya elegidas siguen pulsables, para poder cambiar de idea.
    expect(apagadas.filter((b) => b.classList.contains('is-on') && b.disabled)).toHaveLength(0);
  });

  it('cambiar de día vacía lo elegido: una convocatoria es de un solo día', () => {
    const { component } = createComponent();

    component['toggleHour'](todasLasHoras(component)[0].value);
    expect(component['picked']()).toHaveLength(1);

    component['pickDay']('2026-09-09');
    expect(component['picked']()).toEqual([]);
  });

  it('no convoca sin ninguna hora', () => {
    const { fixture, component } = createComponent();

    let salidas = 0;
    component.create.subscribe(() => salidas++);
    component['publish']();

    expect(salidas).toBe(0);
    const boton: HTMLButtonElement = fixture.nativeElement.querySelector('.sm__foot button');
    expect(boton.disabled).toBe(true);
  });

  it('manda las horas elegidas y la nota, con la nota vacía como nula', () => {
    const { component } = createComponent();

    let draft: ScheduleDraft | null = null;
    component.create.subscribe((d) => (draft = d));

    const primera = todasLasHoras(component)[0].value;
    component['toggleHour'](primera);
    component['note'].set('   ');
    component['publish']();

    expect(draft!.slotStartTimes).toEqual([primera]);
    expect(draft!.note).toBeNull();
  });

  it('recorta la nota antes de mandarla', () => {
    const { component } = createComponent();

    let draft: ScheduleDraft | null = null;
    component.create.subscribe((d) => (draft = d));

    component['toggleHour'](todasLasHoras(component)[0].value);
    component['note'].set('  scrims contra los del curro  ');
    component['publish']();

    expect(draft!.note).toBe('scrims contra los del curro');
  });
});
