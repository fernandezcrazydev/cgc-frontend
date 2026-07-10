import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { NfWindow, NfSegmented, NfButton, NfSelect } from '../../../ui';
import { ThemeService, THEMES } from '../../../core/theme';
import { Session } from '../../../core/auth';
import { CURRENT_USER } from '../../../core/lobby';
import { GroupStore } from '../../../core/group-store';
import { opggUrl } from '../../../core/member-detail';
import { buildPlayerProfile } from '../../../core/player-profile';

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
  imports: [NfWindow, NfSegmented, NfButton, NfSelect],
  template: `
    <div class="view">
      <div class="view__head" style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">
        <div>
          <div class="view__eyebrow nf-mono">// PERFIL DE JUGADOR</div>
          <p class="view__lead">Tu trayectoria combinada en todas las customs que has jugado.</p>
        </div>
        <nf-segmented
          [options]="themeOptions"
          [value]="theme.theme()"
          (valueChange)="theme.set($event)"
          ariaLabel="Tema visual"
        />
      </div>

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
        <section class="pf-hero">
          <span class="pf-hero__avatar" [style.background]="grad(p.hue)">
            @if (showAvatarImage()) {
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
            <h1 class="pf-hero__name">{{ heroName() }}</h1>
            <div class="pf-hero__tag nf-mono">// IDENTIDAD DISCORD</div>
            <div class="pf-hero__meta nf-mono">
              <span class="pf-hero__chip">◈ {{ p.mainRole }}</span>
              <span class="pf-hero__chip">◆ {{ p.groupCount }} GRUPOS</span>
              <span class="pf-hero__chip">◷ DESDE {{ p.memberSince }}</span>
            </div>
          </div>

          <div class="pf-ring" [style.--wr]="p.wr" [class.pf-ring--lo]="p.wr < 50">
            <div class="pf-ring__inner">
              <div class="pf-ring__val nf-mono">{{ p.wr }}%</div>
              <div class="pf-ring__lbl nf-mono">WIN RATE</div>
            </div>
          </div>
        </section>

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
              <a class="pf-hero__opgg nf-mono" [href]="opgg(riot.riotId)" target="_blank" rel="noopener">
                VER EN OP.GG ►
              </a>
              <button nfButton variant="ghost" size="sm" (click)="unlink()">DESVINCULAR</button>
            </div>
          </div>
        } @else if (linking()) {
          <div class="pf-riot pf-riot--form">
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
            <div class="pf-riot__formfoot">
              <button nfButton variant="primary" size="sm" [disabled]="!linkValid()" (click)="confirmLink()">
                VINCULAR ►
              </button>
              <button nfButton variant="ghost" size="sm" (click)="cancelLinking()">CANCELAR</button>
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
              ＋ VINCULAR CUENTA DE RIOT
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
              <div class="empty-state__text nf-mono">// SIN GRUPOS TODAVÍA</div>
            </div>
          }
        </div>
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

  /** Selector de skin. El tema es estado de UI global (ThemeService). */
  protected readonly theme = inject(ThemeService);
  protected readonly themeOptions = THEMES.map((t) => ({ value: t.id, label: t.label }));

  readonly profile = computed(() =>
    buildPlayerProfile(this.user, this.groups.groups(), (id) => this.groups.rosterOf(id)),
  );

  /** Nombre del hero: el de Discord, con las estadísticas mock como reserva. */
  readonly heroName = computed(() => this.session.displayName() || this.profile()?.name || '');

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
    // BACKEND NOTE: aquí irá el POST de vinculación; el backend validará el Riot
    // ID contra la API de Riot y devolverá la cuenta canónica.
    this.riotAccount.set({ riotId: this.riotIdDraft().trim(), region: this.regionDraft() });
    this.linking.set(false);
  }

  unlink(): void {
    // BACKEND NOTE: DELETE de la vinculación; refetch de estadísticas derivadas.
    this.riotAccount.set(null);
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
