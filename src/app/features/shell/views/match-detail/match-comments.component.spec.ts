import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { Session } from '../../../../core/auth';
import { GroupsStore } from '../../../../core/groups';
import { MatchCommentsStore } from '../../../../core/matches';
import { MatchComment } from '../../../../core/matches/models';
import { ToastService } from '../../../../core/toast';
import { MatchCommentsComponent } from './match-comments.component';

const ME = 'me-uuid';
const OTHER = 'other-uuid';
const MATCH = 'm1';
const GROUP = 'g1';

function comment(id: string, userId: string, text = 'menuda remontada'): MatchComment {
  return {
    id,
    userId,
    discordUsername: 'Ana',
    avatarUrl: null,
    text,
    createdAt: '2026-09-15T21:04:00Z',
  };
}

interface MontarOptions {
  thread?: MatchComment[];
  /** Si el usuario de la sesión está entre los diez. */
  played?: boolean;
  /** El rol que tiene en el grupo de la partida. */
  role?: 'OWNER' | 'ADMIN' | 'MEMBER';
  status?: 'idle' | 'loading' | 'ready' | 'error';
}

/**
 * Las tres reglas de producto del hilo (cgc-backend#97), vistas desde la pantalla.
 *
 * Lo que se prueba aquí no es que el backend refuse —eso es suyo y tiene sus propios tests— sino
 * que **la interfaz no ofrezca puertas cerradas**: quien no jugó no ve caja de texto, quien ya
 * comentó tampoco, y el botón de borrar solo sale para quien administra el grupo. Es la misma
 * decisión que la pantalla de Reparto.
 */
describe('MatchCommentsComponent', () => {
  let fixture: ComponentFixture<MatchCommentsComponent>;
  const leave = vi.fn().mockResolvedValue(comment('c-nuevo', ME));
  const remove = vi.fn().mockResolvedValue(undefined);

  async function montar(options: MontarOptions = {}): Promise<HTMLElement> {
    const thread = options.thread ?? [];
    leave.mockClear();
    remove.mockClear();

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [MatchCommentsComponent],
        providers: [
          { provide: Session, useValue: { user: signal({ userId: ME }) } },
          {
            provide: GroupsStore,
            useValue: {
              groups: signal([{ id: GROUP, role: options.role ?? 'MEMBER' }]),
              ensureLoaded: () => {},
            },
          },
          {
            provide: MatchCommentsStore,
            useValue: {
              comments: signal<readonly MatchComment[]>(thread),
              status: signal(options.status ?? 'ready'),
              saving: signal(false),
              deleting: signal<string | null>(null),
              alreadyCommented: signal(thread.some((c) => c.userId === ME)),
              ensureLoaded: () => Promise.resolve(),
              reload: () => Promise.resolve(),
              leave,
              remove,
            },
          },
          { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        ],
      })
      .compileComponents();

    fixture = TestBed.createComponent(MatchCommentsComponent);
    fixture.componentRef.setInput('matchId', MATCH);
    fixture.componentRef.setInput('groupId', GROUP);
    fixture.componentRef.setInput(
      'participantIds',
      options.played === false ? [OTHER] : [ME, OTHER],
    );
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('sin comentarios, invita a escribir el primero en vez de dejar un hueco', async () => {
    const el = await montar();

    expect(el.textContent).toContain('Todavía no hay comentarios');
  });

  it('pinta el texto y el autor de cada comentario', async () => {
    const el = await montar({ thread: [comment('c1', OTHER, 'el baron del 28')] });

    expect(el.textContent).toContain('el baron del 28');
    expect(el.textContent).toContain('Ana');
  });

  // ── Regla 1: solo los diez que jugaron ────────────────────────────────

  it('quien jugó y no ha comentado ve la caja de texto', async () => {
    const el = await montar({ played: true });

    expect(el.querySelector('textarea')).not.toBeNull();
  });

  it('quien no jugó lee el hilo pero no tiene dónde escribir', async () => {
    const el = await montar({ played: false });

    expect(el.querySelector('textarea')).toBeNull();
    expect(el.textContent).toContain('Esta partida no la jugaste');
  });

  // ── Regla 2: uno por jugador ──────────────────────────────────────────

  it('quien ya comentó deja de ver la caja, y se le dice por qué', async () => {
    const el = await montar({ thread: [comment('c1', ME)] });

    expect(el.querySelector('textarea')).toBeNull();
    expect(el.textContent).toContain('Ya dejaste el tuyo');
  });

  // ── Regla 3: inmutable, salvo borrado de admin ────────────────────────

  /**
   * El autor tampoco borra el suyo, y por eso el botón no aparece ni sobre su propia fila: poder
   * retirarlo es editarlo con pasos de más.
   */
  it('un miembro raso no ve el botón de borrar, ni en su propio comentario', async () => {
    const el = await montar({ thread: [comment('c1', ME)], role: 'MEMBER' });

    expect(el.textContent).not.toContain('Borrar');
  });

  it('un admin del grupo sí lo ve', async () => {
    const el = await montar({ thread: [comment('c1', OTHER)], role: 'ADMIN' });

    expect(el.textContent).toContain('Borrar');
  });

  it('y el owner también, que es admin por jerarquía', async () => {
    const el = await montar({ thread: [comment('c1', OTHER)], role: 'OWNER' });

    expect(el.textContent).toContain('Borrar');
  });

  /** Y dice en voz alta lo que va a pasar ANTES de publicar, no al intentar editarlo después. */
  it('avisa de que no se podrá editar antes de publicar', async () => {
    const el = await montar({ played: true });

    expect(el.textContent).toContain('no se puede editar ni borrar');
  });

  // ── El envío ──────────────────────────────────────────────────────────

  it('no publica un comentario en blanco', async () => {
    await montar({ played: true });
    const component = fixture.componentInstance as unknown as {
      draft: { set: (v: string) => void };
      submit: () => Promise<void>;
    };

    component.draft.set('    ');
    await component.submit();

    expect(leave).not.toHaveBeenCalled();
  });

  /** Se manda recortado: lo que cuenta para el límite de 500 es el texto sin espacios de sobra. */
  it('publica el texto recortado', async () => {
    await montar({ played: true });
    const component = fixture.componentInstance as unknown as {
      draft: { set: (v: string) => void };
      submit: () => Promise<void>;
    };

    component.draft.set('  el baron del 28  ');
    await component.submit();

    expect(leave).toHaveBeenCalledWith(MATCH, 'el baron del 28');
  });

  it('el estado de carga no pinta el hilo de otra partida mientras llega', async () => {
    const el = await montar({ status: 'loading', thread: [comment('c1', OTHER, 'de otra')] });

    expect(el.textContent).not.toContain('de otra');
    expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('un fallo de red ofrece reintentar, que aquí sí tiene sentido', async () => {
    const el = await montar({ status: 'error' });

    expect(el.textContent).toContain('Reintentar');
  });
});
