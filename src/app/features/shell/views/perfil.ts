import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { NfWindow, NfButton, NfSelect, NfModal, NfToggle, NfSkeleton } from '../../../ui';
import { Session } from '../../../core/auth';
import { CURRENT_USER } from '../../../core/lobby';
import { GroupStore } from '../../../core/group-store';
import { opggUrl } from '../../../core/member-detail';
import { buildPlayerProfile } from '../../../core/player-profile';
import { LANE_ROLES, LaneRole, PreferencesStore, RolePreferences } from '../../../core/preferences';
import { ToastService } from '../../../core/toast';

/** "may 2025" — el chip lo pone en mayúsculas. Fijado a es-ES: la UI es en español. */
const MEMBER_SINCE_FMT = new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' });

/** Presentación de cada rol: el dominio solo conoce la clave (`LaneRole`). */
interface RoleTile {
  role: LaneRole;
  /** Código corto, como en el resto de la app (JUNGLA → JG, SUPPORT → SUP). */
  short: string;
  name: string;
  glyph: string;
}

/**
 * Cuenta de Riot vinculada al usuario. Mockup de UI: hoy vive en una signal
 * local del componente.
 *
 * BACKEND NOTE: la vinculación real la dueña el backend — `riotId` y `region`
 * los devolverá `GET /api/v1/me` (o un endpoint de cuentas vinculadas) junto a
 * la identidad Discord, y "vincular"/"desvincular" serán POST/DELETE. Al migrar,
 * borrar la signal semilla y leer del store; nunca mantener mock y real a la vez.
 */
interface RiotLink {
  /** Riot ID completo, formato `Nombre#TAG`. */
  riotId: string;
  region: string;
}

/**
 * Personal player profile — a cross-group career card. Every figure here is
 * aggregated over ALL groups the user belongs to (made explicit by the
 * disclaimer up top); per-group exactness lives inside each group's
 * Estadísticas. Reads the live roster set from the GroupStore so the head-to-head
 * highlights are drawn from real teammates/rivals.
 */
@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [NfWindow, NfButton, NfSelect, NfModal, NfToggle, NfSkeleton],
  template: `
    <div class="view">
      <!-- Cross-group scope disclaimer -->
      <div class="scope-note" role="note">
        <span class="scope-note__icon" aria-hidden="true">ⓘ</span>
        <p class="scope-note__text">
          Todas estas cifras son el <strong>agregado de todos tus grupos</strong>. Para datos exactos
          de un grupo concreto, ábrelo y consulta sus <strong>Estadísticas</strong>.
        </p>
      </div>

      @if (profile(); as p) {
        <!-- Hero: identity (Discord) + headline win-rate ring -->
        <section class="pf-hero" [attr.aria-busy]="identityLoading() ? 'true' : null">
          <span class="pf-hero__avatar" [style.background]="grad(p.hue)">
            @if (identityLoading()) {
              <!-- Ni iniciales de relleno ni "??": hasta que /me conteste, hueco. -->
              <nf-skeleton width="100%" height="100%" radius="0" />
            } @else if (showAvatarImage()) {
              <img
                class="pf-hero__avatar-img"
                [src]="session.avatarUrl()"
                alt=""
                referrerpolicy="no-referrer"
                (error)="avatarBroken.set(true)"
              />
            } @else {
              {{ session.initials() }}
            }
          </span>
          <div class="pf-hero__id">
            <!--
              Identidad = datos de red (GET /me). Mientras cargan, skeletons con la
              forma y el alto del contenido final, para que al llegar el dato no
              salte nada de sitio.
            -->
            @if (identityLoading()) {
              <nf-skeleton class="pf-hero__sk-name" width="min(260px, 60%)" height="30px" />
              <div class="pf-hero__meta">
                <nf-skeleton width="152px" height="23px" radius="6px" />
              </div>
            } @else {
              <h1 class="pf-hero__name">{{ heroName() }}</h1>
              <!-- Un único chip, y con dato real: la fecha de alta que manda GET /me.
                   Los de rol / nº de grupos vivían del mock y se han quitado. -->
              @if (memberSince(); as since) {
                <div class="pf-hero__meta nf-mono">
                  <span class="pf-hero__chip">◷ DESDE {{ since }}</span>
                </div>
              }
            }
          </div>

          <div class="pf-ring" [style.--wr]="p.wr" [class.pf-ring--lo]="p.wr < 50">
            <div class="pf-ring__inner">
              <div class="pf-ring__val nf-mono">{{ p.wr }}%</div>
              <div class="pf-ring__lbl nf-mono">WIN RATE</div>
            </div>
          </div>
        </section>

        <!--
          Roles preferidos: preferencia GLOBAL de cuenta (no de grupo). Editable en
          sitio, con borrador local y guardado explícito — sin modal, porque es un
          ajuste que el jugador querrá ver de un vistazo y tocar a menudo.
        -->
        <div class="view__label-row">
          <div class="view__label nf-mono">▸ ROLES PREFERIDOS</div>
          @if (rolesDirty()) {
            <div class="pf-roles__actions">
              <button nfButton variant="ghost" size="sm" [disabled]="prefs.saving()" (click)="discardRoles()">
                Descartar
              </button>
              <button nfButton variant="primary" size="sm" [disabled]="!canSaveRoles()" (click)="saveRoles()">
                {{ prefs.saving() ? 'GUARDANDO…' : 'GUARDAR CAMBIOS' }}
              </button>
            </div>
          }
        </div>

        @switch (prefs.status()) {
          @case ('loading') {
            <div class="pf-roles" aria-busy="true">
              <div class="pf-roles__grid">
                @for (t of roleTiles; track t.role) {
                  <nf-skeleton height="112px" radius="10px" />
                }
              </div>
            </div>
          }
          @case ('error') {
            <div class="pf-roles pf-roles--error" role="alert">
              <p class="pf-roles__errtext">No hemos podido cargar tus roles preferidos.</p>
              <button nfButton variant="ghost" size="sm" (click)="prefs.reload()">Reintentar</button>
            </div>
          }
          @default {
            <div class="pf-roles">
              <div class="pf-roles__grid" role="group" aria-label="Roles que quieres jugar">
                @for (t of roleTiles; track t.role) {
                  <div
                    class="role-tile"
                    [class.role-tile--on]="isSelected(t.role)"
                    [class.role-tile--primary]="isPrimary(t.role)"
                  >
                    <button
                      type="button"
                      role="checkbox"
                      class="role-tile__pick"
                      [attr.aria-checked]="isSelected(t.role)"
                      [attr.aria-label]="'Jugar ' + t.name"
                      (click)="toggleRole(t.role)"
                    >
                      <span class="role-tile__glyph" aria-hidden="true">{{ t.glyph }}</span>
                      <span class="role-tile__code nf-mono">{{ t.short }}</span>
                      <span class="role-tile__name">{{ t.name }}</span>
                    </button>

                    <!-- La estrella solo existe si el rol está seleccionado: no se puede
                         ser principal de un rol que no juegas. -->
                    @if (isSelected(t.role)) {
                      <button
                        type="button"
                        class="role-tile__star"
                        [attr.aria-pressed]="isPrimary(t.role)"
                        [attr.aria-label]="'Marcar ' + t.name + ' como rol principal'"
                        [title]="isPrimary(t.role) ? 'Es tu rol principal' : 'Marcar como rol principal'"
                        (click)="setPrimaryRole(t.role)"
                      >
                        ★
                      </button>
                    }
                  </div>
                }
              </div>

              <div class="pf-roles__foot">
                <div class="pf-roles__flex">
                  <nf-toggle
                    [checked]="isFlex()"
                    accent="cyan"
                    ariaLabel="Soy FLEX: juego cualquier rol"
                    (checkedChange)="toggleFlex($event)"
                  />
                  <div class="pf-roles__flextext">
                    <div class="pf-roles__flexname">Soy FLEX</div>
                    <div class="pf-roles__flexsub">Me vale cualquier rol de los cinco.</div>
                  </div>
                </div>

                @if (!hasRoles()) {
                  <p class="pf-roles__warn nf-mono">⚠ SELECCIONA AL MENOS UN ROL</p>
                } @else {
                  <p class="pf-roles__hint">
                    Se aplicarán automáticamente en cada <strong>grupo nuevo</strong> al que entres.
                    Dentro de un grupo puedes ajustarlos sin tocar esta preferencia.
                  </p>
                }
              </div>
            </div>
          }
        }

        <!-- Cuenta de Riot vinculada (mockup) -->
        <div class="view__label nf-mono">▸ CUENTA DE RIOT</div>
        @if (riotAccount(); as riot) {
          <div class="pf-riot pf-riot--linked">
            <span class="pf-riot__logo nf-mono" aria-hidden="true">R</span>
            <div class="pf-riot__meta">
              <div class="pf-riot__id">{{ riot.riotId }}</div>
              <div class="pf-riot__sub nf-mono">
                <span class="pf-riot__chip"><span class="pf-ping"></span>{{ riot.region }}</span>
                <span class="pf-riot__chip pf-riot__chip--ok">✓ VINCULADA</span>
              </div>
            </div>
            <div class="pf-riot__actions">
              <a class="pf-hero__opgg nf-mono nf-caps nf-go" [href]="opgg(riot.riotId)" target="_blank" rel="noopener">
                Ver en OP.GG
              </a>
              <button nfButton variant="ghost" size="sm" (click)="askUnlink()">Desvincular</button>
            </div>
          </div>
        } @else {
          <div class="pf-riot pf-riot--empty">
            <div class="pf-riot__cta">
              <div class="pf-riot__ctatitle">Sin cuenta de Riot vinculada</div>
              <p class="pf-riot__ctatext">
                Vincula tu cuenta para que tus estadísticas de invocador aparezcan en tu perfil.
              </p>
            </div>
            <button nfButton variant="accent" size="md" (click)="startLinking()">
              ＋ Vincular cuenta de Riot
            </button>
          </div>
        }

        <!-- Global record strip -->
        <div class="totals pf-totals">
          <div class="totals__item">
            <div class="totals__val nf-mono">{{ p.games }}</div>
            <div class="totals__lbl nf-mono">PARTIDAS</div>
          </div>
          <div class="totals__item">
            <div class="totals__val nf-mono pf-pos">{{ p.wins }}</div>
            <div class="totals__lbl nf-mono">VICTORIAS</div>
          </div>
          <div class="totals__item">
            <div class="totals__val nf-mono pf-neg">{{ p.losses }}</div>
            <div class="totals__lbl nf-mono">DERROTAS</div>
          </div>
          <div class="totals__item">
            <div class="totals__val nf-mono">{{ p.kda }}</div>
            <div class="totals__lbl nf-mono">KDA MEDIO</div>
          </div>
          <div class="totals__item">
            <div class="totals__val nf-mono">{{ p.hoursPlayed }}h</div>
            <div class="totals__lbl nf-mono">JUGADAS</div>
          </div>
          <div class="totals__item">
            <div class="totals__val nf-mono">{{ p.pentas }}</div>
            <div class="totals__lbl nf-mono">PENTAS</div>
          </div>
        </div>

        <!-- Streak + recent form -->
        <div class="pf-form">
          <div class="pf-form__streak" [class.pf-form__streak--lose]="p.streakType === 'L'">
            <div class="pf-form__big nf-mono">{{ p.currentStreak }}<span class="pf-form__unit">{{ p.streakType }}</span></div>
            <div class="pf-form__cap nf-mono">{{ p.streakType === 'W' ? 'RACHA DE VICTORIAS' : 'RACHA DE DERROTAS' }}</div>
            <div class="pf-form__sub nf-mono">MEJOR RACHA · {{ p.bestStreak }}W</div>
          </div>
          <div class="pf-form__recent">
            <div class="view__label nf-mono">▸ FORMA RECIENTE</div>
            <div class="pf-pills">
              @for (r of p.recentForm; track $index) {
                <span class="pf-pill" [class.pf-pill--w]="r === 'W'" [class.pf-pill--l]="r === 'L'">{{ r }}</span>
              }
            </div>
          </div>
        </div>

        <!-- Head-to-head highlights -->
        <div class="view__label nf-mono">▸ CARA A CARA · TODOS LOS GRUPOS</div>
        <div class="hl-grid pf-h2h">
          @if (p.bestAlly; as a) {
            <div class="hl" data-accent="cyan">
              <div class="hl__eyebrow nf-mono">🤝 MEJOR ALIADO</div>
              <div class="hl__hero">
                <span class="hl__avatar" [style.background]="grad(a.hue)">{{ a.initials }}</span>
                <div class="hl__who">
                  <div class="hl__name">{{ a.name }}</div>
                  <div class="hl__blurb nf-mono">{{ a.wr }}% juntos · {{ a.wins }}V {{ a.losses }}D</div>
                </div>
              </div>
              <div class="hl__score nf-mono">CON QUIEN MÁS GANAS</div>
            </div>
          }
          @if (p.nemesis; as n) {
            <div class="hl" data-accent="pink">
              <div class="hl__eyebrow nf-mono">💀 NÉMESIS</div>
              <div class="hl__hero">
                <span class="hl__avatar" [style.background]="grad(n.hue)">{{ n.initials }}</span>
                <div class="hl__who">
                  <div class="hl__name">{{ n.name }}</div>
                  <div class="hl__blurb nf-mono">{{ n.wr }}% WR · {{ n.wins }}V {{ n.losses }}D</div>
                </div>
              </div>
              <div class="hl__score nf-mono">CONTRA QUIEN MÁS PIERDES</div>
            </div>
          }
          @if (p.favoriteVictim; as v) {
            <div class="hl" data-accent="yellow">
              <div class="hl__eyebrow nf-mono">🎯 VÍCTIMA FAVORITA</div>
              <div class="hl__hero">
                <span class="hl__avatar" [style.background]="grad(v.hue)">{{ v.initials }}</span>
                <div class="hl__who">
                  <div class="hl__name">{{ v.name }}</div>
                  <div class="hl__blurb nf-mono">{{ v.wr }}% WR · {{ v.wins }}V {{ v.losses }}D</div>
                </div>
              </div>
              <div class="hl__score nf-mono">A QUIEN MÁS GANAS</div>
            </div>
          }
        </div>

        <!-- Most-played champions -->
        <div class="view__label nf-mono">▸ CAMPEONES MÁS JUGADOS</div>
        <nf-window class="pf-champ-window" title="campeones.exe" accent="cyan" bodyPadding="0">
          <div class="pf-champs">
            @for (c of p.topChampions; track c.champion.name) {
              <div class="pf-champ">
                <span
                  class="champ-icon"
                  [style.background]="'linear-gradient(135deg, ' + c.champion.c1 + ', ' + c.champion.c2 + ')'"
                >{{ c.champion.initials }}</span>
                <div class="pf-champ__meta">
                  <div class="pf-champ__name">{{ c.champion.name }} <span class="pf-champ__role nf-mono">{{ c.champion.role }}</span></div>
                  <div class="pf-champ__bar">
                    <span class="pf-champ__fill" [class.pf-champ__fill--lo]="c.wr < 50" [style.width.%]="c.wr"></span>
                  </div>
                </div>
                <div class="pf-champ__nums">
                  <span class="pf-champ__wr nf-mono" [class.pf-neg]="c.wr < 50">{{ c.wr }}%</span>
                  <span class="pf-champ__games nf-mono">{{ c.games }} part.</span>
                </div>
              </div>
            }
          </div>
        </nf-window>

        <!-- Per-group breakdown -->
        <div class="view__label nf-mono">▸ DESGLOSE POR GRUPO</div>
        <div class="pf-groups">
          @for (g of p.groups; track g.id) {
            <div class="pf-group" [style.--grp-c1]="g.c1" [style.--grp-c2]="g.c2">
              <span class="pf-group__avatar">{{ g.initials }}</span>
              <div class="pf-group__meta">
                <div class="pf-group__name">{{ g.name }}</div>
                <div class="pf-group__sub nf-mono">{{ g.wins }}V {{ g.losses }}D · {{ g.games }} partidas · {{ g.role }}</div>
              </div>
              <span class="pf-group__wr nf-mono" [class.pf-neg]="g.wr < 50">{{ g.wr }}%</span>
            </div>
          } @empty {
            <div class="empty-state">
              <div class="empty-state__icon">◎</div>
              <div class="empty-state__text nf-mono nf-eyebrow">Sin grupos todavía</div>
            </div>
          }
        </div>
      }

      <!-- Vincular cuenta de Riot: diálogo sobre fondo difuminado -->
      @if (linking()) {
        <nf-modal title="vincular_riot.exe" accent="cyan" (closed)="cancelLinking()">
          <div class="settings-eyebrow nf-mono nf-eyebrow">Vincular cuenta de Riot</div>

          <div class="riot-link">
            <span class="pf-riot__logo nf-mono" aria-hidden="true">R</span>
            <p class="riot-link__text">
              Introduce tu Riot ID tal y como aparece en el cliente. Lo usaremos para traer tus
              estadísticas de invocador a este perfil.
            </p>
          </div>

          <div class="form-grid">
            <div class="field">
              <label class="field__label nf-mono" for="riot-id">RIOT ID</label>
              <input
                id="riot-id"
                class="field__input"
                type="text"
                placeholder="Nombre#TAG"
                autocomplete="off"
                [value]="riotIdDraft()"
                (input)="riotIdDraft.set($any($event.target).value)"
                (keydown.enter)="confirmLink()"
              />
            </div>

            <div class="field">
              <label class="field__label nf-mono">REGIÓN</label>
              <nf-select
                [options]="regions"
                [value]="regionDraft()"
                (valueChange)="regionDraft.set($event)"
              />
            </div>
          </div>

          <!-- Aviso de honor: la vinculación no está verificada contra Riot. -->
          <div class="scope-note scope-note--warn" role="note">
            <span class="scope-note__icon" aria-hidden="true">⚠</span>
            <p class="scope-note__text">
              <strong>No podemos verificar de manera real que tienes dicha cuenta en propiedad.</strong>
              Vincula solo tu cuenta: si pones la de otra persona, falsearás tus estadísticas y las
              de tus grupos, y quien lo haga a propósito puede ser expulsado.
            </p>
          </div>

          <div class="form-foot">
            <button nfButton variant="primary" size="md" [disabled]="!linkValid()" (click)="confirmLink()" class="nf-go">
              Vincular</button>
            <button nfButton variant="ghost" size="md" (click)="cancelLinking()">Cancelar</button>
          </div>
        </nf-modal>
      }

      <!-- Desvincular: acción destructiva, siempre confirmada -->
      @if (unlinking(); as riot) {
        <nf-modal title="desvincular_riot.exe" accent="pink" width="440px" (closed)="cancelUnlink()">
          <div class="settings-eyebrow nf-mono nf-eyebrow">Desvincular cuenta de Riot</div>

          <p class="confirm__text">
            Vas a desvincular <strong>{{ riot.riotId }}</strong> de tu perfil. Dejaremos de mostrar
            tus estadísticas de invocador. Podrás volver a vincularla cuando quieras.
          </p>

          <div class="form-foot">
            <button nfButton variant="danger" size="md" (click)="confirmUnlink()">
              Sí, desvincular
            </button>
            <button nfButton variant="ghost" size="md" (click)="cancelUnlink()">Cancelar</button>
          </div>
        </nf-modal>
      }
    </div>
  `,
})
export class Perfil {
  private readonly groups = inject(GroupStore);
  /** Identidad real del usuario (Discord). Singleton ya cargado por el shell vía
   * `ensureLoaded()`: leer sus signals aquí NO dispara ninguna petición extra. */
  protected readonly session = inject(Session);
  /** Mock legacy: solo alimenta las estadísticas agregadas (placeholder). La
   * identidad mostrada (nombre/avatar) viene de `session`, no de aquí. */
  private readonly user = CURRENT_USER;

  readonly profile = computed(() =>
    buildPlayerProfile(this.user, this.groups.groups(), (id) => this.groups.rosterOf(id)),
  );

  // ── Roles preferidos (preferencia global de cuenta) ────────────────
  protected readonly prefs = inject(PreferencesStore);
  private readonly toast = inject(ToastService);

  protected readonly roleTiles: RoleTile[] = [
    { role: 'TOP', short: 'TOP', name: 'Top', glyph: '◤' },
    { role: 'JUNGLA', short: 'JG', name: 'Jungla', glyph: '♣' },
    { role: 'MID', short: 'MID', name: 'Mid', glyph: '◈' },
    { role: 'ADC', short: 'ADC', name: 'ADC', glyph: '➤' },
    { role: 'SUPPORT', short: 'SUP', name: 'Support', glyph: '✚' },
  ];

  constructor() {
    // Idempotente y deduplicado: si otra vista ya las pidió, no hay petición extra.
    this.prefs.ensureLoaded();
  }

  /**
   * Borrador editable. `linkedSignal` sobre el valor confirmado por el servidor:
   * se resincroniza solo cuando este cambia (carga, guardado, `reload()`), así que
   * tras guardar el borrador deja de estar sucio sin tocarlo a mano.
   */
  readonly roleDraft = linkedSignal<RolePreferences, RolePreferences>({
    source: this.prefs.prefs,
    computation: (saved) => ({ roles: [...saved.roles], primary: saved.primary }),
  });

  readonly hasRoles = computed(() => this.roleDraft().roles.length > 0);
  /** FLEX = los cinco roles marcados (lo que el matchmaking lee como "cualquiera"). */
  readonly isFlex = computed(() => this.roleDraft().roles.length === LANE_ROLES.length);

  readonly rolesDirty = computed(() => {
    const draft = this.roleDraft();
    const saved = this.prefs.prefs();
    return (
      draft.primary !== saved.primary ||
      draft.roles.length !== saved.roles.length ||
      !draft.roles.every((r) => saved.roles.includes(r))
    );
  });

  readonly canSaveRoles = computed(() => this.rolesDirty() && this.hasRoles() && !this.prefs.saving());

  isSelected(role: LaneRole): boolean {
    return this.roleDraft().roles.includes(role);
  }

  isPrimary(role: LaneRole): boolean {
    return this.roleDraft().primary === role;
  }

  toggleRole(role: LaneRole): void {
    this.roleDraft.update((d) => {
      const on = d.roles.includes(role);
      // Se reconstruye desde LANE_ROLES para mantener siempre el orden de líneas.
      const roles = LANE_ROLES.filter((r) => (r === role ? !on : d.roles.includes(r)));
      return { roles, primary: this.keepPrimary(roles, d.primary) };
    });
  }

  setPrimaryRole(role: LaneRole): void {
    if (!this.isSelected(role)) return;
    this.roleDraft.update((d) => ({ ...d, primary: role }));
  }

  /** FLEX marca los cinco; al desmarcarlo se queda solo el principal. */
  toggleFlex(flex: boolean): void {
    this.roleDraft.update((d) => {
      const roles = flex ? [...LANE_ROLES] : d.primary ? [d.primary] : [];
      return { roles, primary: this.keepPrimary(roles, d.primary) };
    });
  }

  discardRoles(): void {
    const saved = this.prefs.prefs();
    this.roleDraft.set({ roles: [...saved.roles], primary: saved.primary });
  }

  /**
   * Escritura pesimista: el store no publica nada hasta que el servidor confirma,
   * y el botón queda deshabilitado mientras (`canSaveRoles`), así que no hay doble
   * submit posible. El fallo se cuenta y el borrador sobrevive para reintentar.
   */
  async saveRoles(): Promise<void> {
    if (!this.canSaveRoles()) return;
    const ok = await this.prefs.save(this.roleDraft());
    if (ok) this.toast.success('Roles preferidos guardados.');
    else this.toast.error('No se han podido guardar tus roles. Inténtalo de nuevo.');
  }

  /** El principal debe seguir estando entre los roles elegidos; si no, cae al primero. */
  private keepPrimary(roles: readonly LaneRole[], primary: LaneRole | null): LaneRole | null {
    if (primary && roles.includes(primary)) return primary;
    return roles[0] ?? null;
  }

  /** Nombre del hero: el de Discord, con las estadísticas mock como reserva. */
  readonly heroName = computed(() => this.session.displayName() || this.profile()?.name || '');

  /**
   * La identidad todavía viene en camino: el hero pinta skeletons en su sitio.
   * En `error` NO se skeletoniza (sería una espera eterna): el guard ya expulsa a
   * quien no tiene sesión, así que aquí solo quedaría un hero sin nombre.
   */
  readonly identityLoading = computed(
    () => this.session.status() === 'idle' || this.session.status() === 'loading',
  );

  /**
   * Fecha de alta formateada (`2025-05-14T…Z` → "MAY 2025"). Null mientras no haya
   * usuario cargado, o si el backend mandase algo no parseable: antes de pintar un
   * "Invalid Date" en el perfil, mejor no pintar el chip.
   */
  readonly memberSince = computed(() => {
    const iso = this.session.createdAt();
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return MEMBER_SINCE_FMT.format(date).replace('.', '').toUpperCase();
  });

  /**
   * El CDN de Discord puede devolver 404 si el usuario cambió su avatar tras
   * nuestro último login. Si la imagen falla, caemos a las iniciales.
   * `linkedSignal` para reintentar al cambiar la URL (p. ej. `session.reload()`).
   */
  readonly avatarBroken = linkedSignal({
    source: this.session.avatarUrl,
    computation: () => false,
  });
  readonly showAvatarImage = computed(() => !!this.session.avatarUrl() && !this.avatarBroken());

  // ── Cuenta de Riot (mockup, sin backend) ──────────────────────────
  /** Sembrada como "ya vinculada" para mostrar ese estado por defecto. */
  readonly riotAccount = signal<RiotLink | null>({ riotId: 'N1ghtfang#LAN', region: 'LAN' });
  readonly linking = signal(false);
  /** Cuenta pendiente de confirmar su desvinculación (null = sin diálogo abierto). */
  readonly unlinking = signal<RiotLink | null>(null);
  readonly riotIdDraft = signal('');
  readonly regionDraft = signal('LAN');
  readonly regions = ['LAN', 'LAS', 'NA', 'EUW', 'EUNE', 'KR', 'BR', 'OCE', 'TR', 'RU', 'JP'];

  /** Riot ID válido = `Nombre#TAG` con ambas partes no vacías. */
  readonly linkValid = computed(() => /^.+#.+$/.test(this.riotIdDraft().trim()));

  startLinking(): void {
    this.riotIdDraft.set('');
    this.regionDraft.set('LAN');
    this.linking.set(true);
  }

  cancelLinking(): void {
    this.linking.set(false);
  }

  confirmLink(): void {
    if (!this.linkValid()) return;
    // BACKEND NOTE: aquí irá el POST de vinculación. El backend podrá comprobar
    // contra la API de Riot que la cuenta EXISTE y devolver su forma canónica,
    // pero no que sea del usuario: la propiedad solo se demuestra con RSO
    // (OAuth de Riot). Hasta entonces la vinculación es declarativa — de ahí el
    // aviso del modal. Si algún día entra RSO, ese aviso desaparece.
    this.riotAccount.set({ riotId: this.riotIdDraft().trim(), region: this.regionDraft() });
    this.linking.set(false);
  }

  /** Desvincular es destructivo: no se ejecuta sin pasar por el diálogo. */
  askUnlink(): void {
    this.unlinking.set(this.riotAccount());
  }

  cancelUnlink(): void {
    this.unlinking.set(null);
  }

  confirmUnlink(): void {
    // BACKEND NOTE: DELETE de la vinculación. Al migrar, esto es una escritura
    // pesimista: deshabilitar el botón mientras esté en vuelo, esperar la
    // confirmación del servidor y solo entonces cerrar el diálogo, avisar por
    // toast y refetch de las estadísticas derivadas (no recalcularlas aquí).
    this.riotAccount.set(null);
    this.unlinking.set(null);
    this.linking.set(false);
  }

  /** Avatar radial gradient from a hue, matching the roster/ranking look. */
  grad(hue: number): string {
    return `radial-gradient(circle at 32% 26%, hsl(${hue},90%,64%), hsl(${hue},78%,30%))`;
  }

  opgg(tag: string): string {
    return opggUrl(tag);
  }
}
