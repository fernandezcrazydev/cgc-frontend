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

      <nf-window title="Nueva partida" bodyPadding="22px">
        <div class="settings-eyebrow nf-mono">Nueva partida personalizada</div>

        <div class="form-grid">
          <div class="field">
            <label class="field__label nf-mono" for="match-name">Nombre del lobby</label>
            <input
              id="match-name"
              class="field__input"
              type="text"
              placeholder="Sala de partida"
              [(ngModel)]="name"
            />
          </div>

          <div class="field">
            <label class="field__label nf-mono">Modo de juego</label>
            <nf-select [options]="modeOptions" [value]="mode()" (valueChange)="mode.set($event)" />
          </div>

          <div class="field">
            <label class="field__label nf-mono">Región</label>
            <nf-select [options]="regionOptions" [value]="region()" (valueChange)="region.set($event)" />
          </div>
        </div>

        <div class="setting-row" style="margin-top:6px;">
          <div>
            <div class="setting-title">Partida clasificatoria</div>
            <div class="setting-sub nf-mono">Cuenta para el ranking</div>
          </div>
          <nf-toggle [checked]="ranked()" (checkedChange)="ranked.set($event)" />
        </div>

        <div class="setting-row setting-row--last">
          <div>
            <div class="setting-title">Permitir espectadores</div>
            <div class="setting-sub nf-mono">Hasta 5 observadores</div>
          </div>
          <nf-toggle [checked]="spectators()" (checkedChange)="spectators.set($event)" />
        </div>

        <div class="form-foot">
          <button nfButton variant="primary" size="md" (click)="launch()">Lanzar partida</button>
          <button nfButton variant="ghost" size="md" (click)="reset()">Limpiar</button>
        </div>

        <p class="form-note nf-mono">
          El draft blue vs red y la asignación de campeones llegan en la siguiente entrega.
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
