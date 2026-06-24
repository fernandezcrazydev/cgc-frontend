import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';

/**
 * NEXUS//FORGE Avatar Picker — a square preview that shows the current group
 * photo (or the gradient + initials fallback) with controls to upload a new
 * image or clear it. The chosen file is read as a base64 data URL and emitted
 * via `valueChange`; `null` is emitted when the photo is removed.
 *
 *   <nf-avatar-picker
 *     [value]="avatar()" [initials]="'LC'" [c1]="c1" [c2]="c2"
 *     (valueChange)="avatar.set($event)" />
 */
@Component({
  selector: 'nf-avatar-picker',
  standalone: true,
  template: `
    <div class="nf-avatarpicker">
      <div
        class="nf-avatarpicker__preview"
        [style.--grp-c1]="c1"
        [style.--grp-c2]="c2"
      >
        @if (value) {
          <img class="nf-avatarpicker__img" [src]="value" alt="" />
        } @else {
          <span class="nf-avatarpicker__initials nf-mono">{{ initials }}</span>
        }
      </div>

      <div class="nf-avatarpicker__controls">
        <label class="nf-avatarpicker__btn nf-mono">
          {{ value ? 'CAMBIAR' : 'SUBIR FOTO' }}
          <input
            class="nf-avatarpicker__input"
            type="file"
            accept="image/*"
            (change)="onFile($event)"
          />
        </label>
        @if (value) {
          <button type="button" class="nf-avatarpicker__btn nf-avatarpicker__btn--ghost nf-mono" (click)="clear()">
            QUITAR
          </button>
        }
        @if (error) {
          <span class="nf-avatarpicker__error nf-mono">{{ error }}</span>
        }
        @else {
          <span class="nf-avatarpicker__hint nf-mono">PNG · JPG · WEBP · máx {{ maxSizeMb }}MB</span>
        }
      </div>
    </div>
  `,
  styleUrl: './nf-avatar-picker.scss',
  encapsulation: ViewEncapsulation.None,
})
export class NfAvatarPicker {
  /** Current photo as a data URL (or empty for the initials fallback). */
  @Input() value: string | null = null;
  /** Fallback initials shown when there is no photo. */
  @Input() initials = '';
  /** Gradient stops for the fallback preview. */
  @Input() c1 = 'var(--nf-cyan)';
  @Input() c2 = 'var(--nf-pink)';
  /** Max accepted file size in megabytes. */
  @Input() maxSizeMb = 4;

  @Output() valueChange = new EventEmitter<string | null>();

  error = '';

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset so picking the same file again still fires `change`.
    input.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.error = 'El archivo debe ser una imagen.';
      return;
    }
    if (file.size > this.maxSizeMb * 1024 * 1024) {
      this.error = `La imagen supera los ${this.maxSizeMb}MB.`;
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.error = '';
      this.value = reader.result as string;
      this.valueChange.emit(this.value);
    };
    reader.onerror = () => {
      this.error = 'No se pudo leer el archivo.';
    };
    reader.readAsDataURL(file);
  }

  clear(): void {
    this.error = '';
    this.value = null;
    this.valueChange.emit(null);
  }
}
