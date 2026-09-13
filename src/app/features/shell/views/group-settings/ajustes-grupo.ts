import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfButton, NfSegmentOption, NfSegmented, NfSkeleton } from '../../../../ui';
import { GroupDetailStore } from '../../../../core/groups';
import { GroupSettingsIdentityComponent } from './group-settings-identity.component';
import { GroupSettingsAccessComponent } from './group-settings-access.component';
import { GroupSettingsLeaguesComponent } from './group-settings-leagues.component';
import { GroupSettingsRefereeComponent } from './group-settings-referee.component';
import { GroupSettingsDiscordComponent } from './group-settings-discord.component';
import { GroupSettingsDangerComponent } from './group-settings-danger.component';

export const GROUP_SETTINGS_SECTIONS = [
  'identidad',
  'acceso',
  'ligas',
  'arbitro',
  'discord',
  'peligro',
] as const;
export type GroupSettingsSection = (typeof GROUP_SETTINGS_SECTIONS)[number];

export interface GroupSectionConfig {
  id: GroupSettingsSection;
  label: string;
  description: string;
}

export const GROUP_SECTIONS: readonly GroupSectionConfig[] = [
  { id: 'identidad', label: 'Identidad', description: 'Cómo se ve el grupo en toda la aplicación' },
  { id: 'acceso', label: 'Acceso', description: 'Quién puede entrar y quién puede ver el grupo' },
  { id: 'ligas', label: 'Ligas', description: 'Las tres competiciones del grupo y sus temporadas' },
  { id: 'arbitro', label: 'Árbitro', description: 'Quién decide qué sanciones se levantan' },
  { id: 'discord', label: 'Discord', description: 'Anuncios automáticos de convocatorias y salas' },
  { id: 'peligro', label: 'Zona peligrosa', description: 'Esto no se puede deshacer' },
];

/**
 * Panel de Ajustes del Grupo (/app/grupos/:id/ajustes).
 * Permite gestionar la identidad, el acceso, Discord y las acciones peligrosas del grupo.
 */
@Component({
  selector: 'app-ajustes-grupo',
  standalone: true,
  imports: [
    RouterLink,
    NfSegmented,
    NfButton,
    NfSkeleton,
    GroupSettingsIdentityComponent,
    GroupSettingsAccessComponent,
    GroupSettingsLeaguesComponent,
    GroupSettingsRefereeComponent,
    GroupSettingsDiscordComponent,
    GroupSettingsDangerComponent,
  ],
  templateUrl: './ajustes-grupo.html',
  styleUrl: './ajustes-grupo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AjustesGrupo {
  readonly store = inject(GroupDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly sections = GROUP_SECTIONS;
  readonly mobileSegmentOptions: readonly NfSegmentOption[] = GROUP_SECTIONS.map((s) => ({
    value: s.id,
    label: s.label,
  }));

  readonly routeId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' },
  );

  private readonly queryParamMap = toSignal(this.route.queryParamMap);

  readonly activeSection = computed<GroupSettingsSection>(() => {
    const s = this.queryParamMap()?.get('s');
    if (s && (GROUP_SETTINGS_SECTIONS as readonly string[]).includes(s)) {
      return s as GroupSettingsSection;
    }
    return 'identidad';
  });

  readonly activeSectionConfig = computed(
    () => GROUP_SECTIONS.find((s) => s.id === this.activeSection()) ?? GROUP_SECTIONS[0],
  );

  constructor() {
    effect(() => {
      const id = this.routeId();
      if (id) void this.store.ensureLoaded(id);
    });
  }

  setSection(s: GroupSettingsSection): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { s },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  reload(): void {
    const id = this.routeId();
    if (id) void this.store.load(id);
  }
}
