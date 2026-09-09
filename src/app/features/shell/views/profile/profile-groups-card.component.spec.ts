import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProfileGroupRecord } from '../../../../core/player-profile';
import { ProfileGroupsCard } from './profile-groups-card.component';

function grupo(n: number): ProfileGroupRecord {
  return {
    id: `g${n}`,
    name: `Grupo ${n}`,
    initials: `G${n}`,
    c1: '#111',
    c2: '#222',
    role: 'Miembro',
    games: 20,
    wins: 12,
    losses: 8,
    wr: 60,
    rankPosition: n,
    lp: 100 + n,
    seasonName: 'Temporada 2026-Q3',
  };
}

@Component({
  standalone: true,
  imports: [ProfileGroupsCard],
  template: `<app-profile-groups-card [groups]="grupos()" />`,
})
class Host {
  readonly grupos = signal<ProfileGroupRecord[]>([]);
}

describe('ProfileGroupsCard', () => {
  let fixture: ComponentFixture<Host>;

  const root = () => fixture.nativeElement as HTMLElement;
  const paginas = () => root().querySelectorAll('.pf-group-list');
  const nombresVisibles = () => {
    const activa = root().querySelector('.pf-group-list:not([aria-hidden="true"])');
    return Array.from(activa?.querySelectorAll('.pf-group-item__name') ?? []).map((n) => n.textContent!.trim());
  };
  const botones = () => root().querySelectorAll<HTMLButtonElement>('.pf-group-pager button');
  const contador = () => root().querySelector('.pf-group-pager__count')?.textContent?.trim();

  function conGrupos(n: number): void {
    fixture.componentInstance.grupos.set(Array.from({ length: n }, (_, i) => grupo(i + 1)));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('con cuatro grupos o menos no ofrece controles de paginación', () => {
    conGrupos(4);

    expect(paginas().length).toBe(1);
    expect(botones().length).toBe(0);
    expect(nombresVisibles().length).toBe(4);
  });

  it('parte la lista en páginas de cuatro a partir del quinto grupo', () => {
    conGrupos(10);

    expect(paginas().length).toBe(3);
    expect(contador()).toBe('1/3');
    expect(nombresVisibles()).toEqual(['Grupo 1', 'Grupo 2', 'Grupo 3', 'Grupo 4']);
  });

  it('nunca enseña más de cuatro grupos a la vez', () => {
    conGrupos(10);
    const [anterior, siguiente] = Array.from(botones());

    siguiente.click();
    fixture.detectChanges();
    expect(nombresVisibles()).toEqual(['Grupo 5', 'Grupo 6', 'Grupo 7', 'Grupo 8']);

    siguiente.click();
    fixture.detectChanges();
    // La última página va incompleta: dos grupos, no cuatro rellenados a la fuerza.
    expect(nombresVisibles()).toEqual(['Grupo 9', 'Grupo 10']);

    anterior.click();
    fixture.detectChanges();
    expect(nombresVisibles()).toEqual(['Grupo 5', 'Grupo 6', 'Grupo 7', 'Grupo 8']);
  });

  it('deshabilita el control del extremo en el que ya está', () => {
    conGrupos(10);
    let [anterior, siguiente] = Array.from(botones());
    expect(anterior.disabled).toBe(true);
    expect(siguiente.disabled).toBe(false);

    siguiente.click();
    fixture.detectChanges();
    siguiente.click();
    fixture.detectChanges();

    [anterior, siguiente] = Array.from(botones());
    expect(contador()).toBe('3/3');
    expect(anterior.disabled).toBe(false);
    expect(siguiente.disabled).toBe(true);
  });

  /**
   * El caso que rompía sin `linkedSignal`: estás en la última página y la lista
   * encoge (cambias de jugador, llega un refetch). La página deja de existir y la
   * tarjeta enseñaría un hueco en blanco en vez de grupos.
   */
  it('vuelve a una página válida si la lista encoge bajo los pies', () => {
    conGrupos(10);
    const siguiente = Array.from(botones())[1];
    siguiente.click();
    fixture.detectChanges();
    siguiente.click();
    fixture.detectChanges();
    expect(contador()).toBe('3/3');

    conGrupos(5);

    expect(contador()).toBe('2/2');
    expect(nombresVisibles()).toEqual(['Grupo 5']);
  });

  it('sin grupos enseña el estado vacío, no una tarjeta en blanco', () => {
    conGrupos(0);

    expect(botones().length).toBe(0);
    expect(root().querySelector('.empty-state__text')?.textContent).toContain('Sin grupos todavía');
  });

  /**
   * La regla que pidió el usuario el 2026-09-09: la fila es la misma se comparta el grupo o no.
   * Sin `GroupsStore` ni `GroupStore` en el TestBed, `isMember()` es siempre falso, así que este
   * es el caso "grupo ajeno" y lo que se comprueba es que sigue siendo una fila normal: mismo
   * enlace, mismo avatar, misma flecha, y ningún botón dentro.
   */
  it('un grupo ajeno se pinta como cualquier otro, sin botones y con la etiqueta', () => {
    conGrupos(1);

    const fila = root().querySelector('.pf-group-item')!;
    expect(fila.querySelector('button')).toBeNull();
    expect(fila.querySelector('.pf-group-item__avatar')).not.toBeNull();
    expect(fila.querySelector('.pf-group-item__arrow')).not.toBeNull();
    expect(fila.querySelector('.pf-group-item__badge')?.textContent?.trim()).toBe('Grupo ajeno');
    expect(fila.querySelector('.pf-group-item__rank')).toBeNull();
    expect(fila.querySelector('.pf-group-item__sub')?.textContent).toContain('Ver ficha');
  });

  it('la fila de un grupo ajeno lleva a su ficha pública', () => {
    conGrupos(1);

    const enlace = root().querySelector<HTMLAnchorElement>('.pf-group-item__link')!;
    expect(enlace.getAttribute('href')).toBe('/app/grupos/g1/perfil');
  });
});
