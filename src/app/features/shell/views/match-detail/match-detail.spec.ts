import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatchDetail } from './match-detail';

describe('MatchDetail', () => {
  let fixture: ComponentFixture<MatchDetail>;
  let component: MatchDetail;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchDetail],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MatchDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('inicializa con la pestaña de scoreboard activa', () => {
    expect(component.activeMainTab()).toBe('scoreboard');
  });

  it('el slider de visión tiene 3 diapositivas', () => {
    expect(component.visionSlides.length).toBe(3);
    expect(component.visionSlides[0].id).toBe('placed');
    expect(component.visionSlides[1].id).toBe('killed');
    expect(component.visionSlides[2].id).toBe('pinks');
  });

  it('permite avanzar y retroceder en el slider de visión', () => {
    component.nextVision();
    expect(component.activeVisionIndex()).toBe(1);
    component.prevVision();
    expect(component.activeVisionIndex()).toBe(0);
  });

  it('sincroniza el hover entre radar y grieta', () => {
    component.setHoveredObjective('baron');
    expect(component.hoveredObjectiveId()).toBe('baron');
    component.setHoveredObjective(null);
    expect(component.hoveredObjectiveId()).toBeNull();
  });

  it('el podio de daño a campeones contiene los 3 primeros puestos', () => {
    expect(component.topDamagePodium.length).toBe(3);
    expect(component.topDamagePodium[0].rank).toBe(1);
    expect(component.topDamagePodium[0].player).toBe('Adri_LoL');
  });

  it('permite publicar comentarios inmutables respetando el límite', () => {
    const initialCount = component.comments().length;
    component.newCommentText.set('¡Partida inolvidable en la final!');
    component.postComment();
    expect(component.comments().length).toBe(initialCount + 1);
    expect(component.comments()[0].text).toBe('¡Partida inolvidable en la final!');
    expect(component.newCommentText()).toBe('');
  });

  it('permite alternar reacciones emoji en los comentarios', () => {
    const commentId = component.comments()[0].id;
    component.toggleCommentReaction(commentId, '🔥');
    const comment = component.comments().find((c) => c.id === commentId);
    expect(comment).toBeDefined();
  });

  it('calcula las opciones de pestañas según la participación del usuario', () => {
    const opts = component.mainTabOptions();
    expect(opts.some((o) => o.value === 'heatmap')).toBe(true);
    if (component.userParticipated()) {
      expect(opts.some((o) => o.value === 'performance')).toBe(true);
    } else {
      expect(opts.some((o) => o.value === 'performance')).toBe(false);
    }
  });

  it('el mapa de calor táctico genera puntos y pines deterministas para el jugador activo', () => {
    const data = component.heatmapData();
    expect(data.points.length).toBeGreaterThan(0);
    expect(data.pins.length).toBeGreaterThan(0);
    expect(data.pathD).toBeTruthy();
  });

  it('permite conmutar la fase del mapa de calor y el jugador activo', () => {
    component.setHeatmapPhase('early');
    expect(component.heatmapPhase()).toBe('early');
    expect(component.filteredHeatPoints().every((p) => p.phase === 'early')).toBe(true);

    const all = component.allParticipants();
    if (all.length > 1) {
      component.setHeatmapPlayer(all[1].id);
      expect(component.selectedHeatmapPlayerId()).toBe(all[1].id);
      expect(component.activeHeatmapPlayer()?.id).toBe(all[1].id);
    }
  });

  it('identifica correctamente si la partida tiene telemetría de scraper o registro manual', () => {
    const isManual = component.match()?.source === 'manual';
    expect(component.hasDetailedStats()).toBe(!isManual);
  });

  it('permite alternar entre los modos de presencia térmica y control de visión', () => {
    expect(component.mapAnalysisMode()).toBe('presence');
    component.setAnalysisMode('vision');
    expect(component.mapAnalysisMode()).toBe('vision');
    component.setAnalysisMode('presence');
    expect(component.mapAnalysisMode()).toBe('presence');
  });

  it('calcula el desglose zonal del jugador activo según su rol', () => {
    const breakdown = component.playerZoneBreakdown();
    expect(breakdown).toBeDefined();
    expect(breakdown.mainLane.minutes).toBeGreaterThan(0);
    expect(breakdown.objectives.minutes).toBeGreaterThan(0);
    expect(breakdown.diagnosisBadge).toBeTruthy();
    expect(breakdown.diagnosisText).toBeTruthy();
  });

  it('filtra los centinelas de visión por equipo y tipo', () => {
    component.setVisionTeam('blue');
    expect(component.visionTeam()).toBe('blue');
    const blueWards = component.filteredVisionWards();
    expect(blueWards.every((w) => w.team === 'blue')).toBe(true);

    component.togglePinkWards();
    expect(component.showPinkWards()).toBe(false);
    const onlyYellow = component.filteredVisionWards();
    expect(onlyYellow.every((w) => w.type === 'yellow')).toBe(true);

    component.togglePinkWards();
    expect(component.showPinkWards()).toBe(true);

    component.toggleYellowWards();
    expect(component.showYellowWards()).toBe(false);
    const onlyPink = component.filteredVisionWards();
    expect(onlyPink.every((w) => w.type === 'pink')).toBe(true);

    component.toggleYellowWards();
    component.setVisionTeam('both');
    expect(component.filteredVisionWards().length).toBe(component.allVisionWards.length);
  });

  it('calcula las métricas de control territorial de visión de ambos bandos', () => {
    component.setVisionTeam('blue');
    const blueMetrics = component.visionMetrics();
    expect(blueMetrics).toBeDefined();
    expect(blueMetrics.riverControl).toBeGreaterThan(0);
    expect(blueMetrics.dragonControl).toBeGreaterThan(0);
    expect(blueMetrics.mvpName).toBe('Sam_Sup');
    expect(blueMetrics.mvpScore).toBe(68);

    component.setVisionTeam('red');
    const redMetrics = component.visionMetrics();
    expect(redMetrics.riverControl).toBe(44);
    expect(redMetrics.mvpName).toBe('Lulu_King');
  });

  it('permite fijar e inspeccionar el centinela hovered', () => {
    const sampleWard = component.allVisionWards[0];
    component.setHoveredWard(sampleWard);
    expect(component.hoveredWard()).toEqual(sampleWard);
    component.setHoveredWard(null);
    expect(component.hoveredWard()).toBeNull();
  });
});
