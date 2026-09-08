import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NfSkeleton } from '../../../../ui';
import { GroupMultikills } from '../../../../core/group-stats';

/**
 * Marcador grupal de asesinatos múltiples acumulados (§5.5.5):
 * Total de Pentakills, Cuádruples y Triples firmados en el grupo en el alcance activo,
 * destacando a los máximos ejecutores.
 */
@Component({
  selector: 'app-stats-multikills',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfSkeleton],
  template: `
    <section class="st-card mk-card" [attr.aria-busy]="loading() ? 'true' : null">
      <header class="st-card__head">
        <h2 class="st-card__title">Masacres del grupo</h2>
        <span class="mk-card__note">Asesinatos múltiples acumulados en este período</span>
      </header>

      @if (loading()) {
        <div class="mk-card__grid">
          @for (s of [0, 1, 2]; track s) {
            <nf-skeleton width="100%" height="96px" radius="10px" />
          }
        </div>
      } @else if (multikills(); as m) {
        <div class="mk-card__grid">
          <article class="mk-item mk-item--penta">
            <div class="mk-item__badge">
              <span class="mk-item__glyph" aria-hidden="true">👑</span>
              <span class="mk-item__tier">Pentakills</span>
            </div>
            <div class="mk-item__count nf-mono">{{ m.pentas }}</div>
            <div class="mk-item__sub">
              @if (m.topPentaHunter; as hunter) {
                <span class="mk-item__leader">Líder: <strong>{{ hunter.name }}</strong> ({{ hunter.count }})</span>
              } @else {
                <span class="mk-item__empty">Ninguno firmado aún</span>
              }
            </div>
          </article>

          <article class="mk-item mk-item--quadra">
            <div class="mk-item__badge">
              <span class="mk-item__glyph" aria-hidden="true">⚡</span>
              <span class="mk-item__tier">Cuádruples</span>
            </div>
            <div class="mk-item__count nf-mono">{{ m.quadras }}</div>
            <div class="mk-item__sub">
              @if (m.topQuadraHunter; as hunter) {
                <span class="mk-item__leader">Líder: <strong>{{ hunter.name }}</strong> ({{ hunter.count }})</span>
              } @else {
                <span class="mk-item__empty">Ninguno firmado aún</span>
              }
            </div>
          </article>

          <article class="mk-item mk-item--triple">
            <div class="mk-item__badge">
              <span class="mk-item__glyph" aria-hidden="true">🔥</span>
              <span class="mk-item__tier">Triples</span>
            </div>
            <div class="mk-item__count nf-mono">{{ m.triples }}</div>
            <div class="mk-item__sub">
              <span class="mk-item__leader">Peleas grupales dominadas</span>
            </div>
          </article>
        </div>
      } @else {
        <p class="st-card__empty">No hay datos de asesinatos múltiples registrados.</p>
      }
    </section>
  `,
  styleUrls: ['./stats-card.scss', './stats-multikills.component.scss'],
})
export class StatsMultikillsComponent {
  readonly multikills = input<GroupMultikills | null>(null);
  readonly loading = input(false);
}
