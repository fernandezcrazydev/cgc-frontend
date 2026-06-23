import { Component, OnDestroy, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NfWindow } from '../../ui';

type LoginStatus = 'idle' | 'connecting' | 'success';

/**
 * NEXUS//FORGE — Login ("Login con Riot Games").
 * Port of Login.dc.html: Riot sign-in with idle → connecting → success flow,
 * a "continue as guest" path, over the vaporwave neon-sun + perspective-grid hero.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [NfWindow],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnDestroy {
  readonly status = signal<LoginStatus>('idle');
  readonly riotTag = 'N1ghtfang#LAN';

  readonly isIdle = computed(() => this.status() === 'idle');
  readonly isConnecting = computed(() => this.status() === 'connecting');
  readonly isSuccess = computed(() => this.status() === 'success');
  readonly isAuth = computed(() => this.status() === 'idle' || this.status() === 'connecting');

  private connectTimer?: ReturnType<typeof setTimeout>;
  private enterTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly router: Router) {}

  onRiot(): void {
    if (this.status() !== 'idle') return;
    this.status.set('connecting');
    this.connectTimer = setTimeout(() => {
      this.status.set('success');
      this.enterTimer = setTimeout(() => this.enterApp(), 1100);
    }, 1900);
  }

  onGuest(): void {
    if (this.isConnecting()) return;
    this.enterApp();
  }

  private enterApp(): void {
    this.router.navigateByUrl('/app');
  }

  ngOnDestroy(): void {
    clearTimeout(this.connectTimer);
    clearTimeout(this.enterTimer);
  }
}
