import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NfWindow } from '../../../../ui';
import { THEMES, ThemeService } from '../../../../core/theme';

@Component({
  selector: 'app-settings-appearance',
  standalone: true,
  imports: [NfWindow],
  template: `
    <nf-window title="Tema" bodyPadding="22px">
      <div class="settings-eyebrow nf-mono">Apariencia</div>

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
  `,
  styleUrl: './settings-appearance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsAppearanceComponent {
  readonly theme = inject(ThemeService);
  readonly themes = THEMES;
}
