import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NfPagination } from '../../../../ui';
import { Session } from '../../../../core/auth';
import { CrossViewState } from './cross-view-state';
import { CrossMatchCardComponent } from './cross-match-card.component';
import { aggregateMetricRows, CrossMetricRow } from './cross-compare';

interface ChemistryInfo {
  tier: 'S' | 'A' | 'B';
  tierLabel: string;
  title: string;
  desc: string;
}

@Component({
  selector: 'app-synergy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CrossMatchCardComponent, NfPagination],
  templateUrl: './synergy.html',
  styleUrl: './synergy.scss',
})
export class Synergy {
  readonly state = inject(CrossViewState);
  readonly session = inject(Session);

  readonly theirName = computed(() => this.state.player()?.name ?? 'Aliado');

  readonly returnTo = computed(() => `/app/jugador/${this.state.playerId()}/juntos`);

  readonly pageSize = 5;
  readonly page = signal(1);

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  readonly pageItems = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.state.allies().slice(start, start + this.pageSize);
  });

  readonly metricRows = computed<CrossMetricRow[]>(() =>
    aggregateMetricRows(this.state.aggregateAllies()),
  );

  readonly combinedDamage = computed(() => {
    const agg = this.state.aggregateAllies();
    return agg.damageShareMe + agg.damageShareThem;
  });

  readonly combinedVision = computed(() => {
    const agg = this.state.aggregateAllies();
    return agg.visionMe + agg.visionThem;
  });

  onPageChange(page: number): void {
    this.page.set(page);
    const list = this.list()?.nativeElement;
    if (list) {
      list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  readonly chemistry = computed<ChemistryInfo>(() => {
    const agg = this.state.aggregateAllies();
    const wr = agg.winrate;
    if (wr >= 70 && agg.games >= 2) {
      return {
        tier: 'S',
        tierLabel: 'Tier S',
        title: 'Química Imparable (Tier S)',
        desc: 'Una dupla de alto impacto con un porcentaje de victoria sobresaliente cuando jugáis en el mismo bando.',
      };
    }
    if (wr >= 50) {
      return {
        tier: 'A',
        tierLabel: 'Tier A',
        title: 'Sólida Coordinación (Tier A)',
        desc: 'Buen entendimiento colectivo y rendimiento positivo compartiendo equipo en vuestras customs.',
      };
    }
    return {
      tier: 'B',
      tierLabel: 'Tier B',
      title: 'En Desarrollo (Tier B)',
      desc: 'Aún necesitáis ajustar vuestras combinaciones de campeones para maximizar vuestro winrate juntos.',
    };
  });
}
