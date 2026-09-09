import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { HubLpChartComponent, LeagueSeasonChange } from '../group-hub/hub-lp-chart.component';
import { HubSeason, SeasonChoice, playerLeagueSeriesFor } from '../../../../core/group-hub';
import { ProfileGroupRecord } from '../../../../core/player-profile';

/**
 * Tu evolución de LP en las tres ligas de un grupo, en el perfil (§5.5.13).
 *
 * **No dibuja nada por su cuenta: delega en `HubLpChartComponent`**, la misma gráfica que se ve
 * en el hub del grupo. Es un requisito explícito del usuario (2026-09-09) y la única forma de
 * cumplirlo que no se desalinea sola: dos SVG distintos con "el mismo estilo" duran hasta que
 * alguien toca uno de los dos. Aquí solo se resuelve **de qué grupo** se habla; las tres ligas,
 * sus colores y sus interruptores son cosa de la gráfica.
 *
 * La diferencia con el hub está en el desplegable: allí elige temporada, aquí elige grupo. Es lo
 * que pidió el usuario, y encaja con que el perfil sea de una persona que juega en varias
 * comunidades a la vez.
 *
 * La usan las dos vistas de perfil, la propia y la ajena, de ahí el input `title`: en el perfil de
 * otro hablar de «tu evolución» sería mentira.
 */
@Component({
  selector: 'app-profile-lp-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HubLpChartComponent],
  styleUrl: './profile-lp-chart.component.scss',
  template: `
    <app-hub-lp-chart
      [title]="title()"
      [leagues]="leagues()"
      [options]="groupOptions()"
      [optionId]="activeGroupId()"
      optionsLabel="Elegir el grupo de la gráfica de LP"
      (optionChange)="activeGroupId.set($event)"
      (leagueSeasonChange)="pickSeason($event)"
    />
  `,
})
export class ProfileLpChartComponent {
  readonly groups = input.required<readonly ProfileGroupRecord[]>();
  readonly title = input('Tu evolución de LP por liga');
  /** Quién es el dueño de la curva. Siembra los datos, así que no puede faltar. */
  readonly playerTag = input.required<string>();

  /** El desplegable elige grupo, no temporada: en el perfil la curva es por comunidad. */
  protected readonly groupOptions = computed<HubSeason[]>(() =>
    this.groups().map((g) => ({ id: g.id, label: g.name })),
  );

  /**
   * Si la lista de grupos cambia (o llega vacía y luego no), el id elegido puede quedar apuntando
   * a un grupo que ya no está; `linkedSignal` lo devuelve al primero en vez de dejar la gráfica
   * en blanco.
   */
  protected readonly activeGroupId = linkedSignal<readonly ProfileGroupRecord[], string>({
    source: this.groups,
    computation: (groups, previous) => {
      const still = previous && groups.some((g) => g.id === previous.value);
      return still ? previous!.value : (groups[0]?.id ?? '');
    },
  });

  protected readonly selectedGroup = computed<ProfileGroupRecord | null>(() => {
    const list = this.groups();
    if (!list.length) return null;
    return list.find((g) => g.id === this.activeGroupId()) ?? list[0];
  });

  /**
   * Qué temporada se mira de cada liga. Se reinicia al cambiar de grupo: los ids de temporada son
   * de la liga de UN grupo, y arrastrarlos al siguiente enseñaría la temporada equivocada o
   * ninguna. Al volver, manda otra vez la más reciente, que es lo que se quiere ver por defecto.
   */
  protected readonly leagueSeasons = linkedSignal<string, SeasonChoice>({
    source: this.activeGroupId,
    computation: () => ({}),
  });

  protected pickSeason(change: LeagueSeasonChange): void {
    this.leagueSeasons.update((current) => ({ ...current, [change.modality]: change.seasonId }));
  }

  protected readonly leagues = computed(() => {
    const g = this.selectedGroup();
    if (!g) return [];
    return playerLeagueSeriesFor(g.id, this.playerTag(), this.leagueSeasons());
  });
}
