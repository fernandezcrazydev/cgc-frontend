import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { PerfilMiembro } from './perfil-miembro';
import { GroupStore } from '../../../core/group-store';
import { GameDataStore } from '../../../core/game-data';
import { Session } from '../../../core/auth';
import { signal } from '@angular/core';

describe('PerfilMiembro Component', () => {
  it('should initialize and compute member profile with H2H when user found', async () => {
    await TestBed.configureTestingModule({
      imports: [PerfilMiembro],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => 'Pix3lQueen#LAN' } },
            paramMap: of({ get: () => 'Pix3lQueen#LAN' }),
          },
        },
        {
          provide: GroupStore,
          useValue: {
            groups: signal([]),
            rosterOf: () => [],
          },
        },
        {
          provide: GameDataStore,
          useValue: {
            status: signal('ready'),
            championById: signal(new Map()),
          },
        },
        {
          provide: Session,
          useValue: {
            displayName: signal('User'),
            status: signal('ready'),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PerfilMiembro);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    expect(comp).toBeDefined();
    expect(comp.userId()).toBe('Pix3lQueen#LAN');
    expect(comp.profile()).not.toBeNull();
    expect(comp.profile()?.name).toBe('Pix3lQueen');
  });
});
