import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NfButton, NfIconButton, NfModal } from '../../../../ui';
import { ProfileGroupRecord } from '../../../../core/player-profile';

/** Huecos de la vitrina. Tres es lo que cabe en la columna sin encoger la imagen. */
const SLOTS = 3;

/** Un puesto de podio con nombre; fuera del podio no hay trofeo que enseñar. */
const PODIUM: Record<number, string> = {
  1: 'Campeón',
  2: 'Subcampeón',
  3: 'Tercer puesto',
};

/** Un trofeo del jugador, ya listo para pintarse. */
interface Trophy {
  /** Identifica el trofeo en la vitrina y en el modal: un grupo, una temporada. */
  id: string;
  /** Lo que se lee grande: «Campeón», «Subcampeón», «Tercer puesto». */
  name: string;
  position: 1 | 2 | 3;
  groupName: string;
  seasonName: string;
  imageSrc: string;
}

/**
 * Vitrina de trofeos del perfil propio (§5.5.13): los podios que ha ganado el jugador.
 *
 * El dueño del perfil —y solo él— puede **elegir cuáles de sus trofeos se enseñan**, con el botón
 * de la cabecera y su modal. De ahí el input `editable`: la tarjeta es la misma en un perfil
 * ajeno, pero allí no se pinta el botón, porque no se edita la vitrina de otro.
 *
 * BACKEND NOTE: la elección **no se guarda**. Vive en la signal `picked` y se pierde al recargar,
 * porque no hay dónde guardarla: el backend no modela la vitrina del jugador (no existe
 * `PUT /players/me/trophy-case` ni campo equivalente en el perfil). Cuando exista, `save()` pasa a
 * ser una escritura pesimista contra ese endpoint —botón en `pending`, `await`, y solo entonces
 * cerrar el modal— y el valor por defecto deja de calcularse aquí para venir con el perfil.
 */
@Component({
  selector: 'app-profile-trophies-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfButton, NfIconButton, NfModal],
  styleUrl: './profile-trophies-card.component.scss',
  template: `
    <section class="pf-card pf-trophies-card">
      <div class="pf-card__header">
        <span class="pf-card__title nf-mono">Vitrina de trofeos</span>

        @if (editable() && catalogue().length) {
          <button
            nfIconButton
            size="sm"
            label="Elegir qué trofeos se enseñan en la vitrina"
            (click)="openEditor()"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M11.2 2.6a1.4 1.4 0 0 1 2 2L6 11.8l-2.7.9.9-2.7 7-7.4Z"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        }
      </div>

      @if (shown().length) {
        <ul class="pf-trophies__row">
          @for (t of shown(); track t.id) {
            <li
              class="pf-trophy"
              [class.pf-trophy--p2]="t.position === 2"
              [class.pf-trophy--p3]="t.position === 3"
            >
              <img
                class="pf-trophy__cup"
                [src]="t.imageSrc"
                [alt]="t.name + ' de ' + t.groupName"
                width="56"
                height="56"
              />
              <span class="pf-trophy__name">{{ t.name }}</span>
              <span class="pf-trophy__group">{{ t.groupName }}</span>
              <span class="pf-trophy__season nf-mono">{{ t.seasonName }}</span>
            </li>
          }
        </ul>
      } @else {
        <div class="empty-state empty-state--compact">
          <!-- SVG inline con currentColor, no un emoji: app.scss ya dimensiona el icono de un
               estado vacío, y un emoji lo dibuja el sistema operativo, así que cambia de aspecto
               entre plataformas y no obedece a los tokens de color. -->
          <span class="empty-state__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M7 3h10v6a5 5 0 0 1-10 0V3Z" />
              <path d="M7 5H4v1a3 3 0 0 0 3 3" />
              <path d="M17 5h3v1a3 3 0 0 1-3 3" />
              <path d="M12 14v3" />
              <path d="M8.5 21h7l-.9-4h-5.2l-.9 4Z" />
            </svg>
          </span>
          <span class="empty-state__text nf-mono">{{ emptyText() }}</span>
        </div>
      }
    </section>

    @if (editing()) {
      <nf-modal title="Elegir los trofeos de la vitrina" width="520px" (closed)="cancel()">
        <p class="pf-trophies__hint">
          Caben {{ slots }} trofeos. Marca los que quieras enseñar en tu perfil.
        </p>

        <ul class="pf-trophies__picker">
          @for (t of catalogue(); track t.id) {
            <li>
              <label class="pf-trophy-pick" [class.is-on]="isDrafted(t.id)">
                <input
                  type="checkbox"
                  class="pf-trophy-pick__box"
                  [checked]="isDrafted(t.id)"
                  [disabled]="isFull() && !isDrafted(t.id)"
                  (change)="toggle(t.id)"
                />
                <img class="pf-trophy-pick__cup" [src]="t.imageSrc" alt="" width="34" height="34" />
                <span class="pf-trophy-pick__meta">
                  <span class="pf-trophy-pick__name">{{ t.name }}</span>
                  <span class="pf-trophy-pick__sub nf-mono">
                    {{ t.groupName }} · {{ t.seasonName }}
                  </span>
                </span>
              </label>
            </li>
          }
        </ul>

        <div class="pf-trophies__actions">
          <span class="pf-trophies__count nf-mono">
            {{ draft().length }} de {{ slots }} elegidos
          </span>
          <button nfButton variant="ghost" size="sm" (click)="cancel()">Cancelar</button>
          <button nfButton size="sm" (click)="save()">Guardar vitrina</button>
        </div>
      </nf-modal>
    }
  `,
})
export class ProfileTrophiesCardComponent {
  readonly groups = input.required<readonly ProfileGroupRecord[]>();
  /** Solo el dueño del perfil edita su vitrina; en un perfil ajeno se mira y ya. */
  readonly editable = input(false);

  protected readonly slots = SLOTS;

  /** Todo lo que el jugador ha ganado: lo que se puede elegir para la vitrina. */
  protected readonly catalogue = computed<Trophy[]>(() =>
    this.groups()
      .filter((g) => PODIUM[g.rankPosition] !== undefined)
      .map((g) => ({
        id: g.id + '::' + g.seasonName,
        name: PODIUM[g.rankPosition],
        position: g.rankPosition as 1 | 2 | 3,
        groupName: g.name,
        seasonName: g.seasonName,
        imageSrc: '/assets/trofeos/Trofeo' + g.rankPosition + '.webp',
      }))
      .sort((a, b) => a.position - b.position),
  );

  /**
   * Lo que el usuario ha elegido enseñar, o `null` mientras no haya tocado la vitrina.
   *
   * El `null` es la parte importante y no un detalle: sin él no hay forma de distinguir "aún no
   * ha elegido" de "ha elegido esto", y el valor por defecto se congelaba con el catálogo a
   * medias. El perfil llega en dos tiempos —primero sin grupos, luego con ellos—, así que un
   * valor calculado en el primero se quedaba enseñando un solo trofeo cuando ya había tres.
   */
  private readonly picked = signal<readonly string[] | null>(null);

  /** Los mejores puestos mientras no se elija otra cosa. */
  protected readonly chosen = computed<readonly string[]>(() => {
    const ids = this.picked();
    const catalogue = this.catalogue();
    if (!ids) return catalogue.slice(0, SLOTS).map((t) => t.id);
    return ids.filter((id) => catalogue.some((t) => t.id === id));
  });

  protected readonly shown = computed<Trophy[]>(() => {
    const ids = this.chosen();
    return this.catalogue()
      .filter((t) => ids.includes(t.id))
      .slice(0, SLOTS);
  });

  protected readonly emptyText = computed(() =>
    this.catalogue().length
      ? 'No has elegido ningún trofeo para la vitrina'
      : 'Todavía no has terminado ninguna temporada en el podio',
  );

  // ── El modal de edición ────────────────────────────────────────────────
  // `draft` es el estado del modal, no el de la vitrina: cancelar tiene que dejarla como estaba.
  protected readonly editing = signal(false);
  protected readonly draft = signal<readonly string[]>([]);

  protected isDrafted(id: string): boolean {
    return this.draft().includes(id);
  }

  /** Con la vitrina llena, lo que no está marcado se deshabilita en vez de desaparecer. */
  protected isFull(): boolean {
    return this.draft().length >= SLOTS;
  }

  protected openEditor(): void {
    this.draft.set([...this.chosen()]);
    this.editing.set(true);
  }

  protected toggle(id: string): void {
    this.draft.update((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      return ids.length >= SLOTS ? ids : [...ids, id];
    });
  }

  protected save(): void {
    this.picked.set([...this.draft()]);
    this.editing.set(false);
  }

  protected cancel(): void {
    this.editing.set(false);
  }
}
