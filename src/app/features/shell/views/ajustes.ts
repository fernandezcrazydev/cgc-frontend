import { Component, signal } from '@angular/core';
import { NfSelect, NfToggle, NfWindow } from '../../../ui';
import { REGION_OPTIONS } from '../../../core/lobby';

@Component({
  selector: 'app-ajustes',
  standalone: true,
  imports: [NfWindow, NfToggle, NfSelect],
  template: `
    <div class="view max-520">
      <nf-window title="config.exe" accent="pink" bodyPadding="22px">
        <div class="settings-eyebrow nf-mono">// PREFERENCIAS DEL LOBBY</div>

        <div class="setting-row">
          <div>
            <div class="setting-title">Voz activada</div>
            <div class="setting-sub nf-mono">CHAT DE VOZ EN EL LOBBY</div>
          </div>
          <nf-toggle [checked]="voice()" accent="cyan" (checkedChange)="voice.set($event)" />
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-title">Partida clasificatoria</div>
            <div class="setting-sub nf-mono">CUENTA PARA EL RANKING</div>
          </div>
          <nf-toggle [checked]="ranked()" accent="pink" (checkedChange)="ranked.set($event)" />
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-title">Permitir espectadores</div>
            <div class="setting-sub nf-mono">HASTA 5 OBSERVADORES</div>
          </div>
          <nf-toggle [checked]="spectators()" accent="cyan" (checkedChange)="spectators.set($event)" />
        </div>

        <div class="setting-row setting-row--last">
          <div class="setting-title">Región</div>
          <div style="width:150px;">
            <nf-select [options]="regionOptions" [value]="region()" (valueChange)="region.set($event)" />
          </div>
        </div>
      </nf-window>
    </div>
  `,
})
export class Ajustes {
  readonly regionOptions = REGION_OPTIONS;
  readonly voice = signal(true);
  readonly ranked = signal(false);
  readonly spectators = signal(true);
  readonly region = signal('LAN');
}
