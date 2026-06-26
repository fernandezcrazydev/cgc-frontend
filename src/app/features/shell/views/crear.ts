import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NfButton, NfSelect, NfToggle, NfWindow } from '../../../ui';
import { REGION_OPTIONS } from '../../../core/lobby';

@Component({
  selector: 'app-crear',
  standalone: true,
  imports: [FormsModule, NfWindow, NfButton, NfSelect, NfToggle],
  template: `
    <div class="view max-520">
      <p class="view__intro">Configura el lobby, define las reglas y lanza la partida personalizada.</p>

      <nf-window title="nueva_partida.exe" accent="cyan" bodyPadding="22px">
        <div class="settings-eyebrow nf-mono">// NUEVA PARTIDA PERSONALIZADA</div>

        <div class="form-grid">
          <div class="field">
            <label class="field__label nf-mono" for="match-name">NOMBRE DEL LOBBY</label>
            <input
              id="match-name"
              class="field__input"
              type="text"
              placeholder="match_lobby.exe"
              [(ngModel)]="name"
            />
          </div>

          <div class="field">
            <label class="field__label nf-mono">MODO DE JUEGO</label>
            <nf-select [options]="modeOptions" [value]="mode()" (valueChange)="mode.set($event)" />
          </div>

          <div class="field">
            <label class="field__label nf-mono">REGIÓN</label>
            <nf-select [options]="regionOptions" [value]="region()" (valueChange)="region.set($event)" />
          </div>
        </div>

        <div class="setting-row" style="margin-top:6px;">
          <div>
            <div class="setting-title">Partida clasificatoria</div>
            <div class="setting-sub nf-mono">CUENTA PARA EL RANKING</div>
          </div>
          <nf-toggle [checked]="ranked()" accent="pink" (checkedChange)="ranked.set($event)" />
        </div>

        <div class="setting-row setting-row--last">
          <div>
            <div class="setting-title">Permitir espectadores</div>
            <div class="setting-sub nf-mono">HASTA 5 OBSERVADORES</div>
          </div>
          <nf-toggle [checked]="spectators()" accent="cyan" (checkedChange)="spectators.set($event)" />
        </div>

        <div class="form-foot">
          <button nfButton variant="primary" size="md" (click)="launch()">LANZAR PARTIDA ►</button>
          <button nfButton variant="ghost" size="md" (click)="reset()">LIMPIAR</button>
        </div>

        <p class="form-note nf-mono">
          EL DRAFT BLUE VS RED Y LA ASIGNACIÓN DE CAMPEONES LLEGAN EN LA SIGUIENTE ENTREGA.
        </p>
      </nf-window>
    </div>
  `,
})
export class Crear {
  readonly regionOptions = REGION_OPTIONS;
  readonly modeOptions = ['5v5', '3v3', '1v1', 'ARAM'];

  name = '';
  readonly mode = signal('5v5');
  readonly region = signal('LAN');
  readonly ranked = signal(false);
  readonly spectators = signal(true);

  constructor(private readonly router: Router) {}

  launch(): void {
    // Placeholder: persist + draft flow comes later. For now, go to the lobby list.
    this.router.navigate(['/app', 'partidas']);
  }

  reset(): void {
    this.name = '';
    this.mode.set('5v5');
    this.region.set('LAN');
    this.ranked.set(false);
    this.spectators.set(true);
  }
}
