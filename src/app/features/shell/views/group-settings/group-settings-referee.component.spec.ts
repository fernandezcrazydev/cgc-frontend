import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GroupSettingsRefereeComponent } from './group-settings-referee.component';
import { GroupBridge } from '../../../../core/groups';
import { ToastService } from '../../../../core/toast';

describe('GroupSettingsRefereeComponent', () => {
  let fixture: ComponentFixture<GroupSettingsRefereeComponent>;
  let component: GroupSettingsRefereeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupSettingsRefereeComponent],
      providers: [
        provideRouter([]),
        GroupBridge,
        ToastService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GroupSettingsRefereeComponent);
    component = fixture.componentInstance;
  });

  it('se inicializa correctamente', () => {
    fixture.componentRef.setInput('groupId', 'g-1');
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });
});
