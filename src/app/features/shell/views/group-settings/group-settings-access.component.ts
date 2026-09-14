import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Sección de Acceso de los Ajustes del Grupo.
 * Muestra la visibilidad deshabilitada y un enlace al hub para la gestión de miembros.
 */
@Component({
  selector: 'app-group-settings-access',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="form-grid">
      <!-- Visibilidad del grupo -->
      <div class="field">
        <span class="field__label">Visibilidad del grupo</span>

        <div class="gs-radio-group">
          <label class="gs-radio-opt is-disabled">
            <input
              type="radio"
              name="gs-visibility"
              value="public"
              checked
              disabled
              class="gs-radio-input"
            />
            <div class="gs-radio-content">
              <span class="gs-radio-title">Público</span>
              <span class="gs-radio-desc">Aparece en el directorio y cualquiera puede pedir entrar.</span>
            </div>
          </label>

          <label class="gs-radio-opt is-disabled">
            <input
              type="radio"
              name="gs-visibility"
              value="closed"
              disabled
              class="gs-radio-input"
            />
            <div class="gs-radio-content">
              <span class="gs-radio-title">Cerrado</span>
              <span class="gs-radio-desc">Solo se entra por invitación directa.</span>
            </div>
          </label>
        </div>

        <!-- BACKEND NOTE: falta el campo visibility en GroupResponse (Fase 6 fila 16). -->
        <div class="gs-note">
          <svg class="gs-note__icon" viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" />
            <path d="M8 5v.5M8 7.5v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <span>
            La visibilidad todavía no se puede configurar: hoy todos los grupos se comportan igual. Llegará junto con la clasificación pública.
          </span>
        </div>
      </div>

      <div class="gs-separator"></div>

      <!-- Fila de enlace a Miembros -->
      <a class="gs-link-row" [routerLink]="['/app', 'grupos', groupId()]">
        <div class="gs-link-row__content">
          <span class="gs-link-row__title">Miembros, roles y solicitudes</span>
          <span class="gs-link-row__desc">Se gestionan desde el hub del grupo</span>
        </div>
        <span class="gs-link-row__arrow" aria-hidden="true">›</span>
      </a>
    </div>
  `,
  styleUrl: './group-settings-access.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupSettingsAccessComponent {
  readonly groupId = input.required<string>();
}
