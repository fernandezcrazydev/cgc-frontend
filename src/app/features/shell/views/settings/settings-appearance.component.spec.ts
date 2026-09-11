import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SettingsAppearanceComponent } from './settings-appearance.component';
import { ThemeService } from '../../../../core/theme';

describe('SettingsAppearanceComponent', () => {
  let component: SettingsAppearanceComponent;
  let fixture: ComponentFixture<SettingsAppearanceComponent>;
  let themeSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    themeSpy = vi.fn();
    const mockTheme = {
      theme: signal('nocturne'),
      set: themeSpy,
    };

    await TestBed.configureTestingModule({
      imports: [SettingsAppearanceComponent],
      providers: [{ provide: ThemeService, useValue: mockTheme }],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsAppearanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea y lista las opciones de tema', () => {
    expect(component).toBeTruthy();
    const buttons = fixture.nativeElement.querySelectorAll('.theme-opt');
    expect(buttons.length).toBe(2);
  });

  it('pulsar un tema llama a theme.set()', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.theme-opt');
    buttons[1].click();
    expect(themeSpy).toHaveBeenCalledWith('original');
  });
});
