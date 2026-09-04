import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NfAvatar } from '../../../../ui';
import { MedalBoard } from '../../../../core/group-medals';
import { MedalIconComponent } from './medal-icon.component';

/**
 * Detalle de una medalla del Hall of Fame (§5.5.5): quién la ostenta, el podio del
 * grupo y cuánto te falta a ti para arrebatársela.
 *
 * Es solo el contenido; quien lo envuelve en `<nf-modal>` y decide cuándo se abre y
 * se cierra es la vista. Si el usuario no pertenece al grupo, el bloque de progreso
 * personal no se pinta: es mejor no decir nada que inventar un puesto.
 */
@Component({
  selector: 'app-medal-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfAvatar, MedalIconComponent],
  template: `
    @if (board(); as b) {
      <div class="md">
        <header class="md__head">
          <span class="md__icon" aria-hidden="true">
            <app-medal-icon [icon]="b.medal.icon" />
          </span>
          <p class="md__description">{{ b.medal.description }}</p>
        </header>

        @if (b.leader; as leader) {
          <section class="md__leader">
            <span class="md__label">Líder actual</span>
            <div class="md__leader-row">
              <nf-avatar
                [src]="leader.member.avatar ?? null"
                [fallback]="leader.member.name"
                [tint]="leader.member.hue"
                [size]="38"
                shape="square"
              />
              <span class="md__leader-meta">
                <span class="md__leader-name">{{ leader.member.name }}</span>
                <span class="md__leader-tag nf-mono">{{ leader.member.tag }}</span>
              </span>
              <span class="md__leader-value nf-mono">{{ leader.value }}</span>
            </div>
          </section>
        } @else {
          <p class="md__vacant">
            Todavía no la ha ganado nadie del grupo. Sé el primero.
          </p>
        }

        @if (b.podium.length > 1) {
          <section class="md__podium">
            <span class="md__label">Podio del grupo</span>
            <ol class="md__podium-list">
              @for (row of b.podium; track row.member.tag) {
                <li class="md__podium-row" [attr.data-podium]="row.rank">
                  <span class="md__podium-rank nf-mono">{{ row.rank }}.º</span>
                  <nf-avatar
                    [src]="row.member.avatar ?? null"
                    [fallback]="row.member.name"
                    [tint]="row.member.hue"
                    [size]="26"
                    shape="square"
                  />
                  <span class="md__podium-name">{{ row.member.name }}</span>
                  <span class="md__podium-value nf-mono">{{ row.value }}</span>
                </li>
              }
            </ol>
          </section>
        }

        @if (b.me; as me) {
          <section class="md__me">
            <span class="md__label">Tu progreso</span>

            <p class="md__me-line nf-mono">Vas {{ me.rank }}.º con {{ me.value }}</p>

            @if (b.progress !== null) {
              <div
                class="md__bar"
                role="progressbar"
                aria-label="Progreso hacia el primer puesto"
                [attr.aria-valuemin]="0"
                [attr.aria-valuemax]="100"
                [attr.aria-valuenow]="b.progress"
                [attr.aria-valuetext]="me.value + ', el ' + b.progress + ' por ciento de la marca del líder'"
              >
                <span class="md__bar-fill" [style.width.%]="b.progress"></span>
              </div>
              <p class="md__bar-text nf-mono">{{ b.progress }}% de la marca del líder</p>
            }

            @if (b.gap && b.leader) {
              <p class="md__me-gap">
                Te faltan {{ b.gap }} para arrebatarle el primer puesto a
                {{ b.leader.member.name }}.
              </p>
            } @else {
              <p class="md__me-gap md__me-gap--first">
                Nadie del grupo te supera en esto ahora mismo.
              </p>
            }
          </section>
        }
      </div>
    }
  `,
  styleUrls: ['./medal-detail.component.scss'],
})
export class MedalDetailComponent {
  readonly board = input<MedalBoard | null>(null);
}
