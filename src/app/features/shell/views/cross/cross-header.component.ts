import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NfAvatar, NfSegmentOption, NfSegmented, NfSkeleton } from '../../../../ui';
import { CrossViewState } from './cross-view-state';

/** Cuál de las tres vistas del cruce está abierta. */
export type CrossTab = 'historial' | 'enemigos' | 'aliados';

/**
 * La cabecera del cara a cara: quién contra quién, el balance del cruce y el conmutador que
 * lleva a las tres vistas.
 *
 * Es un componente y no tres cabeceras parecidas porque el balance tiene que decir lo mismo en
 * las tres pantallas. La versión anterior lo pintaba solo en el historial cruzado, con cifras
 * que salían de una semilla distinta a la de su propia lista.
 */
@Component({
  selector: 'app-cross-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfSegmented, NfSkeleton],
  template: `
    @if (state.player(); as p) {
      <a class="view-back nf-mono" [routerLink]="['/app', 'perfil', p.tag]">
        <span class="view-back__arrow" aria-hidden="true">←</span>
        Volver al perfil de {{ p.name }}
      </a>

      <header class="cx-hero" [attr.aria-busy]="state.loading() ? 'true' : null">
        <div class="cx-hero__who">
          <nf-avatar
            class="cx-hero__avatar"
            [src]="p.avatarUrl"
            [fallback]="p.name"
            [tint]="p.hue"
            [size]="58"
            shape="round"
            [alt]="'Avatar de ' + p.name"
          />
          <div class="cx-hero__id">
            <div class="cx-hero__eyebrow nf-mono">Cara a cara</div>
            <h1 class="cx-hero__title">Tú y {{ p.name }}</h1>
            <div class="cx-hero__tag nf-mono">{{ p.tag }}</div>
          </div>
        </div>

        <dl class="cx-kpis">
          <div class="cx-kpi">
            <dt class="cx-kpi__label nf-mono">Partidas cruzadas</dt>
            <dd class="cx-kpi__value nf-mono">
              @if (state.loading()) {
                <nf-skeleton width="34px" height="22px" />
              } @else {
                {{ total().games }}
              }
            </dd>
          </div>

          <div class="cx-kpi cx-kpi--ally">
            <dt class="cx-kpi__label nf-mono">Juntos</dt>
            <dd class="cx-kpi__value nf-mono">
              @if (state.loading()) {
                <nf-skeleton width="52px" height="22px" />
              } @else if (together().games > 0) {
                {{ together().winrate }} %
              } @else {
                Ninguna
              }
            </dd>
            @if (!state.loading() && together().games > 0) {
              <dd class="cx-kpi__sub nf-mono">
                {{ together().wins }}V - {{ together().losses }}D en {{ together().games }}
                {{ together().games === 1 ? 'partida' : 'partidas' }}
              </dd>
            }
          </div>

          <div class="cx-kpi cx-kpi--enemy">
            <dt class="cx-kpi__label nf-mono">En contra</dt>
            <dd class="cx-kpi__value nf-mono">
              @if (state.loading()) {
                <nf-skeleton width="52px" height="22px" />
              } @else if (against().games > 0) {
                {{ against().wins }} - {{ against().losses }}
              } @else {
                Ninguna
              }
            </dd>
            @if (!state.loading() && against().games > 0) {
              <dd class="cx-kpi__sub nf-mono" [class.cx-pos]="lead() > 0" [class.cx-neg]="lead() < 0">
                {{ leadLabel() }}
              </dd>
            }
          </div>
        </dl>
      </header>

      <nav class="cx-tabs">
        <nf-segmented
          variant="tabs"
          [options]="tabs()"
          [value]="active()"
          (valueChange)="go($event)"
          ariaLabel="Secciones del cara a cara"
        />
      </nav>
    }
  `,
})
export class CrossHeaderComponent {
  readonly active = input.required<CrossTab>();

  protected readonly state = inject(CrossViewState);
  private readonly router = inject(Router);

  protected readonly total = this.state.aggregateAll;
  protected readonly together = this.state.aggregateAllies;
  protected readonly against = this.state.aggregateEnemies;

  /**
   * Las etiquetas llevan el recuento porque es lo que decide si merece la pena entrar: una
   * pestaña «Juntos» que resulta estar vacía es un clic tirado, y aquí ya se sabe.
   */
  protected readonly tabs = computed<NfSegmentOption[]>(() => [
    { value: 'historial', label: 'Historial cruzado' },
    { value: 'enemigos', label: `En contra (${this.against().games})` },
    { value: 'aliados', label: `Juntos (${this.together().games})` },
  ]);

  /** Positivo = vas ganando tú el marcador de los duelos. */
  protected readonly lead = computed(() => this.against().wins - this.against().losses);

  protected readonly leadLabel = computed(() => {
    const lead = this.lead();
    const name = this.state.player()?.name ?? 'el rival';
    if (lead > 0) return `Vas ganando tú por ${lead}`;
    if (lead < 0) return `Va ganando ${name} por ${-lead}`;
    return 'Marcador empatado';
  });

  protected go(tab: string): void {
    const id = this.state.playerId();
    if (tab === this.active() || !id) return;
    this.router.navigate([`/app/${SEGMENT[tab as CrossTab] ?? 'historial-cruzado'}`, id]);
  }
}

/** Cada pestaña es una ruta propia: el conmutador navega, no oculta contenido. */
const SEGMENT: Record<CrossTab, string> = {
  historial: 'historial-cruzado',
  enemigos: 'versus',
  aliados: 'synergy',
};
