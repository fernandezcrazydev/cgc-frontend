import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  RefereeDecisionData,
  RefereeDecisionModalComponent,
} from './referee-decision-modal.component';

describe('RefereeDecisionModalComponent [F5.5-22c]', () => {
  let fixture: ComponentFixture<RefereeDecisionModalComponent>;
  let component: RefereeDecisionModalComponent;

  const sampleDecision: RefereeDecisionData = {
    notificationId: 'notif-123',
    groupId: 'group-1',
    groupName: 'LAN Challenger S14',
    targetUserId: 'user-manolito-3',
    targetName: 'Manolito',
    targetAvatar: '',
    modality: 'Equilibrado',
    recommendedDays: 7,
    incidents: [
      { date: '5 sept', type: 'Ausencia', modality: 'Equilibrado', detail: '', lpDelta: -5 },
      { date: '8 sept', type: 'Abandono', modality: 'Equilibrado', detail: 'Sala #4092', lpDelta: -10 },
      { date: '12 sept', type: 'Abandono', modality: 'Equilibrado', detail: 'Sala #4131', lpDelta: -10 },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RefereeDecisionModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RefereeDecisionModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('decision', sampleDecision);
    fixture.componentRef.setInput('snoozesLeft', 3);
    fixture.detectChanges();
  });

  it('inicializa con valores por defecto (7 días, alcance de liga y motivo pre-rellenado)', () => {
    expect(component.days()).toBe(7);
    expect(component.scope()).toBe('LEAGUE');
    expect(component.reason()).toBe('Tercera incidencia esta temporada');
    expect(component.isValid()).toBe(true);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Manolito');
    expect(compiled.textContent).toContain('3 incidencias esta temporada');
    expect(compiled.textContent).toContain('Recomendamos vetarle 7 días');
    expect(compiled.textContent).toContain('−5 LP');
    expect(compiled.textContent).toContain('−10 LP');
  });

  it('restringe estrictamente la duración entre 1 y 14 días', () => {
    component.setDays(0);
    expect(component.days()).toBe(1);

    component.setDays(-5);
    expect(component.days()).toBe(1);

    component.setDays(14);
    expect(component.days()).toBe(14);

    component.setDays(20);
    expect(component.days()).toBe(14);

    component.setDays(3);
    expect(component.days()).toBe(3);
  });

  it('emite el evento snooze al pulsar Recordármelo más tarde si quedan aplazamientos', () => {
    let snoozeEmitted = false;
    let closedEmitted = false;

    component.snooze.subscribe(() => {
      snoozeEmitted = true;
    });
    component.closed.subscribe(() => {
      closedEmitted = true;
    });

    component.onSnooze();

    expect(snoozeEmitted).toBe(true);
    expect(closedEmitted).toBe(true);
  });

  it('no permite aplazar cuando snoozesLeft es 0 y muestra aviso de aplazamientos agotados', () => {
    fixture.componentRef.setInput('snoozesLeft', 0);
    fixture.detectChanges();

    let snoozeEmitted = false;
    component.snooze.subscribe(() => {
      snoozeEmitted = true;
    });

    component.onSnooze();
    expect(snoozeEmitted).toBe(false);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Aplazamientos agotados (debes resolver)');
    expect(compiled.textContent).not.toContain('Recordármelo más tarde');
  });

  it('emite dismiss al pulsar No sancionar', () => {
    let dismissEmitted = false;
    let closedEmitted = false;

    component.dismiss.subscribe(() => {
      dismissEmitted = true;
    });
    component.closed.subscribe(() => {
      closedEmitted = true;
    });

    component.onDismiss();

    expect(dismissEmitted).toBe(true);
    expect(closedEmitted).toBe(true);
  });

  it('emite apply con los datos de sanción al pulsar Aplicar el veto', () => {
    let appliedPayload: { days: number; scope: string; reason: string } | null = null;
    let closedEmitted = false;

    component.apply.subscribe((payload) => {
      appliedPayload = payload;
    });
    component.closed.subscribe(() => {
      closedEmitted = true;
    });

    component.setDays(10);
    component.scope.set('ALL_LEAGUES');
    component.reason.set('Comportamiento reiterado');

    component.onApply();

    expect(appliedPayload).toEqual({
      days: 10,
      scope: 'ALL_LEAGUES',
      reason: 'Comportamiento reiterado',
    });
    expect(closedEmitted).toBe(true);
  });

  it('permite alternar el alcance entre liga única y las tres ligas mediante el toggle slide', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll<HTMLButtonElement>('.rd-modal__scope-btn');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent?.trim()).toBe('Solo Equilibrado');
    expect(buttons[1].textContent?.trim()).toBe('Las tres ligas');

    expect(component.scope()).toBe('LEAGUE');
    expect(buttons[0].classList.contains('is-active')).toBe(true);
    expect(buttons[1].classList.contains('is-active')).toBe(false);

    // Pulsar en 'Las tres ligas'
    buttons[1].click();
    fixture.detectChanges();

    expect(component.scope()).toBe('ALL_LEAGUES');
    expect(buttons[0].classList.contains('is-active')).toBe(false);
    expect(buttons[1].classList.contains('is-active')).toBe(true);

    const slider = compiled.querySelector('.rd-modal__scope-slider');
    expect(slider?.classList.contains('is-all')).toBe(true);

    // Volver a 'Solo Equilibrado'
    buttons[0].click();
    fixture.detectChanges();

    expect(component.scope()).toBe('LEAGUE');
    expect(buttons[0].classList.contains('is-active')).toBe(true);
    expect(buttons[1].classList.contains('is-active')).toBe(false);
    expect(slider?.classList.contains('is-all')).toBe(false);
  });
});
