import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  NfAvatar,
  NfAvatarPicker,
  NfBadge,
  NfButton,
  NfSelect,
  NfSkeleton,
  NfTypeahead,
  NfWindow,
} from '../../../ui';
import {
  CreateGroupInput,
  GroupSearchResult,
  GroupsSearchStore,
  GroupsStore,
  GroupView,
  JoinRequestResponse,
  JoinRequestsStore,
  MATCHMAKING_PRESETS,
  MATCHMAKING_PRESET_INFO,
  MatchmakingPreset,
  REGIONS,
  Region,
  groupRoleLabel,
  initialsOf,
} from '../../../core/groups';
import { ToastService } from '../../../core/toast';
import { errorMessage } from '../../../core/http';

@Component({
  selector: 'app-grupos',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    NfAvatarPicker,
    NfBadge,
    NfButton,
    NfSelect,
    NfSkeleton,
    NfTypeahead,
    NfWindow,
  ],
  template: `
    <div class="view grupos-view">
      <!-- Layout Asimétrico 70% / 30% -->
      <div class="grupos-layout">
        <!-- Columna Izquierda (70%): Mis Grupos -->
        <section class="grupos-main" aria-label="Mis Grupos">

          @switch (groups.status()) {
            @case ('loading') {
              <div class="my-groups-grid" aria-busy="true">
                @for (s of [0, 1, 2]; track s) {
                  <div class="grp-card" aria-hidden="true">
                    <div class="grp-card__head">
                      <nf-skeleton width="48px" height="48px" radius="14px" />
                      <div class="grp-card__meta">
                        <nf-skeleton width="140px" height="18px" />
                        <nf-skeleton width="90px" height="12px" />
                      </div>
                    </div>
                    <div class="grp-card__body">
                      <nf-skeleton width="100%" height="32px" radius="8px" />
                      <nf-skeleton width="100%" height="32px" radius="8px" />
                    </div>
                  </div>
                }
              </div>
            }
            @case ('error') {
              <div class="empty-state">
                <div class="empty-state__icon">⚠️</div>
                <div class="empty-state__text nf-mono">Error al cargar</div>
                <p class="empty-state__hint">No se pudieron cargar tus grupos.</p>
                <button nfButton variant="secondary" size="md" (click)="retry()">Reintentar</button>
              </div>
            }
            @default {
              @if (groups.groups().length === 0) {
                <div class="empty-state">
                  <div class="empty-state__icon">🛡️</div>
                  <div class="empty-state__text nf-mono">Sin grupos todavía</div>
                  <p class="empty-state__hint">
                    Crea tu primer grupo para organizar partidas o busca comunidades existentes por #TAG.
                  </p>
                  <button nfButton variant="primary" size="md" (click)="openCreate()">＋ Crear primer grupo</button>
                </div>
              } @else {
                <div class="my-groups-grid">
                  @for (g of groups.groups(); track g.id) {
                    <article
                      class="grp-card"
                      [class.is-active]="g.id === groups.selectedId()"
                      [style.--grp-c1]="g.c1"
                      [style.--grp-c2]="g.c2"
                      (click)="goToGroup(g.id)"
                      [title]="'Ir al panel de ' + g.name"
                      tabindex="0"
                      role="link"
                      (keydown.enter)="goToGroup(g.id)"
                    >
                      <!-- Cabecera de la tarjeta -->
                      <div class="grp-card__head">
                        <div class="grp-card__avatar-wrap">
                          <span class="grp-card__avatar">
                            @if (g.avatarUrl) {
                              <img class="grp-card__avatar-img" [src]="g.avatarUrl" alt="" />
                            } @else {
                              {{ g.initials }}
                            }
                          </span>
                        </div>
                        <div class="grp-card__meta">
                          <div class="grp-card__title-line">
                            <span class="grp-card__name">
                              {{ g.name }}
                            </span>
                          </div>
                          <div class="grp-card__subline nf-mono">
                            <span class="grp-card__tag">#{{ g.tag || g.region || 'TAG' }}</span>
                            <span class="grp-card__sep">·</span>
                            <span class="grp-card__region">{{ g.region ?? 'EUW' }}</span>
                            <span class="grp-card__sep">·</span>
                            <span class="grp-card__members">◉ {{ memberCountOf(g.id, g.name) }} miembros</span>
                          </div>
                        </div>
                        <nf-badge [color]="g.role === 'OWNER' ? 'primary' : 'secondary'">
                          {{ roleLabel(g.role) }}
                        </nf-badge>
                      </div>

                      <!-- Cuerpo de la tarjeta con estado competitivo y sala en directo -->
                      <div class="grp-card__body">
                        <!-- Estado competitivo / Liga (botón hacia ranking) -->
                        <a
                          class="grp-card__badge-box grp-card__badge-box--btn"
                          [routerLink]="['/app', 'grupos', g.id, 'ranking']"
                          (click)="$event.stopPropagation()"
                          title="Ver clasificación del grupo"
                        >
                          <span class="grp-card__badge-icon">🏆</span>
                          <div class="grp-card__badge-text">
                            <span class="grp-card__badge-label nf-mono">Tu clasificación</span>
                            <div class="grp-card__rank-line">
                              <span class="grp-card__badge-val nf-mono">{{ rankSummaryOf(g.id, g.name) }}</span>
                              @if (streakOf(g.id, g.name); as st) {
                                <span
                                  class="grp-streak-badge nf-mono"
                                  [class.grp-streak-badge--loss]="st.type === 'LOSS'"
                                  [title]="st.type === 'WIN' ? 'Racha de ' + st.count + ' victorias consecutivas' : 'Racha de ' + st.count + ' derrotas'"
                                >
                                  {{ st.type === 'WIN' ? '🔥' : '❄️' }} {{ st.count }}{{ st.type === 'WIN' ? 'V' : 'D' }}
                                </span>
                              }
                            </div>
                          </div>
                        </a>

                        <!-- Convocatoria / Sala en vivo (con hover dinámico Unirme a la sala / Crear sala) -->
                        <a
                          class="grp-card__badge-box grp-card__badge-box--btn grp-card__badge-box--lobby"
                          [class.is-live]="hasActiveLobby(g.id, g.name)"
                          [routerLink]="hasActiveLobby(g.id, g.name) ? ['/app', 'grupos', g.id, 'partidas', lobbyIdOf(g.id, g.name)] : ['/app', 'grupos', g.id, 'crear-partida']"
                          (click)="$event.stopPropagation()"
                          [title]="hasActiveLobby(g.id, g.name) ? 'Unirse a la sala en directo' : 'Convocar o crear nueva sala'"
                        >
                          <div class="grp-card__icon-wrap">
                            @if (hasActiveLobby(g.id, g.name)) {
                              <span class="grp-card__pulse-dot" aria-hidden="true"></span>
                            }
                            <span class="grp-card__badge-icon">{{ hasActiveLobby(g.id, g.name) ? '⚡' : '💤' }}</span>
                          </div>
                          <div class="grp-card__badge-text">
                            <div class="grp-card__lobby-default">
                              <span class="grp-card__badge-label nf-mono">Convocatoria en directo</span>
                              @if (hasActiveLobby(g.id, g.name)) {
                                <span class="grp-card__badge-val grp-card__badge-val--live nf-mono">
                                  Sala abierta · {{ lobbySlotsOf(g.id, g.name) }}
                                </span>
                              } @else {
                                <span class="grp-card__badge-val nf-mono">Sin sala activa</span>
                              }
                            </div>
                            <div class="grp-card__lobby-hover">
                              <span class="grp-card__badge-label nf-mono">{{ hasActiveLobby(g.id, g.name) ? 'Sala abierta' : 'Nueva convocatoria' }}</span>
                              <span class="grp-card__badge-val nf-mono" [class.grp-card__badge-val--live]="hasActiveLobby(g.id, g.name)">
                                {{ hasActiveLobby(g.id, g.name) ? 'Unirme a la sala' : '＋ Crear sala' }}
                              </span>
                            </div>
                          </div>
                        </a>
                      </div>
                    </article>
                  }

                  <!-- Tarjeta de Creación de Nuevo Grupo (mismo tamaño y formato en rejilla) -->
                  <button
                    type="button"
                    class="grp-card grp-card--create"
                    (click)="openCreate()"
                    title="Crear un nuevo grupo"
                  >
                    <div class="grp-card__create-inner">
                      <div class="grp-card__create-icon-wrap">
                        <span class="grp-card__create-icon">＋</span>
                      </div>
                      <div class="grp-card__create-text">
                        <span class="grp-card__create-title">Crear nuevo grupo</span>
                        <span class="grp-card__create-sub nf-mono">Funda una comunidad o escuadrón</span>
                      </div>
                    </div>
                  </button>
                </div>
              }
            }
          }
        </section>

        <!-- Columna Derecha (30%): Búsqueda #TAG y Solicitudes -->
        <aside class="grupos-sidebar" aria-label="Búsqueda de grupos y solicitudes">
          <!-- Widget 1: Buscador #TAG -->
          <div class="grp-widget">
            <h2 class="grp-widget__title">Buscar Grupos</h2>

            <div class="grp-widget__search">
              <nf-typeahead
                placeholder="Buscar por Nombre#TAG (ej. SoloQ#EUW)..."
                ariaLabel="Buscar grupo por tag o nombre"
                [loading]="groupsSearch.searching()"
                [suggestions]="groupsSearch.searchResults()"
                (queryChange)="onSearchQuery($event)"
                (selectOption)="onSelectSearchResult($event)"
              >
                <ng-template let-item>
                  <div class="grp-search-item">
                    <div class="grp-search-item__info">
                      <span class="grp-search-item__name">
                        {{ item.name }}
                        <span class="grp-search-item__tag nf-mono">#{{ item.tag }}</span>
                      </span>
                      <span class="grp-search-item__meta nf-mono">
                        {{ item.region }} · {{ item.memberCount }} miembros
                      </span>
                    </div>

                    <div class="grp-search-item__actions" (click)="$event.stopPropagation()">
                      @if (item.isMember) {
                        <span class="grp-tag-badge grp-tag-badge--member nf-mono">Miembro</span>
                      } @else if (item.joinRequestStatus === 'PENDING') {
                        <span class="grp-tag-badge grp-tag-badge--pending nf-mono">⏳ Enviada</span>
                      } @else {
                        <button
                          type="button"
                          class="grp-btn-join nf-mono"
                          [disabled]="joinRequests.pending()"
                          (click)="sendJoinRequest(item); $event.stopPropagation()"
                        >
                          Solicitar
                        </button>
                      }
                    </div>
                  </div>
                </ng-template>
              </nf-typeahead>
            </div>
          </div>

          <!-- Widget 2: Tus Solicitudes Enviadas (máximo 2 visibles + modal para ver todas) -->
          <div class="grp-widget">
            <div class="grp-widget__head-row">
              <h2 class="grp-widget__title">Tus Solicitudes</h2>
              @if (joinRequests.pendingMyRequestsCount() > 0) {
                <span class="grp-widget__badge nf-mono">
                  {{ joinRequests.pendingMyRequestsCount() }}
                </span>
              }
            </div>

            <div class="grp-requests-list">
              @for (req of displayedRequests(); track req.id) {
                <div
                  class="grp-req-card"
                  role="button"
                  tabindex="0"
                  (click)="goToGroup(req.groupId)"
                  (keydown.enter)="goToGroup(req.groupId)"
                  [title]="'Ver panel de ' + req.groupName + '#' + req.groupTag"
                >
                  <div class="grp-req-card__info">
                    <span class="grp-req-card__name">
                      {{ req.groupName }}
                      <span class="grp-req-card__tag nf-mono">#{{ req.groupTag }}</span>
                    </span>
                    <span class="grp-req-card__status nf-mono">
                      ⏳ Pendiente de revisión
                    </span>
                  </div>
                  <button
                    type="button"
                    class="grp-req-card__cancel-btn nf-mono"
                    [disabled]="joinRequests.pending()"
                    (click)="cancelRequest(req.id); $event.stopPropagation()"
                    title="Cancelar solicitud de ingreso"
                  >
                    Cancelar
                  </button>
                </div>
              } @empty {
                <p class="grp-widget__empty nf-mono">
                  No tienes solicitudes de ingreso pendientes.
                </p>
              }
            </div>

            @if (joinRequests.myRequests().length > 2) {
              <button
                type="button"
                class="grp-widget__more-btn nf-mono"
                (click)="openAllRequestsModal()"
              >
                Ver todas ({{ joinRequests.myRequests().length }})
              </button>
            }
          </div>

          <!-- Widget 3: Comunidades Destacadas (máx 3 con botón de refresh rotativo) -->
          <div class="grp-widget">
            <div class="grp-widget__head-row">
              <h2 class="grp-widget__title">Comunidades Destacadas</h2>
              <button
                type="button"
                class="grp-widget__refresh-btn"
                [class.is-rotating]="isRefreshingSuggested()"
                (click)="refreshSuggested()"
                title="Mostrar otras 3 comunidades destacadas"
                aria-label="Refrescar comunidades destacadas"
              >
                ↻
              </button>
            </div>

            <div class="grp-suggested-list">
              @for (item of displayedSuggested(); track item.id) {
                <div
                  class="grp-sugg-card"
                  role="button"
                  tabindex="0"
                  (click)="viewGroupProfile(item)"
                  (keydown.enter)="viewGroupProfile(item)"
                  [title]="'Ver perfil y detalles de ' + item.name + '#' + item.tag"
                >
                  <div class="grp-sugg-card__info">
                    <span class="grp-sugg-card__name">
                      {{ item.name }}
                      <span class="grp-sugg-card__tag nf-mono">#{{ item.tag }}</span>
                    </span>
                    <span class="grp-sugg-card__meta nf-mono">
                      {{ item.region }} · {{ item.memberCount }} miembros
                    </span>
                  </div>

                  <div class="grp-sugg-card__action" (click)="$event.stopPropagation()">
                    @if (item.isMember) {
                      <span class="grp-tag-badge grp-tag-badge--member nf-mono">Miembro</span>
                    } @else if (item.joinRequestStatus === 'PENDING') {
                      <span class="grp-tag-badge grp-tag-badge--pending nf-mono">⏳ Enviada</span>
                    } @else {
                      <button
                        type="button"
                        class="grp-btn-join nf-mono"
                        [disabled]="joinRequests.pending()"
                        (click)="sendJoinRequest(item); $event.stopPropagation()"
                      >
                        Unirse
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </aside>
      </div>
    </div>

    <!-- Modal de Creación de Grupo con #TAG -->
    @if (creating()) {
      <div class="modal-overlay" (click)="closeCreate()">
        <div class="modal" (click)="$event.stopPropagation()">
          <nf-window title="Nuevo grupo" bodyPadding="22px 22px 28px">
            <div class="settings-eyebrow nf-mono">Crear nuevo grupo</div>

            <div class="field" style="margin-bottom: 18px">
              <label class="field__label nf-mono">Foto del grupo</label>
              <nf-avatar-picker
                [value]="avatar()"
                [initials]="previewInitials()"
                (valueChange)="avatar.set($event)"
              />
            </div>

            <div class="form-grid">
              <div class="field">
                <label class="field__label nf-mono" for="group-name">Nombre del grupo</label>
                <input
                  id="group-name"
                  class="field__input"
                  type="text"
                  placeholder="LAN Challenger"
                  autocomplete="off"
                  [ngModel]="name()"
                  (ngModelChange)="name.set($event)"
                />
              </div>

              <div class="field">
                <label class="field__label nf-mono" for="group-tag">Tag del grupo (#TAG)</label>
                <div class="field__tag-wrap">
                  <span class="field__tag-prefix nf-mono">#</span>
                  <input
                    id="group-tag"
                    class="field__input field__input--tag nf-mono"
                    type="text"
                    maxlength="8"
                    placeholder="S14"
                    autocomplete="off"
                    [ngModel]="tag()"
                    (ngModelChange)="tag.set($event.toUpperCase())"
                  />
                </div>
                <p class="field__preview nf-mono">
                  Identificador público: <strong>{{ name() || 'Grupo' }}#{{ tag() || 'TAG' }}</strong>
                </p>
              </div>

              <div class="field">
                <label class="field__label nf-mono">Región</label>
                <nf-select [options]="regionOptions" [value]="region()" (valueChange)="setRegion($event)" />
              </div>

              <div class="field">
                <label class="field__label nf-mono">Algoritmo de matcheo</label>
                <nf-select [options]="presetOptions" [value]="preset()" (valueChange)="setPreset($event)" />
                <p class="field__hint">{{ presetDescription() }}</p>
                <p class="field__warning">
                  Se elige ahora y no se puede cambiar más adelante. Para usar otro habría que crear
                  un grupo nuevo.
                </p>
              </div>
            </div>

            <div class="form-foot">
              <button
                nfButton
                variant="primary"
                size="md"
                [disabled]="!canCreate() || groups.pending()"
                (click)="create()"
              >
                {{ groups.pending() ? 'Creando…' : 'Crear grupo' }}
              </button>
              <button nfButton variant="ghost" size="md" [disabled]="groups.pending()" (click)="closeCreate()">
                Cancelar
              </button>
            </div>
          </nf-window>
        </div>
      </div>
    }

    <!-- Modal de Todas las Solicitudes Enviadas -->
    @if (showAllRequestsModal()) {
      <div class="modal-overlay" (click)="closeAllRequestsModal()">
        <div class="modal modal--md" (click)="$event.stopPropagation()">
          <nf-window
            [title]="'Tus Solicitudes Enviadas (' + joinRequests.myRequests().length + ')'"
            bodyPadding="20px 22px 24px"
          >
            <div class="grp-modal-requests">
              <p class="grp-modal-requests__desc nf-mono">
                Solicitudes de ingreso que tienes en espera de revisión. Pulsa sobre cualquier grupo para consultar su panel.
              </p>

              <div class="grp-requests-list">
                @for (req of joinRequests.myRequests(); track req.id) {
                  <div
                    class="grp-req-card grp-req-card--modal"
                    role="button"
                    tabindex="0"
                    (click)="goToGroup(req.groupId); closeAllRequestsModal()"
                    (keydown.enter)="goToGroup(req.groupId); closeAllRequestsModal()"
                    [title]="'Ver panel de ' + req.groupName + '#' + req.groupTag"
                  >
                    <div class="grp-req-card__info">
                      <span class="grp-req-card__name">
                        {{ req.groupName }}
                        <span class="grp-req-card__tag nf-mono">#{{ req.groupTag }}</span>
                      </span>
                      <span class="grp-req-card__status nf-mono">
                        ⏳ Pendiente de revisión · Región {{ req.groupRegion }}
                      </span>
                    </div>
                    <button
                      type="button"
                      class="grp-req-card__cancel-btn nf-mono"
                      [disabled]="joinRequests.pending()"
                      (click)="cancelRequest(req.id); $event.stopPropagation()"
                      title="Cancelar solicitud de ingreso"
                    >
                      Cancelar
                    </button>
                  </div>
                } @empty {
                  <p class="grp-widget__empty nf-mono">
                    No tienes solicitudes de ingreso pendientes.
                  </p>
                }
              </div>

              <div class="form-foot" style="margin-top: 18px">
                <button nfButton variant="ghost" size="md" (click)="closeAllRequestsModal()">
                  Cerrar
                </button>
              </div>
            </div>
          </nf-window>
        </div>
      </div>
    }
  `,
  styleUrl: './grupos.scss',
})
export class Grupos {
  protected readonly roleLabel = groupRoleLabel;
  readonly groups = inject(GroupsStore);
  readonly groupsSearch = inject(GroupsSearchStore);
  readonly joinRequests = inject(JoinRequestsStore);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  readonly regionOptions = [...REGIONS];

  readonly presetOptions = MATCHMAKING_PRESETS.map((preset) => ({
    value: preset,
    label: MATCHMAKING_PRESET_INFO[preset].label,
  }));

  readonly creating = signal(false);
  readonly showAllRequestsModal = signal(false);
  readonly displayedRequests = computed(() => this.joinRequests.myRequests().slice(0, 2));

  readonly suggestedOffset = signal(0);
  readonly isRefreshingSuggested = signal(false);
  readonly displayedSuggested = computed<GroupSearchResult[]>(() => {
    const list = this.groupsSearch.suggested();
    if (list.length === 0) return [];
    const offset = this.suggestedOffset() % list.length;
    const res: GroupSearchResult[] = [];
    for (let i = 0; i < 3 && i < list.length; i++) {
      res.push(list[(offset + i) % list.length]);
    }
    return res;
  });

  readonly name = signal('');
  readonly tag = signal('');
  readonly region = signal<Region>('EUW');
  readonly preset = signal<MatchmakingPreset>('BALANCED');
  readonly avatar = signal<string | null>(null);

  readonly presetDescription = computed(() => MATCHMAKING_PRESET_INFO[this.preset()].description);
  readonly canCreate = computed(() => this.name().trim().length > 0 && this.tag().trim().length >= 2);

  readonly previewInitials = computed(() => initialsOf(this.name() || 'GR'));

  constructor() {
    void this.groups.reload();
    void this.joinRequests.loadMyRequests();
  }

  openAllRequestsModal(): void {
    this.showAllRequestsModal.set(true);
  }

  closeAllRequestsModal(): void {
    this.showAllRequestsModal.set(false);
  }

  refreshSuggested(): void {
    this.isRefreshingSuggested.set(true);
    this.suggestedOffset.update((o) => o + 3);
    setTimeout(() => this.isRefreshingSuggested.set(false), 350);
  }

  retry(): void {
    void this.groups.reload();
  }

  setRegion(value: string): void {
    this.region.set(value as Region);
  }

  setPreset(value: string): void {
    this.preset.set(value as MatchmakingPreset);
  }

  openCreate(): void {
    this.name.set('');
    this.tag.set('S1');
    this.region.set('EUW');
    this.preset.set('BALANCED');
    this.avatar.set(null);
    this.creating.set(true);
  }

  closeCreate(): void {
    if (this.groups.pending()) return;
    this.creating.set(false);
  }

  onSearchQuery(q: string): void {
    void this.groupsSearch.search(q);
  }

  onSelectSearchResult(item: GroupSearchResult): void {
    if (item.isMember) {
      this.router.navigate(['/app', 'grupos', item.id]);
    } else {
      void this.sendJoinRequest(item);
    }
  }

  async sendJoinRequest(item: GroupSearchResult): Promise<void> {
    await this.joinRequests.sendJoinRequest(item);
  }

  async cancelRequest(requestId: string): Promise<void> {
    await this.joinRequests.cancelJoinRequest(requestId);
  }

  viewGroupProfile(item: GroupSearchResult): void {
    void this.router.navigate(['/app', 'grupos', item.id]);
  }

  goToGroup(groupId: string): void {
    this.groups.select(groupId);
    void this.router.navigate(['/app', 'grupos', groupId]);
  }

  /** Helpers deterministas para métricas de tarjeta */
  memberCountOf(groupId: string, name = ''): number {
    const n = name.toLowerCase();
    if (groupId === 'lan-challenger' || n.includes('lan')) return 23;
    if (groupId.includes('chiringuito') || groupId.includes('chatarra') || n.includes('chiringuito') || n.includes('chatarra')) return 14;
    if (n.includes('escuadron')) return 18;
    if (n === 'kn') return 8;
    return 10;
  }

  rankSummaryOf(groupId: string, name = ''): string {
    const n = name.toLowerCase();
    if (groupId === 'lan-challenger' || n.includes('lan')) return '2.º puesto · 73 LP';
    if (groupId.includes('chiringuito') || groupId.includes('chatarra') || n.includes('chiringuito') || n.includes('chatarra')) return '1.º puesto · 92 LP';
    if (n.includes('escuadron')) return '1.º puesto · 110 LP';
    if (n === 'kn') return '4.º puesto · 28 LP';
    return '3.º puesto · 45 LP';
  }

  streakOf(groupId: string, name = ''): { count: number; type: 'WIN' | 'LOSS' } | null {
    const n = name.toLowerCase();
    if (groupId === 'lan-challenger' || n.includes('lan')) return { count: 3, type: 'WIN' };
    if (groupId.includes('chiringuito') || groupId.includes('chatarra') || n.includes('chiringuito') || n.includes('chatarra')) return { count: 3, type: 'WIN' };
    if (n.includes('escuadron')) return { count: 5, type: 'WIN' };
    if (n === 'kn') return { count: 2, type: 'LOSS' };
    return null;
  }

  hasActiveLobby(groupId: string, name = ''): boolean {
    const n = name.toLowerCase();
    return groupId === 'lan-challenger' || groupId.toLowerCase().includes('lan') || n.includes('lan') || n === 'lan';
  }

  lobbySlotsOf(groupId: string, name = ''): string {
    return '8/10 apuntados';
  }

  lobbyIdOf(groupId: string, name = ''): string {
    return 'ZZTEST';
  }

  async create(): Promise<void> {
    if (!this.canCreate() || this.groups.pending()) return;
    try {
      const group = await this.groups.create({
        name: this.name(),
        tag: this.tag(),
        region: this.region(),
        matchmakingPreset: this.preset(),
        avatarDataUrl: this.avatar(),
      });
      this.creating.set(false);
      this.toasts.success(`Grupo "${group.name}" creado con éxito`);
      this.router.navigate(['/app', 'grupos', group.groupId]);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }
}
