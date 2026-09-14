import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GroupSettingsIdentityComponent } from './group-settings-identity.component';
import { GroupDetailStore, GroupView } from '../../../../core/groups';
import { ToastService } from '../../../../core/toast';

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

describe('GroupSettingsIdentityComponent', () => {
  let fixture: ComponentFixture<GroupSettingsIdentityComponent>;
  let component: GroupSettingsIdentityComponent;
  let detailStore: {
    memberCount: () => number;
    updateAvatar: (id: string, dataUrl: string) => Promise<void>;
  };
  let toasts: {
    success: (msg: string) => void;
    error: (msg: string) => void;
  };

  beforeEach(async () => {
    detailStore = {
      memberCount: () => 10,
      updateAvatar: vi.fn().mockResolvedValue(undefined),
    };
    toasts = {
      success: vi.fn(),
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [GroupSettingsIdentityComponent],
      providers: [
        { provide: GroupDetailStore, useValue: detailStore },
        { provide: ToastService, useValue: toasts },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GroupSettingsIdentityComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('group', MOCK_GROUP);
    fixture.detectChanges();
  });

  it('se crea correctamente con los datos del grupo', () => {
    expect(component).toBeTruthy();
    expect(component.draftAvatar()).toBeNull();
    expect(component.avatarChanged()).toBe(false);
  });

  it('permite cambiar el avatar draft y detectar cambios', () => {
    component.onAvatarChange('data:image/png;base64,abc');
    expect(component.draftAvatar()).toBe('data:image/png;base64,abc');
    expect(component.avatarChanged()).toBe(true);
  });

  it('guarda la foto con el store y emite toast de éxito', async () => {
    component.onAvatarChange('data:image/png;base64,abc');
    await component.saveAvatar();
    expect(detailStore.updateAvatar).toHaveBeenCalledWith('g-test-1', 'data:image/png;base64,abc');
    expect(toasts.success).toHaveBeenCalledWith('Foto del grupo actualizada');
  });

  it('muestra error si updateAvatar falla', async () => {
    detailStore.updateAvatar = vi.fn().mockRejectedValue(new Error('Network error'));
    component.onAvatarChange('data:image/png;base64,abc');
    await component.saveAvatar();
    expect(toasts.error).toHaveBeenCalled();
  });
});
