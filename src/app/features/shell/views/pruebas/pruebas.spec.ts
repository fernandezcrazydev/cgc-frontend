import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pruebas } from './pruebas';

describe('Pruebas (Ficha del campeón montada)', () => {
  let component: Pruebas;
  let fixture: ComponentFixture<Pruebas>;
  let nativeElement: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pruebas],
    }).compileComponents();

    fixture = TestBed.createComponent(Pruebas);
    component = fixture.componentInstance;
    nativeElement = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('monta la página y pinta las siete tarjetas', () => {
    const cards = nativeElement.querySelectorAll('.cf-card');
    expect(cards.length).toBe(7);

    expect(nativeElement.querySelector('.cf-card--cabecera')).toBeTruthy();
    expect(nativeElement.querySelector('.cf-card--macro')).toBeTruthy();
    expect(nativeElement.querySelector('.cf-card--espec')).toBeTruthy();
    expect(nativeElement.querySelector('.cf-card--skills')).toBeTruthy();
    expect(nativeElement.querySelector('.cf-card--sinergias')).toBeTruthy();
    expect(nativeElement.querySelector('.cf-card--counters')).toBeTruthy();
    expect(nativeElement.querySelector('.cf-card--builds')).toBeTruthy();
  });

  it('enseña la cabecera con el splash, nombre, tier, las cuatro cifras originales y el banrate', () => {
    const name = nativeElement.querySelector('.c-alt1__name');
    expect(name?.textContent).toContain('Ahri');

    const tier = nativeElement.querySelector('.c-alt1__tier');
    expect(tier?.textContent).toContain('S+');

    const statVals = nativeElement.querySelectorAll('.c-alt1__stat-val');
    expect(statVals.length).toBe(5);
    expect(statVals[0].textContent).toContain('12');
    expect(statVals[1].textContent).toContain('58%');
    expect(statVals[2].textContent).toContain('30%');
    expect(statVals[3].textContent).toContain('3.42');
    expect(statVals[4].textContent).toContain('15%');
  });

  it('despliega el buscador en sinergias al pulsar el botón de lupa y filtra por campeón seleccionado', () => {
    expect(component.filteredSinergias().length).toBe(4);

    const sinergiaTiles = nativeElement.querySelectorAll('.cf-card--sinergias .d-alt4__tile');
    expect(sinergiaTiles.length).toBe(4);

    // Inicialmente el buscador está cerrado
    expect(nativeElement.querySelector('.cf-card--sinergias .d-card-search-row')).toBeNull();

    // Abrir buscador
    const searchBtn = nativeElement.querySelector('.cf-card--sinergias .d-card-search-toggle') as HTMLButtonElement;
    expect(searchBtn).toBeTruthy();
    searchBtn.click();
    fixture.detectChanges();

    expect(nativeElement.querySelector('.cf-card--sinergias .d-card-search-row')).toBeTruthy();

    // Filtrar por Leona
    component.selectedSinergia.set('Leona');
    fixture.detectChanges();

    expect(component.filteredSinergias().length).toBe(1);
    const filteredTiles = nativeElement.querySelectorAll('.cf-card--sinergias .d-alt4__tile');
    expect(filteredTiles.length).toBe(1);
    expect(filteredTiles[0].querySelector('img')?.getAttribute('title')).toBe('Leona');

    // Resetear filtro
    component.selectedSinergia.set('');
    fixture.detectChanges();
    expect(nativeElement.querySelectorAll('.cf-card--sinergias .d-alt4__tile').length).toBe(4);
  });

  it('despliega el buscador en counters al pulsar el botón de lupa y filtra por campeón seleccionado', () => {
    expect(component.filteredRivales().length).toBe(4);

    const counterTiles = nativeElement.querySelectorAll('.cf-card--counters .d-alt4__tile');
    expect(counterTiles.length).toBe(4);

    // Inicialmente cerrado
    expect(nativeElement.querySelector('.cf-card--counters .d-card-search-row')).toBeNull();

    // Abrir buscador
    const searchBtn = nativeElement.querySelector('.cf-card--counters .d-card-search-toggle') as HTMLButtonElement;
    expect(searchBtn).toBeTruthy();
    searchBtn.click();
    fixture.detectChanges();

    expect(nativeElement.querySelector('.cf-card--counters .d-card-search-row')).toBeTruthy();

    // Filtrar por Zed
    component.selectedCounter.set('Zed');
    fixture.detectChanges();

    expect(component.filteredRivales().length).toBe(1);
    const filteredTiles = nativeElement.querySelectorAll('.cf-card--counters .d-alt4__tile');
    expect(filteredTiles.length).toBe(1);
    expect(filteredTiles[0].querySelector('img')?.getAttribute('title')).toBe('Zed');

    // Resetear filtro
    component.selectedCounter.set('');
    fixture.detectChanges();
    expect(nativeElement.querySelectorAll('.cf-card--counters .d-alt4__tile').length).toBe(4);
  });

  it('enseña mensaje vacío si se selecciona un campeón sin sinergias o counters registrados', () => {
    component.selectedSinergia.set('CampeonInexistente');
    fixture.detectChanges();

    const emptyMsg = nativeElement.querySelector('.cf-card--sinergias .d-common-empty');
    expect(emptyMsg?.textContent).toContain('No hay datos de sinergia registrados');

    component.selectedCounter.set('CampeonInexistente');
    fixture.detectChanges();

    const emptyCounterMsg = nativeElement.querySelector('.cf-card--counters .d-common-empty');
    expect(emptyCounterMsg?.textContent).toContain('No hay datos de enfrentamientos registrados');
  });

  it('enseña especialistas con barras y burbujas, y Turbo sin burbujas', () => {
    const rows = nativeElement.querySelectorAll('.cf-espec-row');
    expect(rows.length).toBe(3);

    // N1ght (83%) should have 6 bubbles
    const n1ghtBubbles = rows[0].querySelectorAll('.cf-bubble');
    expect(n1ghtBubbles.length).toBe(6);

    // Kaori (50%) should have 6 bubbles
    const kaoriBubbles = rows[1].querySelectorAll('.cf-bubble');
    expect(kaoriBubbles.length).toBe(6);

    // Turbo (0%) should have 0 bubbles
    const turboBubbles = rows[2].querySelectorAll('.cf-bubble');
    expect(turboBubbles.length).toBe(0);
  });

  it('enseña la tira de runas sin texto de nombres y con recordText al pie', () => {
    const recordText = nativeElement.querySelector('.b-alt4__record-text');
    expect(recordText?.textContent).toContain('En 7 de 12 partidas · 57% de victorias');

    const keystone = nativeElement.querySelector('.b-alt4__keystone');
    expect(keystone).toBeTruthy();

    const shards = nativeElement.querySelectorAll('.b-alt4__shard');
    expect(shards.length).toBe(3);
  });

  it('enseña el orden de habilidades Q > W > E', () => {
    const skillItems = nativeElement.querySelectorAll('.s-alt2__item');
    expect(skillItems.length).toBe(3);

    const keys = nativeElement.querySelectorAll('.s-alt2__key');
    expect(keys[0].textContent?.trim()).toBe('Q');
    expect(keys[1].textContent?.trim()).toBe('W');
    expect(keys[2].textContent?.trim()).toBe('E');
  });
});
