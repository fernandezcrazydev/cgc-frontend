import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsGroupTabsComponent } from './settings-group-tabs.component';
import { GroupTabsService } from '../../../../core/group-tabs';

describe('SettingsGroupTabsComponent', () => {
  let component: SettingsGroupTabsComponent;
  let fixture: ComponentFixture<SettingsGroupTabsComponent>;
  let groupTabsService: GroupTabsService;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [SettingsGroupTabsComponent],
      providers: [GroupTabsService],
    }).compileComponents();

    groupTabsService = TestBed.inject(GroupTabsService);
    fixture = TestBed.createComponent(SettingsGroupTabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente con las 6 pestañas y la vista previa', () => {
    expect(component).toBeTruthy();
    expect(component.tabs().length).toBe(6);
    expect(component.visibleCount()).toBe(6);

    const rows = fixture.nativeElement.querySelectorAll('.tab-row');
    expect(rows.length).toBe(6);

    const previewItems = fixture.nativeElement.querySelectorAll('.tab-preview__item');
    expect(previewItems.length).toBe(6);
  });

  it('deshabilitar casillas cuando quedan exactamente tres visibles con su title', () => {
    groupTabsService.toggle('ranking');
    groupTabsService.toggle('tierlist');
    groupTabsService.toggle('estadisticas');
    fixture.detectChanges();

    expect(component.visibleCount()).toBe(3);

    const checkboxes: HTMLInputElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.tab-row__checkbox'),
    );

    // Las 3 marcadas deben estar disabled con el title explicativo
    const checkedBoxes = checkboxes.filter((c) => c.checked);
    expect(checkedBoxes.length).toBe(3);
    for (const cb of checkedBoxes) {
      expect(cb.disabled).toBe(true);
      expect(cb.title).toBe('Tienen que quedar al menos tres pestañas');
    }

    // Las 3 desmarcadas deben seguir habilitadas
    const uncheckedBoxes = checkboxes.filter((c) => !c.checked);
    expect(uncheckedBoxes.length).toBe(3);
    for (const cb of uncheckedBoxes) {
      expect(cb.disabled).toBe(false);
    }
  });

  it('reordenar con las flechas arriba y abajo', () => {
    // Subir la segunda pestaña (tierlist) al primer puesto
    component.moveUp('tierlist', 1);
    fixture.detectChanges();

    expect(component.tabs()[0].path).toBe('tierlist');
    expect(component.tabs()[1].path).toBe('ranking');

    // Bajar la primera pestaña de vuelta a la segunda posición
    component.moveDown('tierlist', 0);
    fixture.detectChanges();

    expect(component.tabs()[0].path).toBe('ranking');
    expect(component.tabs()[1].path).toBe('tierlist');
  });

  it('restablecer vuelve al estado por defecto', () => {
    groupTabsService.toggle('ranking');
    component.moveUp('sanciones', 5);
    fixture.detectChanges();

    component.reset();
    fixture.detectChanges();

    expect(component.visibleCount()).toBe(6);
    expect(component.tabs().every((t) => t.visible)).toBe(true);
    expect(component.tabs()[0].path).toBe('ranking');
  });
});
