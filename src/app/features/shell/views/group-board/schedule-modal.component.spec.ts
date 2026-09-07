import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduleDraft, ScheduleModalComponent } from './schedule-modal.component';
import { MAX_NOTE_LENGTH, MAX_SLOTS, RepeatOption } from '../../../../core/lobbies';
import { CalendarCell } from '../../../../shared/schedule-options';

/** Ancla temporal fija: si dependiera de «ahora», las horas ofrecidas cambiarían solas. */
const NOW = new Date(2026, 8, 8, 12, 0);

function createComponent(recent: RepeatOption[] = []) {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(ScheduleModalComponent);
  fixture.componentRef.setInput('recent', recent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

/** Todas las horas ofrecidas, sin importar en qué banda hayan caído. */
function todasLasHoras(component: ScheduleModalComponent) {
  return component['bands']().flatMap((b) => b.hours);
}

/** Un día cualquiera de la rejilla, para pulsarlo sin buscarlo en el DOM. */
function dia(value: string, isWeekend = false): CalendarCell {
  return {
    value,
    dayNumber: value.slice(8),
    label: `día ${value}`,
    isWeekend,
    isPast: false,
    isToday: false,
    isFiller: false,
  };
}

function plantilla(times: string[], extra: Partial<RepeatOption> = {}): RepeatOption {
  return {
    id: 'lb-1',
    times,
    label: times.join(' · '),
    note: '',
    originalCount: times.length,
    truncated: false,
    ...extra,
  };
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

  it('deja proponer como mucho seis horas', () => {
    const { component } = createComponent();

    for (const hour of todasLasHoras(component)) component['toggleHour'](hour.label);

    expect(MAX_SLOTS).toBe(6);
    expect(component['picked']()).toHaveLength(6);
    expect(component['atLimit']()).toBe(true);
  });

  /** Antes la rejilla iba de 17:00 a 23:30 y una custom de mañana no se podía convocar. */
  it('ofrece el día entero en cuatro bandas, con la mañana plegada al abrir', () => {
    const { component } = createComponent();
    component['pickDay'](dia('2026-09-09'));

    expect(component['bands']().map((b) => b.id)).toEqual([
      'madrugada',
      'manana',
      'tarde',
      'noche',
    ]);
    expect(todasLasHoras(component)).toHaveLength(48);
    expect(component['isOpen']('madrugada')).toBe(false);
    expect(component['isOpen']('manana')).toBe(false);
    expect(component['isOpen']('tarde')).toBe(true);
    expect(component['isOpen']('noche')).toBe(true);
  });

  it('el corte entre tarde y noche sigue en las 20:00', () => {
    const { component } = createComponent();

    const bandas = component['bands']();
    const tarde = bandas.find((b) => b.id === 'tarde')!;
    const noche = bandas.find((b) => b.id === 'noche')!;
    expect(tarde.hours.every((h) => Number(h.label.slice(0, 2)) < 20)).toBe(true);
    expect(noche.hours.every((h) => Number(h.label.slice(0, 2)) >= 20)).toBe(true);
  });

  it('una banda sin horas no se pinta', () => {
    // A las 21:30 ya no queda tarde que ofrecer.
    vi.setSystemTime(new Date(2026, 8, 8, 21, 30));
    const { component } = createComponent();

    expect(component['bands']().map((b) => b.id)).toEqual(['noche']);
  });

  /** La queja de fondo: la tira de catorce días no llegaba al mes siguiente. */
  it('el calendario no retrocede del mes actual y avanza sin tope', () => {
    const { component } = createComponent();

    expect(component['atFirstMonth']()).toBe(true);
    component['moveMonth'](-1);
    expect(component['month']().key).toBe('2026-09');

    component['moveMonth'](1);
    component['moveMonth'](1);
    expect(component['month']().key).toBe('2026-11');
    expect(component['atFirstMonth']()).toBe(false);
  });

  it('enseña el mes con su año y el día elegido escrito entero', () => {
    const { fixture, component } = createComponent();

    expect(component['month']().label).toContain('septiembre');
    expect(component['month']().label).toContain('2026');
    expect(fixture.nativeElement.querySelector('.sm-cal__chosen').textContent).toContain(
      'de septiembre',
    );
  });

  it('marca los fines de semana, que es cuando se juegan las customs', () => {
    const { fixture } = createComponent();

    // Septiembre de 2026 tiene cuatro sábados y cuatro domingos.
    expect(fixture.nativeElement.querySelectorAll('.sm-cal__cell.is-weekend')).toHaveLength(8);
  });

  it('los días anteriores a hoy no se pueden pulsar', () => {
    const { fixture } = createComponent();

    const celdas: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button.sm-cal__cell'),
    );
    expect(celdas.filter((c) => c.disabled)).toHaveLength(7); // del 1 al 7 de septiembre
  });

  it('lo elegido se acumula en «vas a proponer» y se quita desde ahí', () => {
    const { fixture, component } = createComponent();

    const primera = todasLasHoras(component)[0];
    component['toggleHour'](primera.label);
    fixture.detectChanges();

    const chip: HTMLButtonElement = fixture.nativeElement.querySelector('.sm-chip');
    expect(chip.textContent).toContain(primera.label);

    chip.click();
    expect(component['picked']()).toEqual([]);
  });

  it('al llegar al tope, las horas no elegidas se apagan', () => {
    const { fixture, component } = createComponent();

    for (const hour of todasLasHoras(component).slice(0, 6)) component['toggleHour'](hour.label);
    fixture.detectChanges();

    const pastillas: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.sm-hour'),
    );
    expect(pastillas.filter((b) => b.disabled).length).toBeGreaterThan(0);
    // Las ya elegidas siguen pulsables, para poder cambiar de idea.
    expect(pastillas.filter((b) => b.classList.contains('is-on') && b.disabled)).toHaveLength(0);
  });

  it('cambiar de día vacía lo elegido: una convocatoria es de un solo día', () => {
    const { component } = createComponent();

    component['toggleHour'](todasLasHoras(component)[0].label);
    expect(component['picked']()).toHaveLength(1);

    component['pickDay'](dia('2026-09-09'));
    expect(component['picked']()).toEqual([]);
  });

  describe('repetir una convocatoria anterior', () => {
    it('sin convocatorias previas la tira no se pinta', () => {
      const { fixture } = createComponent();

      expect(fixture.nativeElement.querySelector('.sm-repeat')).toBeNull();
    });

    it('copia las horas y la descripción de la plantilla', () => {
      const opcion = plantilla(['21:00', '22:00'], { note: 'traed micro' });
      const { component } = createComponent([opcion]);

      component['applyRepeat'](opcion);

      expect(component['picked']()).toEqual(['2026-09-08T21:00', '2026-09-08T22:00']);
      expect(component['note']()).toBe('traed micro');
    });

    it('no pisa la descripción que ya habías escrito', () => {
      const opcion = plantilla(['22:00'], { note: 'la de la plantilla' });
      const { component } = createComponent([opcion]);

      component['note'].set('la mía');
      component['applyRepeat'](opcion);

      expect(component['note']()).toBe('la mía');
    });

    /** Justo lo que se pidió repetir: las horas viajan al día nuevo en vez de perderse. */
    it('las horas copiadas sobreviven a cambiar de día', () => {
      const { component } = createComponent();

      component['applyRepeat'](plantilla(['21:00', '22:00']));
      component['pickDay'](dia('2026-09-19', true));

      expect(component['picked']()).toEqual(['2026-09-19T21:00', '2026-09-19T22:00']);
    });

    it('las horas que ya pasaron hoy se caen, se dicen, y vuelven al elegir otro día', () => {
      const { component } = createComponent();

      component['applyRepeat'](plantilla(['09:00', '22:00']));
      expect(component['picked']()).toEqual(['2026-09-08T22:00']);
      expect(component['droppedTimes']()).toEqual(['09:00']);

      component['pickDay'](dia('2026-09-09'));
      expect(component['picked']()).toEqual(['2026-09-09T09:00', '2026-09-09T22:00']);
      expect(component['droppedTimes']()).toEqual([]);
    });

    it('retocar a mano actualiza la plantilla, para que el retoque también viaje', () => {
      const { component } = createComponent();

      component['applyRepeat'](plantilla(['21:00', '22:00']));
      component['toggleHour']('23:00');
      component['pickDay'](dia('2026-09-19', true));

      expect(component['picked']()).toEqual([
        '2026-09-19T21:00',
        '2026-09-19T22:00',
        '2026-09-19T23:00',
      ]);
    });

    it('pulsar dos veces la misma plantilla la suelta, pero no borra el texto escrito', () => {
      const opcion = plantilla(['21:00', '22:00'], { note: 'traed micro' });
      const { component } = createComponent([opcion]);

      component['applyRepeat'](opcion);
      component['applyRepeat'](opcion);

      expect(component['picked']()).toEqual([]);
      expect(component['note']()).toBe('traed micro');
    });
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

  it('manda las horas elegidas y la descripción, con la vacía como nula', () => {
    const { component } = createComponent();

    let draft: ScheduleDraft | null = null;
    component.create.subscribe((d) => (draft = d));

    const primera = todasLasHoras(component)[0];
    component['toggleHour'](primera.label);
    component['note'].set('   ');
    component['publish']();

    expect(draft!.slotStartTimes).toEqual([primera.value]);
    expect(draft!.note).toBeNull();
  });

  it('recorta la descripción antes de mandarla', () => {
    const { component } = createComponent();

    let draft: ScheduleDraft | null = null;
    component.create.subscribe((d) => (draft = d));

    component['toggleHour'](todasLasHoras(component)[0].label);
    component['note'].set('  scrims contra los del curro  ');
    component['publish']();

    expect(draft!.note).toBe('scrims contra los del curro');
  });

  it('la descripción admite mil caracteres y el contador avisa al acercarse', () => {
    const { fixture, component } = createComponent();

    expect(MAX_NOTE_LENGTH).toBe(1000);
    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('.sm__note');
    expect(textarea.maxLength).toBe(1000);

    component['note'].set('x'.repeat(899));
    expect(component['noteNearLimit']()).toBe(false);
    component['note'].set('x'.repeat(900));
    expect(component['noteNearLimit']()).toBe(true);
  });
});
