import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NfSkeleton } from '../../../../ui';
import { MapTelemetry, ObjectiveId } from '../../../../core/group-stats';

/**
 * Telemetría de mapa y control de objetivos (§5.5.5, bloque 1 de la pestaña de
 * rendimiento): balance de victorias entre Equipo azul y Equipo rojo, e impacto de
 * los cinco objetivos de la grieta que el cliente de LoL publica: primer dragón, larvas, heraldo,
 * primer barón y primera torre.
 *
 * **El impacto no es «el winrate del grupo con el dragón»** —los dos equipos son el grupo, así que
 * esa pregunta no significa nada—: es cuántas veces ganó el equipo que se lo llevó.
 */
@Component({
  selector: 'app-stats-map-telemetry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfSkeleton],
  templateUrl: './stats-map-telemetry.component.html',
  styleUrls: ['./stats-card.scss', './stats-map-telemetry.component.scss'],
})
export class StatsMapTelemetryComponent {
  readonly telemetry = input<MapTelemetry | null>(null);
  readonly loading = input(false);
  readonly highlightedObjectiveId = input<string | null>(null);
  readonly objectiveHover = output<string | null>();

  protected onIconError(event: Event, id: ObjectiveId): void {
    const img = event.target as HTMLImageElement;
    const fallbacks: Record<ObjectiveId, string> = {
      dragon: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/dragon.png',
      grubs: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/grub.png',
      herald: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/riftherald.png',
      baron: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/baron.png',
      tower: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/tower.png',
    };
    if (img.src !== fallbacks[id]) {
      img.src = fallbacks[id];
    }
  }
}
