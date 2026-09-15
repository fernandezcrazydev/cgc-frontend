import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { GroupSettingsLeaguesComponent } from './group-settings-leagues.component';
import { GroupDetailStore } from '../../../../core/groups';
import { Session } from '../../../../core/auth';
import { ToastService } from '../../../../core/toast';

describe('GroupSettingsLeaguesComponent', () => {
  let fixture: ComponentFixture<GroupSettingsLeaguesComponent>;
  let component: GroupSettingsLeaguesComponent;
  let detailStore: { status: any; group: any; roster: any };
  let session: { user: any };
  let toasts: { success: any; error: any };

  beforeEach(async () => {
    detailStore = {
      status: signal('ready'),
      group: signal({ id: 'g-test-1', name: 'Customs Tryhard', role: 'OWNER' }),
      roster: signal([
        { userId: 'u1', name: 'Adri', tag: '0001', discordUsername: 'Adri' },
        { userId: 'u2', name: 'Beto', tag: '0002', discordUsername: 'Beto' },
      ]),
    };

    session = {
      user: signal({ id: 'u1', discordUsername: 'Adri' }),
    };

    toasts = {
      success: vi.fn(),
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [GroupSettingsLeaguesComponent],
      providers: [
        { provide: GroupDetailStore, useValue: detailStore },
        { provide: Session, useValue: session },
        { provide: ToastService, useValue: toasts },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GroupSettingsLeaguesComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('groupId', 'g-test-1');
    fixture.detectChanges();
  });

  it('se crea correctamente y pinta las tres ligas', () => {
    expect(component).toBeTruthy();
    const cards = fixture.nativeElement.querySelectorAll('.league-card');
    expect(cards.length).toBe(3);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('COMPETITIVO');
    expect(text).toContain('EQUILIBRADO');
    expect(text).toContain('CAOS');
  });

  it('abre el modal al pulsar una card', () => {
    expect(component.selectedLeague()).toBeNull();
    const firstCard: HTMLElement = fixture.nativeElement.querySelector('.league-card');
    firstCard.click();
    fixture.detectChanges();

    expect(component.selectedLeague()).not.toBeNull();
    expect(component.selectedLeague()?.modality).toBe('COMPETITIVE');

    const modal = fixture.nativeElement.querySelector('app-league-edit-dialog');
    expect(modal).toBeTruthy();
  });

  it('muestra skeletons en estado de carga', () => {
    detailStore.status.set('loading');
    fixture.detectChanges();

    const skeletons = fixture.nativeElement.querySelectorAll('nf-skeleton');
    expect(skeletons.length).toBe(3);
  });
});
