import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { AjustesGrupo } from './ajustes-grupo';
import { GroupDetailStore, GroupView } from '../../../../core/groups';

const MOCK_GROUP: GroupView = {
  id: 'g-test-1',
  name: 'Customs Tryhard',
  tag: 'TRY',
  region: 'EUW',
  role: 'OWNER',
  initials: 'CT',
  c1: '#ff0055',
  c2: '#0055ff',
  avatarUrl: null,
};

describe('AjustesGrupo Component', () => {
  let fixture: ComponentFixture<AjustesGrupo>;
  let component: AjustesGrupo;
  let detailStore: {
    status: any;
    group: any;
    canManage: any;
    memberCount: any;
    ensureLoaded: any;
    load: any;
  };

  beforeEach(async () => {
    detailStore = {
      status: signal('ready'),
      group: signal(MOCK_GROUP),
      canManage: signal(true),
      memberCount: signal(10),
      ensureLoaded: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [AjustesGrupo],
      providers: [
        provideRouter([]),
        { provide: GroupDetailStore, useValue: detailStore },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'g-test-1' })),
            queryParamMap: of(convertToParamMap({ s: 'identidad' })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AjustesGrupo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente y abre en identidad por defecto', () => {
    expect(component).toBeTruthy();
    expect(component.activeSection()).toBe('identidad');
    expect(component.activeSectionConfig().label).toBe('Identidad');
  });

  it('llama a ensureLoaded con el id de la ruta', () => {
    expect(detailStore.ensureLoaded).toHaveBeenCalledWith('g-test-1');
  });

  it('muestra estado de sin permiso si canManage es false', () => {
    detailStore.canManage.set(false);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Solo la administración del grupo');
  });

  it('muestra estado de carga cuando status es loading', () => {
    detailStore.status.set('loading');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('muestra estado de error cuando status es error', () => {
    detailStore.status.set('error');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('No se pudo cargar el grupo.');
  });

  it('muestra estado not-found cuando status es not-found', () => {
    detailStore.status.set('not-found');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Este grupo no existe o ya no eres miembro.');
  });
});
