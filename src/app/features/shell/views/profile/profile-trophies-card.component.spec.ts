import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ProfileGroupRecord } from '../../../../core/player-profile';
import { ProfileTrophiesCardComponent } from './profile-trophies-card.component';

function grupo(n: number, rankPosition = n): ProfileGroupRecord {
  return {
    id: `g${n}`,
    name: `Grupo ${n}`,
    initials: `G${n}`,
    c1: '#111',
    c2: '#222',
    role: 'Miembro',
    games: 30,
    wins: 20,
    losses: 10,
    wr: 67,
    rankPosition,
    lp: 500,
    seasonName: 'Temporada 2026-Q3',
  };
}

@Component({
  standalone: true,
  imports: [ProfileTrophiesCardComponent],
  template: `<app-profile-trophies-card [groups]="grupos()" [editable]="editable()" />`,
})
class Host {
  readonly grupos = signal<ProfileGroupRecord[]>([]);
  readonly editable = signal(false);
}

describe('ProfileTrophiesCardComponent', () => {
  let fixture: ComponentFixture<Host>;

  const root = () => fixture.nativeElement as HTMLElement;
  const editButton = () =>
    root().querySelector<HTMLButtonElement>('.pf-card__header button[nfIconButton]');

  function setGrupos(list: ProfileGroupRecord[]): void {
    fixture.componentInstance.grupos.set(list);
    fixture.detectChanges();
  }

  function abrirModal(): void {
    editButton()!.click();
    fixture.detectChanges();
  }

  function marcar(indice: number): void {
    const cards = document.querySelectorAll<HTMLButtonElement>('.pf-trophy-card');
    cards[indice].click();
    fixture.detectChanges();
  }

  function pulsar(texto: string): void {
    const botones = Array.from(document.querySelectorAll<HTMLButtonElement>('nf-modal button'));
    botones.find((b) => b.textContent?.includes(texto))!.click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('sin grupos dice que todavía no hay podios', () => {
    setGrupos([]);

    expect(root().querySelector('.empty-state')).not.toBeNull();
    expect(root().textContent).toContain('Todavía no ha terminado ninguna temporada en el podio');
  });

  it('grupos fuera del podio no generan trofeos', () => {
    setGrupos([grupo(4), grupo(5)]);

    expect(root().querySelector('.pf-trophy')).toBeNull();
  });

  it('renderiza la copa, el nombre del trofeo, el grupo y la temporada', () => {
    setGrupos([grupo(1), grupo(2), grupo(3)]);

    const trofeos = root().querySelectorAll('.pf-trophy');
    expect(trofeos.length).toBe(3);

    const imagenes = root().querySelectorAll<HTMLImageElement>('.pf-trophy__cup');
    expect(imagenes[0].src).toContain('/assets/trofeos/Trofeo1.webp');
    expect(imagenes[2].src).toContain('/assets/trofeos/Trofeo3.webp');

    const nombres = root().querySelectorAll('.pf-trophy__name');
    expect(nombres[0].textContent).toContain('Campeón');
    expect(nombres[1].textContent).toContain('Subcampeón');
    expect(nombres[2].textContent).toContain('Tercer puesto');

    expect(root().querySelector('.pf-trophy__group')?.textContent).toContain('Grupo 1');
    expect(root().querySelector('.pf-trophy__season')?.textContent).toContain('Temporada 2026-Q3');
  });

  it('enseña tres trofeos como mucho, los de mejor puesto', () => {
    setGrupos([grupo(3), grupo(1), grupo(2), grupo(4, 3)]);

    const nombres = Array.from(root().querySelectorAll('.pf-trophy__name')).map((n) =>
      n.textContent?.trim(),
    );
    expect(nombres).toEqual(['Campeón', 'Subcampeón', 'Tercer puesto']);
  });

  it('el botón de editar solo existe en el perfil propio', () => {
    setGrupos([grupo(1), grupo(2)]);
    expect(editButton()).toBeNull();

    fixture.componentInstance.editable.set(true);
    fixture.detectChanges();
    expect(editButton()).not.toBeNull();
  });

  it('el modal deja elegir qué trofeos se enseñan', () => {
    fixture.componentInstance.editable.set(true);
    setGrupos([grupo(1), grupo(2), grupo(3), grupo(4, 3)]);

    abrirModal();
    expect(document.querySelectorAll('.pf-trophy-card').length).toBe(4);

    // Se suelta el campeón y se pone en su hueco el cuarto trofeo.
    marcar(0);
    marcar(3);
    pulsar('Guardar');

    const nombres = Array.from(root().querySelectorAll('.pf-trophy__group')).map((n) =>
      n.textContent?.trim(),
    );
    expect(nombres).toEqual(['Grupo 2', 'Grupo 3', 'Grupo 4']);
  });

  it('con la vitrina llena, lo no elegido se deshabilita en vez de desaparecer', () => {
    fixture.componentInstance.editable.set(true);
    setGrupos([grupo(1), grupo(2), grupo(3), grupo(4, 3)]);

    abrirModal();

    const cards = document.querySelectorAll<HTMLButtonElement>('.pf-trophy-card');
    expect(cards.length).toBe(4);
    expect(cards[3].disabled).toBe(true);
    expect(document.querySelector('.pf-trophies__count')?.textContent).toContain(
      'Vitrina llena — quita uno para cambiar',
    );
  });

  it('cancelar deja la vitrina como estaba', () => {
    fixture.componentInstance.editable.set(true);
    setGrupos([grupo(1), grupo(2), grupo(3)]);

    abrirModal();
    marcar(0);
    pulsar('Cancelar');

    expect(root().querySelectorAll('.pf-trophy').length).toBe(3);
    expect(root().querySelector('.pf-trophy__name')?.textContent).toContain('Campeón');
  });
});
