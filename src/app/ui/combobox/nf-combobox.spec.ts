import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NfCombobox, NfComboboxOption } from './nf-combobox';

const CAMPEONES: NfComboboxOption[] = [
  { value: '103', label: 'Ahri' },
  { value: '84', label: 'Akali' },
  { value: '166', label: 'Akshan' },
  { value: '12', label: 'Alistar' },
  { value: '32', label: 'Amumu' },
  { value: '34', label: 'Anivia' },
  { value: '523', label: "Aphelios" },
  { value: '145', label: "Kai'Sa" },
  { value: '200', label: "Bel'Veth" },
];

@Component({
  standalone: true,
  imports: [NfCombobox],
  template: `
    <nf-combobox
      [options]="opciones"
      [(value)]="valor"
      [maxVisible]="tope()"
      placeholder="Buscar campeón"
      ariaLabel="Buscar campeón"
    />
  `,
})
class Host {
  readonly opciones = CAMPEONES;
  readonly valor = signal('');
  readonly tope = signal<number | null>(null);
}

describe('NfCombobox', () => {
  let fixture: ComponentFixture<Host>;

  const root = () => fixture.nativeElement as HTMLElement;
  const input = () => root().querySelector<HTMLInputElement>('.nf-combobox__input')!;
  const opciones = () => Array.from(root().querySelectorAll('.nf-combobox__option-label')).map((n) => n.textContent!.trim());

  /** Abre la lista y escribe, que es el único camino real del usuario. */
  function escribir(texto: string): void {
    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    input().value = texto;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('sin tope enseña todas las coincidencias, sin recortar', () => {
    escribir('a');
    // Los 9 del catálogo menos Bel'Veth, que normalizado no lleva ninguna "a".
    expect(opciones().length).toBe(8);
  });

  it('con maxVisible=4 nunca ofrece más de cuatro sugerencias', () => {
    fixture.componentInstance.tope.set(4);
    fixture.detectChanges();
    escribir('a');
    expect(opciones().length).toBe(4);
  });

  it('el tope también acota la lista sin escribir nada', () => {
    fixture.componentInstance.tope.set(4);
    fixture.detectChanges();
    input().dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(opciones().length).toBe(4);
  });

  it('recorta DESPUÉS de ordenar: los que empiezan por lo escrito no se pierden', () => {
    fixture.componentInstance.tope.set(2);
    fixture.detectChanges();
    // Con "an": empieza por ahí solo "Anivia"; "Akshan" y "Aphelios" lo contienen.
    // El tope se queda con el que empieza y el primero de los que contienen, así
    // que la mejor coincidencia nunca se cae por el recorte.
    escribir('an');
    expect(opciones()).toEqual(['Anivia', 'Akshan']);
  });

  it('no recorta cuando hay menos coincidencias que el tope', () => {
    fixture.componentInstance.tope.set(4);
    fixture.detectChanges();
    escribir('amumu');
    expect(opciones()).toEqual(['Amumu']);
  });

  it('sigue ignorando acentos y signos con el tope puesto', () => {
    fixture.componentInstance.tope.set(4);
    fixture.detectChanges();
    escribir('kaisa');
    expect(opciones()).toEqual(["Kai'Sa"]);
  });
});
