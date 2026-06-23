import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfBadge, NfButton, NfWindow } from '../../../ui';
import { GroupStore } from '../../../core/group-store';

const MEMBER_POOL = [
  'Pix3lQueen', 'Cr1msonByte', 'D4rkFl4me', 'V0idWalker', 'NeonRift',
  'GlitchKid', 'St0rmcaller', 'HexHunter', 'AshenWolf', 'LumeCore',
  'Zer0Cool', 'ByteSiren',
];

interface Member {
  name: string;
  initials: string;
  role: string;
  owner: boolean;
  hue: number;
}

@Component({
  selector: 'app-grupo-detalle',
  standalone: true,
  imports: [RouterLink, NfBadge, NfButton, NfWindow],
  template: `
    <div class="view">
      @if (group(); as g) {
        <div class="group-hero" [style.--grp-c1]="g.c1" [style.--grp-c2]="g.c2">
          <span class="group-hero__avatar">{{ g.initials }}</span>
          <div class="group-hero__meta">
            <div class="group-hero__tag nf-mono">{{ g.tag }}</div>
            <h1 class="group-hero__name">{{ g.name }}</h1>
            <div class="group-hero__badges">
              <nf-badge [color]="g.role === 'OWNER' ? 'pink' : 'cyan'">{{ g.role }}</nf-badge>
              <span class="group-hero__count nf-mono">◉ {{ g.members }} MIEMBROS</span>
            </div>
          </div>
        </div>

        <div class="actions">
          <button nfButton variant="primary" size="md" [routerLink]="['/app', 'inicio']">CREAR PARTIDA ►</button>
          <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos', g.id, 'ranking']">RANKING</button>
          <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos', g.id, 'estadisticas']">ESTADÍSTICAS</button>
          <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos', g.id, 'historial']">HISTORIAL</button>
          <button nfButton variant="ghost" size="md" [routerLink]="['/app', 'grupos']">← TODOS LOS GRUPOS</button>
        </div>

        <div class="view__label nf-mono">▸ MIEMBROS</div>
        <nf-window title="miembros.exe" accent="cyan" bodyPadding="0">
          <div class="members">
            @for (m of members(); track m.name) {
              <div class="member">
                <div
                  class="member__avatar"
                  [style.background]="'radial-gradient(circle at 32% 26%, hsl(' + m.hue + ',90%,64%), hsl(' + m.hue + ',78%,30%))'"
                >{{ m.initials }}</div>
                <div class="member__meta">
                  <div class="member__name nf-mono">{{ m.name }}</div>
                  <div class="member__role nf-mono">{{ m.role }}</div>
                </div>
                @if (m.owner) {
                  <nf-badge color="pink">OWNER</nf-badge>
                }
              </div>
            }
          </div>
        </nf-window>
      } @else {
        <div class="view__head">
          <div class="view__eyebrow nf-mono">// ERROR 404</div>
          <h1 class="view__title">Grupo no encontrado</h1>
          <p class="view__lead">El grupo que buscas no existe o ya no perteneces a él.</p>
        </div>
        <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos']">← VOLVER A GRUPOS</button>
      }
    </div>
  `,
  styleUrl: './views.scss',
})
export class GrupoDetalle {
  private readonly route = inject(ActivatedRoute);
  readonly groups = inject(GroupStore);

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  readonly group = computed(() => {
    const id = this.id();
    return id ? this.groups.byId(id) ?? null : null;
  });

  /** Deterministic mock roster sized to the group's member count. */
  readonly members = computed<Member[]>(() => {
    const g = this.group();
    if (!g) return [];
    const roles = ['CAPITÁN', 'TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT', 'SUPLENTE'];
    return Array.from({ length: g.members }, (_, i) => {
      const name = MEMBER_POOL[i % MEMBER_POOL.length];
      return {
        name,
        initials: name.slice(0, 2).toUpperCase(),
        role: i === 0 ? 'CAPITÁN · ' + g.role : roles[i % roles.length],
        owner: i === 0,
        hue: (i * 47) % 360,
      };
    });
  });

  constructor() {
    // Keep the shell header/sidebar in sync on deep-link or when switching groups.
    effect(() => {
      const id = this.id();
      if (id && this.groups.byId(id)) {
        this.groups.select(id);
      }
    });
  }
}
