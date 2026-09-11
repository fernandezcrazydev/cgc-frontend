import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pruebas } from './pruebas';

describe('Pruebas (Laboratorio de maquetas)', () => {
  let component: Pruebas;
  let fixture: ComponentFixture<Pruebas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pruebas],
    }).compileComponents();

    fixture = TestBed.createComponent(Pruebas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('inicia con la pestaña de cabecera seleccionada', () => {
    expect(component.selectedTab()).toBe('cabecera');
  });

  it('permite cambiar entre pestañas', () => {
    component.selectedTab.set('duos');
    fixture.detectChanges();
    expect(component.selectedTab()).toBe('duos');

    component.selectedTab.set('builds');
    fixture.detectChanges();
    expect(component.selectedTab()).toBe('builds');

    component.selectedTab.set('skills');
    fixture.detectChanges();
    expect(component.selectedTab()).toBe('skills');

    component.selectedTab.set('montaje');
    fixture.detectChanges();
    expect(component.selectedTab()).toBe('montaje');
  });

  it('filtra compañeros y rivales por campeón seleccionado', () => {
    expect(component.filteredSinergias().length).toBe(4);
    expect(component.filteredRivales().length).toBe(4);
    expect(component.duosCountLabel()).toBe('10 campeones con datos');

    component.selectedChampion.set('Zed');
    fixture.detectChanges();

    expect(component.filteredSinergias().length).toBe(0);
    expect(component.filteredRivales().length).toBe(1);
    expect(component.filteredRivales()[0].nombre).toBe('Zed');
    expect(component.duosCountLabel()).toBe('Filtrando por Zed');

    component.selectedChampion.set('Leona');
    fixture.detectChanges();

    expect(component.filteredSinergias().length).toBe(1);
    expect(component.filteredSinergias()[0].nombre).toBe('Leona');
    expect(component.filteredRivales().length).toBe(0);

    component.selectedChampion.set('');
    fixture.detectChanges();
    expect(component.filteredSinergias().length).toBe(4);
    expect(component.filteredRivales().length).toBe(4);
  });

  it('permite cambiar alternativas en la pestaña de montaje', () => {
    component.selectedTab.set('montaje');
    fixture.detectChanges();

    expect(component.altCabecera()).toBe('1');
    expect(component.altSinergias()).toBe('1');
    expect(component.altBuilds()).toBe('1');
    expect(component.altSkills()).toBe('1');

    component.altCabecera.set('3');
    component.altSinergias.set('4');
    component.altBuilds.set('2');
    component.altSkills.set('5');
    fixture.detectChanges();

    expect(component.altCabecera()).toBe('3');
    expect(component.altSinergias()).toBe('4');
    expect(component.altBuilds()).toBe('2');
    expect(component.altSkills()).toBe('5');
  });
});
