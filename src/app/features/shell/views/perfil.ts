import { Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { NfWindow, NfButton, NfSelect, NfModal, NfToggle, NfSkeleton } from '../../../ui';
import { Session } from '../../../core/auth';
import { CURRENT_USER } from '../../../core/lobby';
import { GroupStore } from '../../../core/group-store';
import { opggUrl } from '../../../core/member-detail';
import { buildPlayerProfile } from '../../../core/player-profile';
import { LANE_ROLES, LaneRole, PreferencesStore, RolePreferences } from '../../../core/preferences';
import { PairingCode, RIOT_REGIONS, RiotAccount, RiotAccountStore, RiotRegion } from '../../../core/riot';
import { errorMessage } from '../../../core/http';
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

/** "23 jul, 10:00" — la fecha en que el cooldown de re-vinculación se levanta. */
const RELINK_FMT = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

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

        <!-- Cuenta de Riot vinculada -->
        <div class="view__label nf-mono">▸ CUENTA DE RIOT</div>
        @switch (riot.status()) {
          @case ('loading') {
            <!-- Mismo hueco que la tarjeta real: al llegar el dato no salta nada. -->
            <div aria-busy="true"><nf-skeleton width="100%" height="84px" radius="10px" /></div>
          }
          @case ('error') {
            <div class="pf-riot pf-riot--empty">
              <div class="pf-riot__cta">
                <div class="pf-riot__ctatitle">No hemos podido cargar tu cuenta de Riot</div>
                <p class="pf-riot__ctatext">Puede ser un problema de conexión.</p>
              </div>
              <button nfButton variant="ghost" size="md" (click)="retryRiot()">Reintentar</button>
            </div>
          }
          @default {
            @if (riot.account(); as account) {
              <div class="pf-riot pf-riot--linked">
                <span class="pf-riot__logo nf-mono" aria-hidden="true">R</span>
                <div class="pf-riot__meta">
                  <div class="pf-riot__id">{{ account.riotId }}</div>
                  <div class="pf-riot__sub nf-mono">
                    <span class="pf-riot__chip"><span class="pf-ping"></span>{{ account.region }}</span>
                    <!-- El chip dice la verdad de cada peldaño: solo VERIFIED afirma titularidad. -->
                    @switch (account.strength) {
                      @case ('VERIFIED') {
                        <span class="pf-riot__chip pf-riot__chip--ok">✓ VERIFICADA</span>
                      }
                      @case ('PAIRED') {
                        <span class="pf-riot__chip">↔ VINCULADA DESDE EL CLIENTE</span>
                      }
                      @default {
                        <span class="pf-riot__chip">SIN VERIFICAR</span>
                      }
                    }
                  </div>
                </div>
                <div class="pf-riot__actions">
                  <a class="pf-hero__opgg nf-mono nf-caps nf-go" [href]="opgg(account.riotId)" target="_blank" rel="noopener">
                    Ver en OP.GG
                  </a>
                  <button nfButton variant="ghost" size="sm" [disabled]="riot.saving()" (click)="askUnlink()">
                    Desvincular
                  </button>
                </div>
              </div>
              @if (account.strength !== 'VERIFIED') {
                <!-- Mientras no esté verificada, se invita a demostrar la titularidad con la app. -->
                <div class="pf-riot pf-riot--empty">
                  <div class="pf-riot__cta">
                    <div class="pf-riot__ctatitle">Verifica que esta cuenta es tuya</div>
                    <p class="pf-riot__ctatext">
                      Con la app de escritorio confirmamos tu cuenta de verdad: te pedirá cambiar tu
                      icono de invocador un momento y lo comprobaremos con Riot. Hasta entonces, tus
                      estadísticas cuentan como no verificadas.
                    </p>
                  </div>
                  <button nfButton variant="accent" size="md" class="nf-go" (click)="openConnect()">
                    Conectar la app
                  </button>
                </div>
              }
            } @else {
              <div class="pf-riot pf-riot--empty">
                <div class="pf-riot__cta">
                  <div class="pf-riot__ctatitle">Sin cuenta de Riot vinculada</div>
                  <p class="pf-riot__ctatext">
                    Vincula tu cuenta para que tus estadísticas de invocador aparezcan en tu perfil.
                    @if (relinkAvailableAt(); as until) {
                      <br />
                      Desvinculaste hace poco: puedes volver a poner <strong>la misma</strong> cuando
                      quieras, pero para vincular una <strong>distinta</strong> tendrás que esperar
                      hasta el {{ until }}.
                    }
                  </p>
                </div>
                <div class="pf-riot__ctarow">
                  <!-- El camino fuerte primero: la app empareja y verifica. El manual, como rápido. -->
                  <button nfButton variant="accent" size="md" class="nf-go" (click)="openConnect()">
                    Conectar la app
                  </button>
                  <button nfButton variant="ghost" size="md" [disabled]="riot.saving()" (click)="startLinking()">
                    ＋ Escribir mi Riot ID
                  </button>
                </div>
              </div>
            }
          }
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
                (valueChange)="setRegion($event)"
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
            <button nfButton variant="primary" size="md" [disabled]="!canLink()" (click)="confirmLink()" class="nf-go">
              {{ riot.saving() ? 'Vinculando…' : 'Vincular' }}</button>
            <button nfButton variant="ghost" size="md" [disabled]="riot.saving()" (click)="cancelLinking()">
              Cancelar
            </button>
          </div>
        </nf-modal>
      }

      <!-- Desvincular: acción destructiva, siempre confirmada -->
      @if (unlinking(); as account) {
        <nf-modal title="desvincular_riot.exe" accent="pink" width="440px" (closed)="cancelUnlink()">
          <div class="settings-eyebrow nf-mono nf-eyebrow">Desvincular cuenta de Riot</div>

          <!-- Lo que NO se pierde importa tanto como lo que sí: nada del histórico cuelga de la
               cuenta de Riot, así que conviene decirlo antes de que el usuario se lo pregunte. -->
          <p class="confirm__text">
            Vas a desvincular <strong>{{ account.riotId }}</strong> de tu perfil. Dejaremos de
            mostrar tus estadísticas de invocador. Tus partidas, tu rating y tus grupos
            <strong>no se tocan</strong>: cuelgan de tu cuenta, no de la de Riot.
          </p>
          <p class="confirm__text">
            Podrás volver a vincular <strong>esta misma</strong> cuenta cuando quieras; para
            vincular una <strong>distinta</strong> tendrás que esperar 24 horas.
          </p>

          <div class="form-foot">
            <button nfButton variant="danger" size="md" [disabled]="riot.saving()" (click)="confirmUnlink()">
              {{ riot.saving() ? 'Desvinculando…' : 'Sí, desvincular' }}
            </button>
            <button nfButton variant="ghost" size="md" [disabled]="riot.saving()" (click)="cancelUnlink()">
              Cancelar
            </button>
          </div>
        </nf-modal>
      }

      <!-- Conectar la app de escritorio: el deep-link es la vía cómoda; el código, el plan B -->
      @if (connecting()) {
        <nf-modal title="conectar_app.exe" accent="cyan" width="460px" (closed)="closeConnect()">
          <div class="settings-eyebrow nf-mono nf-eyebrow">Conectar la app de escritorio</div>

          <p class="riot-link__text">
            La app empareja tu cuenta y la verifica de verdad: te pedirá cambiar tu icono de invocador
            un momento y lo comprobaremos con Riot.
          </p>

          <!-- Vía cómoda: deep-link. La conduce la app, no la web. -->
          <ol class="connect-steps">
            <li>Abre la app de escritorio y pulsa <strong>«Conectar»</strong>.</li>
            <li>Se abrirá tu navegador; como ya estás dentro, autorizas de un clic.</li>
          </ol>

          <!-- Plan B: el código, para cuando el navegador no se abre. -->
          <div class="connect-fallback">
            <div class="settings-eyebrow nf-mono nf-eyebrow nf-eyebrow--lower">¿No se abre el navegador?</div>
            <p class="riot-link__text">Pega este código en la app:</p>

            @if (pairingCode(); as pc) {
              <div class="connect-code" [class.is-expired]="codeExpired()">
                <span class="connect-code__value nf-mono">{{ pc.code }}</span>
                <button nfButton variant="ghost" size="sm" (click)="copyCode(pc.code)">
                  {{ copied() ? 'Copiado' : 'Copiar' }}
                </button>
              </div>
              @if (codeExpired()) {
                <p class="connect-code__hint nf-mono">Caducado. Genera otro para volver a intentarlo.</p>
              } @else {
                <p class="connect-code__hint nf-mono">Caduca en {{ codeCountdown() }}</p>
              }
              <button nfButton variant="ghost" size="sm" [disabled]="riot.generatingCode()" (click)="generateCode()">
                {{ riot.generatingCode() ? 'Generando…' : 'Generar otro' }}
              </button>
            } @else {
              <button nfButton variant="primary" size="md" [disabled]="riot.generatingCode()" (click)="generateCode()">
                {{ riot.generatingCode() ? 'Generando…' : 'Generar código' }}
              </button>
            }
          </div>

          <p class="connect-get nf-mono">
            ¿No tienes la app?
            <a [href]="desktopAppUrl" target="_blank" rel="noopener">Descárgala aquí</a>.
          </p>

          <div class="form-foot">
            <button nfButton variant="ghost" size="md" (click)="closeConnect()">Cerrar</button>
          </div>
        </nf-modal>
      }
    </div>
  `,
  styles: [
    `
      .connect-steps {
        margin: 12px 0 18px;
        padding-left: 20px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: var(--fs-body);
        color: var(--nf-text-mid);
      }
      .connect-fallback {
        padding: 14px;
        border: var(--bw-1) solid var(--nf-border);
        border-radius: var(--nf-radius);
        background: var(--nf-surface-2);
      }
      .connect-code {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin: 8px 0 4px;
        padding: 10px 14px;
        border: var(--bw-1) solid var(--nf-border-strong);
        border-radius: var(--nf-radius-sm);
        background: var(--nf-surface);
      }
      .connect-code.is-expired .connect-code__value {
        opacity: 0.5;
        text-decoration: line-through;
      }
      .connect-code__value {
        font-size: 22px;
        font-weight: var(--fw-bold);
        letter-spacing: 3px;
      }
      .connect-code__hint {
        font-size: 12px;
        color: var(--nf-text-mid);
        margin: 0 0 10px;
      }
      .connect-get {
        margin-top: 14px;
        font-size: 12px;
        color: var(--nf-text-mid);
      }
      .connect-get a {
        color: var(--nf-cyan);
      }
    `,
  ],
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
  private readonly destroyRef = inject(DestroyRef);

  protected readonly roleTiles: RoleTile[] = [
    { role: 'TOP', short: 'TOP', name: 'Top', glyph: '◤' },
    { role: 'JUNGLA', short: 'JG', name: 'Jungla', glyph: '♣' },
    { role: 'MID', short: 'MID', name: 'Mid', glyph: '◈' },
    { role: 'ADC', short: 'ADC', name: 'ADC', glyph: '➤' },
    { role: 'SUPPORT', short: 'SUP', name: 'Support', glyph: '✚' },
  ];

  constructor() {
    // Idempotentes y deduplicadas: si otra vista ya las pidió, no hay petición extra.
    this.prefs.ensureLoaded();
    this.riot.ensureLoaded();
    // El temporizador de la cuenta atrás no debe sobrevivir a la vista.
    this.destroyRef.onDestroy(() => this.stopTick());
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

  // ── Cuenta de Riot vinculada ──────────────────────────────────────
  /**
   * Estado real del servidor. La vinculación es **declarativa**: el backend comprueba que el
   * Riot ID tiene forma válida y que no lo tiene ya otro usuario, pero no que sea tuyo — eso
   * solo lo demuestra RSO (el OAuth de Riot), de ahí el aviso del diálogo.
   */
  protected readonly riot = inject(RiotAccountStore);

  readonly linking = signal(false);
  /** Cuenta pendiente de confirmar su desvinculación (null = sin diálogo abierto). */
  readonly unlinking = signal<RiotAccount | null>(null);
  readonly riotIdDraft = signal('');
  readonly regionDraft = signal<RiotRegion>('EUW');
  readonly regions = [...RIOT_REGIONS];

  /**
   * Descarga de la app de escritorio (empareja y verifica la cuenta, y en el futuro sube customs).
   * TODO(backend): apuntar a la release real cuando exista; hoy es el repositorio del scraper.
   */
  protected readonly desktopAppUrl = 'https://github.com/fernandezcrazydev/cgc-scraper/releases';

  /** Riot ID con forma de `Nombre#TAG`; el backend es quien valida de verdad los límites. */
  readonly linkValid = computed(() => /^.+#.+$/.test(this.riotIdDraft().trim()));
  readonly canLink = computed(() => this.linkValid() && !this.riot.saving());

  /** Cuándo se levanta el cooldown, ya formateado; null si no hay ninguno vivo. */
  readonly relinkAvailableAt = computed(() => {
    const iso = this.riot.relinkAvailableAt();
    return iso ? RELINK_FMT.format(new Date(iso)) : null;
  });

  /** Un fallo de red no deja el bloque muerto: el store vuelve a intentarlo desde cero. */
  retryRiot(): void {
    this.riot.reload();
  }

  /** `nf-select` emite `string`; aquí se estrecha al enum en vez de repartir `$any` por la vista. */
  setRegion(value: string): void {
    if ((RIOT_REGIONS as readonly string[]).includes(value)) this.regionDraft.set(value as RiotRegion);
  }

  startLinking(): void {
    this.riotIdDraft.set('');
    this.regionDraft.set(this.riot.account()?.region ?? 'EUW');
    this.linking.set(true);
  }

  cancelLinking(): void {
    if (this.riot.saving()) return;
    this.linking.set(false);
  }

  /**
   * Escritura pesimista: el diálogo no se cierra hasta que el servidor confirma. Si rechaza
   * (la cuenta ya la tiene otro, cooldown vivo, Riot ID inválido) el borrador sobrevive para
   * corregirlo, y el motivo sale del `code` del ProblemDetail — nunca de un texto fijo.
   */
  async confirmLink(): Promise<void> {
    if (!this.canLink()) return;
    try {
      const ok = await this.riot.link({
        riotId: this.riotIdDraft().trim(),
        region: this.regionDraft(),
      });
      if (!ok) return;
      this.linking.set(false);
      this.toast.success('Cuenta de Riot vinculada.');
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  /** Desvincular es destructivo: no se ejecuta sin pasar por el diálogo. */
  askUnlink(): void {
    this.unlinking.set(this.riot.account());
  }

  cancelUnlink(): void {
    if (this.riot.saving()) return;
    this.unlinking.set(null);
  }

  /**
   * No hay nada que refrescar más allá de este bloque: ninguna partida, rating ni estadística
   * cuelga de la cuenta de Riot — todas anclan en el usuario. Lo que deja de funcionar es solo
   * lo que la necesita de aquí en adelante (resolver un import por `puuid`, sembrar un rating
   * que aún no existe).
   */
  async confirmUnlink(): Promise<void> {
    try {
      const ok = await this.riot.unlink();
      if (!ok) return;
      this.unlinking.set(null);
      this.linking.set(false);
      this.toast.success('Cuenta de Riot desvinculada.');
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  // ── Conectar la app (deep-link + código de emparejamiento) ─────────
  /** Modal de "Conectar la app" abierto. */
  readonly connecting = signal(false);
  /**
   * Código que se está enseñando. Estado de UI **efímero**: es una credencial de un solo uso, así
   * que vive aquí, en la vista, mientras el modal está abierto — nunca en el store compartido.
   */
  readonly pairingCode = signal<PairingCode | null>(null);
  /** "Copiado" transitorio tras pulsar copiar. */
  readonly copied = signal(false);

  /** Reloj para la cuenta atrás; solo corre con el modal abierto (se limpia al cerrar y al destruir). */
  private readonly now = signal(Date.now());
  private tick: ReturnType<typeof setInterval> | null = null;

  private readonly codeRemainingMs = computed(() => {
    const pc = this.pairingCode();
    if (!pc) return 0;
    return Math.max(0, new Date(pc.expiresAt).getTime() - this.now());
  });
  readonly codeExpired = computed(() => this.pairingCode() !== null && this.codeRemainingMs() === 0);
  /** "m:ss" para la cuenta atrás. */
  readonly codeCountdown = computed(() => {
    const total = Math.floor(this.codeRemainingMs() / 1000);
    const seconds = total % 60;
    return `${Math.floor(total / 60)}:${seconds.toString().padStart(2, '0')}`;
  });

  openConnect(): void {
    this.pairingCode.set(null);
    this.copied.set(false);
    this.connecting.set(true);
    this.startTick();
  }

  closeConnect(): void {
    this.connecting.set(false);
    this.pairingCode.set(null);
    this.stopTick();
  }

  /**
   * Emite un código nuevo (invalida el anterior). Pesimista y no reentrante: el botón queda
   * deshabilitado mientras vuela (`riot.generatingCode()`). El código no se cachea en el store —
   * es una credencial— y un fallo se traduce con `errorMessage`.
   */
  async generateCode(): Promise<void> {
    if (this.riot.generatingCode()) return;
    try {
      const code = await this.riot.requestPairingCode();
      if (!code) return;
      this.copied.set(false);
      this.now.set(Date.now());
      this.pairingCode.set(code);
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard?.writeText(code);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Sin API de portapapeles o sin permiso: el código está a la vista para copiarlo a mano.
    }
  }

  private startTick(): void {
    this.stopTick();
    this.now.set(Date.now());
    this.tick = setInterval(() => this.now.set(Date.now()), 1000);
  }

  private stopTick(): void {
    if (this.tick !== null) {
      clearInterval(this.tick);
      this.tick = null;
    }
  }

  /** Avatar radial gradient from a hue, matching the roster/ranking look. */
  grad(hue: number): string {
    return `radial-gradient(circle at 32% 26%, hsl(${hue},90%,64%), hsl(${hue},78%,30%))`;
  }

  opgg(tag: string): string {
    return opggUrl(tag);
  }
}
