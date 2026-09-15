import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { GroupTabsService, MIN_VISIBLE_TABS } from '../../../../core/group-tabs';
import { NfButton, NfIconButton, NfWindow } from '../../../../ui';

@Component({
  selector: 'app-settings-group-tabs',
  standalone: true,
  imports: [NfWindow, NfButton, NfIconButton],
  templateUrl: './settings-group-tabs.component.html',
  styleUrl: './settings-group-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsGroupTabsComponent {
  private readonly groupTabs = inject(GroupTabsService);

  readonly minVisibleTabs = MIN_VISIBLE_TABS;
  readonly tabs = this.groupTabs.tabs;
  readonly visibleTabs = this.groupTabs.visibleTabs;

  readonly visibleCount = computed(() => this.visibleTabs().length);

  readonly draggedPath = signal<string | null>(null);
  readonly dragOverPath = signal<string | null>(null);

  toggle(path: string): void {
    this.groupTabs.toggle(path);
  }

  moveUp(path: string, index: number): void {
    if (index > 0) {
      this.groupTabs.move(path, index - 1);
    }
  }

  moveDown(path: string, index: number): void {
    const total = this.tabs().length;
    if (index < total - 1) {
      this.groupTabs.move(path, index + 1);
    }
  }

  reset(): void {
    this.groupTabs.reset();
  }

  onDragStart(event: DragEvent, path: string): void {
    this.draggedPath.set(path);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', path);
    }
  }

  onDragOver(event: DragEvent, path: string): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    if (this.draggedPath() && this.draggedPath() !== path) {
      this.dragOverPath.set(path);
    }
  }

  onDragEnter(event: DragEvent, path: string): void {
    event.preventDefault();
    if (this.draggedPath() && this.draggedPath() !== path) {
      this.dragOverPath.set(path);
    }
  }

  onDragLeave(event: DragEvent, path: string): void {
    const related = event.relatedTarget as HTMLElement | null;
    const current = event.currentTarget as HTMLElement | null;
    if (current && related && current.contains(related)) {
      return;
    }
    if (this.dragOverPath() === path) {
      this.dragOverPath.set(null);
    }
  }

  onDrop(event: DragEvent, targetPath: string): void {
    event.preventDefault();
    event.stopPropagation();
    const sourcePath =
      this.draggedPath() ||
      event.dataTransfer?.getData('text/plain');

    if (!sourcePath || sourcePath === targetPath) {
      this.onDragEnd();
      return;
    }

    const currentTabs = this.tabs();
    const toIndex = currentTabs.findIndex((t) => t.path === targetPath);
    if (toIndex !== -1) {
      this.groupTabs.move(sourcePath, toIndex);
    }
    this.onDragEnd();
  }

  onDragEnd(): void {
    this.draggedPath.set(null);
    this.dragOverPath.set(null);
  }
}
