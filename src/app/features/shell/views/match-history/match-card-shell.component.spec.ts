import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { GameDataStore } from '../../../../core/game-data';
import { matchFixture, participantFixture } from '../../../../core/matches/match-fixtures';
import { Match } from '../../../../core/matches/models';
import { Viewport } from '../../../../shared/viewport';
import { MatchCardShellComponent } from './match-card-shell.component';
import { MatchHistoryUiState } from './match-history-ui';

const yo = participantFixture({ id: 'me', team: 'blue', riotId: 'N1ghtfang#LAN' });
const otro = participantFixture({ id: 'foe', team: 'red', riotId: 'Pix3lQueen#LAN' });

const MATCH: Match = matchFixture({
  id: 'm1',
  blue: [yo],
  red: [otro],
  userParticipant: yo,
});

@Component({
  standalone: true,
  imports: [MatchCardShellComponent],
  template: `
    <app-match-card-shell [match]="match" accent="win">
      <div class="fila">contenido de la fila</div>
    </app-match-card-shell>
  `,
})
class HostPorDefecto {
  readonly match = MATCH;
}

@Component({
  standalone: true,
  imports: [MatchCardShellComponent],
  template: `
    <app-match-card-shell [match]="match" accent="win" panelNoun="comparativa">
      <div class="fila">contenido de la fila</div>
      <div matchAccordion class="propio">desglose propio</div>
    </app-match-card-shell>
  `,
})
class HostConDesglosePropio {
  readonly match = MATCH;
}

/**
 * El acordeón pasó de incrustar `<app-match-lineup>` a una ranura con contenido por defecto,
 * para que el historial cruzado pueda proyectar su comparativa. Estas dos pruebas fijan las dos
 * mitades de ese contrato: si la ranura dejase de caer en su contenido por defecto, el
 * historial personal y el de grupo se quedarían con un desplegable vacío y nada lo diría.
 */
describe('MatchCardShellComponent · ranura del acordeón', () => {
  async function montar<T>(host: new () => T) {
    await TestBed.configureTestingModule({
      imports: [host as never],
      providers: [
        provideRouter([]),
        MatchHistoryUiState,
        {
          provide: GameDataStore,
          useValue: {
            status: signal('ready'),
            championById: signal(new Map()),
            ensureLoaded: () => {},
          },
        },
        // Con ratón la fila entera es el control; así se puede desplegar desde ella.
        { provide: Viewport, useValue: { isMobile: signal(false), isNarrow: signal(false) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLElement>('.m-card__main')!.click();
    fixture.detectChanges();

    return el;
  }

  it('sin nada proyectado despliega la alineación de siempre', async () => {
    const el = await montar(HostPorDefecto);

    expect(el.querySelector('.m-card__accordion')).not.toBeNull();
    expect(el.querySelector('app-match-lineup')).not.toBeNull();
  });

  it('con un desglose proyectado lo usa en lugar de la alineación', async () => {
    const el = await montar(HostConDesglosePropio);

    expect(el.querySelector('.propio')?.textContent).toBe('desglose propio');
    expect(el.querySelector('app-match-lineup')).toBeNull();
  });
});
