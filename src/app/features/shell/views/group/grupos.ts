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
} from '../../../../ui';
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
} from '../../../../core/groups';
import { ToastService } from '../../../../core/toast';
import { errorMessage } from '../../../../core/http';

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
  templateUrl: './grupos.html',
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
