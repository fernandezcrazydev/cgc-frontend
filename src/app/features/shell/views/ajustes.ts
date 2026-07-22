import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NfSelect, NfToggle, NfWindow } from '../../../ui';
import { REGION_OPTIONS } from '../../../core/lobby';
import { THEMES, ThemeService } from '../../../core/theme';

@Component({
  selector: 'app-ajustes',
  standalone: true,
  imports: [NfWindow, NfToggle, NfSelect],
  template: `
    <div class="view max-520">
      <nf-window title="tema.exe" accent="cyan" bodyPadding="22px">
        <div class="settings-eyebrow nf-mono nf-eyebrow">Apariencia</div>

        <div class="theme-grid" role="radiogroup" aria-label="Tema visual">
          @for (t of themes; track t.id) {
            <button
              type="button"
              role="radio"
              class="theme-opt"
              [class.is-active]="theme.theme() === t.id"
              [attr.aria-checked]="theme.theme() === t.id"
              (click)="theme.set(t.id)"
            >
              <span class="theme-opt__swatch" [attr.data-preview]="t.id" aria-hidden="true"></span>
              <span class="theme-opt__text">
                <span class="theme-opt__name">{{ t.label }}</span>
                <span class="theme-opt__desc">{{ t.description }}</span>
              </span>
            </button>
          }
        </div>
      </nf-window>

      <nf-window title="config.exe" accent="pink" bodyPadding="22px">
        <div class="settings-eyebrow nf-mono nf-eyebrow">Preferencias del lobby</div>

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
  styles: [
    `
      .theme-grid {
        display: grid;
        gap: 10px;
        margin-top: 14px;
      }
      .theme-opt {
        display: flex;
        align-items: center;
        gap: 14px;
        width: 100%;
        padding: 12px 14px;
        text-align: left;
        cursor: pointer;
        background: var(--nf-surface-2);
        border: var(--bw-1) solid var(--nf-border);
        border-radius: var(--nf-radius);
        color: inherit;
        font: inherit;
        transition: border-color 0.15s, background 0.15s;
      }
      .theme-opt:hover {
        border-color: var(--nf-border-strong);
      }
      .theme-opt.is-active {
        border-color: var(--nf-pink);
        background: color-mix(in srgb, var(--nf-pink) 12%, var(--nf-surface-2));
      }
      .theme-opt:focus-visible {
        outline: 2px solid var(--nf-cyan);
        outline-offset: 2px;
      }

      /* Muestra de cada skin: los colores van literales a propósito — es una
         previsualización del tema, no del tema activo, así que no puede usar
         los tokens --nf-* (cambiarían con la skin en curso). */
      .theme-opt__swatch {
        flex: none;
        width: 42px;
        height: 42px;
        border-radius: var(--nf-radius-sm);
        border: 1px solid rgba(255, 255, 255, 0.14);
      }
      .theme-opt__swatch[data-preview='nexus'] {
        background: linear-gradient(135deg, #36e0ff, #ff5fd2 60%, #180a2c);
      }
      .theme-opt__swatch[data-preview='nocturne'] {
        background: linear-gradient(135deg, #3a3a3c, #0a84ff 65%, #000);
      }
      .theme-opt__swatch[data-preview='original'] {
        background: linear-gradient(135deg, #818cf8, #e879f9 55%, #070912);
      }

      .theme-opt__text {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }
      .theme-opt__name {
        font-weight: var(--fw-bold);
        font-size: var(--fs-body);
      }
      .theme-opt__desc {
        font-size: 12px;
        color: var(--nf-text-mid);
        line-height: 1.4;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Ajustes {
  readonly theme = inject(ThemeService);
  readonly themes = THEMES;
  readonly regionOptions = REGION_OPTIONS;
  readonly voice = signal(true);
  readonly ranked = signal(false);
  readonly spectators = signal(true);
  readonly region = signal('LAN');
}
