import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { SancionesGrupo } from './sanciones-grupo';
import { GroupDetailStore, GroupsStore, GroupBridge } from '../../../../core/groups';
import { LeaguesStore } from '../../../../core/leagues';
import { GroupSanctionsStore } from '../../../../core/group-sanctions';
import { ToastService } from '../../../../core/toast';
import { Session } from '../../../../core/auth';

describe('SancionesGrupo', () => {
  let fixture: ComponentFixture<SancionesGrupo>;
  let component: SancionesGrupo;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SancionesGrupo],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        GroupDetailStore,
        GroupsStore,
        GroupBridge,
        LeaguesStore,
        GroupSanctionsStore,
        ToastService,
        Session,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SancionesGrupo);
    component = fixture.componentInstance;
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });
});
