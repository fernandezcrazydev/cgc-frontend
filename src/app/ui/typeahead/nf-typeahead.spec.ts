import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { describe, expect, it, beforeEach } from 'vitest';
import { NfTypeahead } from './nf-typeahead';

interface TestOption {
  id: string;
  name: string;
}

@Component({
  standalone: true,
  imports: [NfTypeahead],
  template: `
    <nf-typeahead
      [suggestions]="suggestions()"
      [query]="query()"
      (selectOption)="selected.set($event)"
      labelKey="name"
    />
  `,
})
class TestHost {
  readonly suggestions = signal<TestOption[]>([
    { id: '1', name: 'Option One' },
    { id: '2', name: 'Option Two' },
    { id: '3', name: 'Option Three' },
  ]);
  readonly query = signal('opt');
  readonly selected = signal<TestOption | null>(null);
}

describe('NfTypeahead', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;
  let inputEl: HTMLInputElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestHost, NfTypeahead],
    });

    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    inputEl = fixture.nativeElement.querySelector('input');
  });

  it('should not include clear button in the tab order (tabindex="-1")', () => {
    const clearBtn = fixture.nativeElement.querySelector('.nf-typeahead__clear');
    if (clearBtn) {
      expect(clearBtn.getAttribute('tabindex')).toBe('-1');
    }
  });

  it('should navigate through suggestions using Tab and Shift+Tab', () => {
    inputEl.focus();
    inputEl.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    const typeaheadInstance = fixture.debugElement.children[0].componentInstance as NfTypeahead<TestOption>;
    expect(typeaheadInstance.open()).toBe(true);
    expect(typeaheadInstance.activeIndex()).toBe(-1);

    // Tab moves forward (to index 0)
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(typeaheadInstance.activeIndex()).toBe(0);

    // Tab moves forward (to index 1)
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(typeaheadInstance.activeIndex()).toBe(1);

    // Shift+Tab moves backward (back to index 0)
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(typeaheadInstance.activeIndex()).toBe(0);

    // Enter selects active suggestion
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(host.selected()?.id).toBe('1');
    expect(typeaheadInstance.open()).toBe(false);
  });

  it('should navigate with ArrowDown and ArrowUp and select with Enter', () => {
    inputEl.focus();
    inputEl.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    const typeaheadInstance = fixture.debugElement.children[0].componentInstance as NfTypeahead<TestOption>;

    // ArrowDown moves to index 0
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(typeaheadInstance.activeIndex()).toBe(0);

    // ArrowDown moves to index 1
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(typeaheadInstance.activeIndex()).toBe(1);

    // ArrowUp moves back to index 0
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(typeaheadInstance.activeIndex()).toBe(0);

    // Enter selects Option One
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(host.selected()?.name).toBe('Option One');
  });
});
