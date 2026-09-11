import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { NfSegmentOption, NfSegmented } from '../../../../ui';
import { SettingsAccountComponent } from './settings-account.component';
import { SettingsPositionsComponent } from './settings-positions.component';
import { SettingsNotificationsComponent } from './settings-notifications.component';
import { SettingsPrivacyComponent } from './settings-privacy.component';
import { SettingsAppearanceComponent } from './settings-appearance.component';

export const SETTINGS_SECTIONS = [
  'cuenta',
  'posiciones',
  'notificaciones',
  'privacidad',
  'apariencia',
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export interface SectionConfig {
  id: SettingsSection;
  label: string;
  description: string;
}

export const SECTIONS: readonly SectionConfig[] = [
  { id: 'cuenta', label: 'Cuenta', description: 'Tu identidad y tus dispositivos' },
  { id: 'posiciones', label: 'Posiciones', description: 'Qué juegas y qué no' },
  { id: 'notificaciones', label: 'Notificaciones', description: 'Por dónde te avisamos' },
  { id: 'privacidad', label: 'Privacidad', description: 'Quién puede llegar a ti' },
  { id: 'apariencia', label: 'Apariencia', description: 'Cómo se ve la aplicación' },
];

@Component({
  selector: 'app-ajustes',
  standalone: true,
  imports: [
    NfSegmented,
    SettingsAccountComponent,
    SettingsPositionsComponent,
    SettingsNotificationsComponent,
    SettingsPrivacyComponent,
    SettingsAppearanceComponent,
  ],
  templateUrl: './ajustes.html',
  styleUrl: './ajustes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Ajustes {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly sections = SECTIONS;
  readonly mobileSegmentOptions: readonly NfSegmentOption[] = SECTIONS.map((s) => ({
    value: s.id,
    label: s.label,
  }));

  private readonly queryParamMap = toSignal(this.route.queryParamMap);

  readonly activeSection = computed<SettingsSection>(() => {
    const s = this.queryParamMap()?.get('s');
    if (s && (SETTINGS_SECTIONS as readonly string[]).includes(s)) {
      return s as SettingsSection;
    }
    return 'cuenta';
  });

  readonly activeSectionConfig = computed(
    () => SECTIONS.find((s) => s.id === this.activeSection()) ?? SECTIONS[0],
  );

  setSection(s: SettingsSection): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { s },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
