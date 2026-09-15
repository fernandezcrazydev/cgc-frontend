import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { NfAvatar, NfButton, NfSkeleton } from '../../../../ui';
import { Session } from '../../../../core/auth';
import { GroupsStore } from '../../../../core/groups';
import { MatchComment, MatchCommentsStore } from '../../../../core/matches';
import { errorMessage } from '../../../../core/http';
import { ToastService } from '../../../../core/toast';
import { hueFromId } from '../../../../shared/avatar-bg';
import { formatLongDate, formatRelativeTime } from '../../../../shared/date-format';

/** Lo que el backend acepta como comentario, medido después de recortar espacios. */
const MAX_LENGTH = 500;

/**
 * El hilo de comentarios de una partida (`cgc-backend#97`).
 *
 * Existió como maqueta —dos comentarios escritos a mano, los mismos en todas las partidas— y se
 * borró al conectar la pantalla al API. Vuelve con las tres reglas de producto que traía, y las
 * tres se notan en esta plantilla antes que en ninguna petición:
 *
 * 1. **Solo los diez que jugaron escriben.** Quien no está entre ellos ve el hilo y una frase que
 *    lo explica, no un formulario que va a devolver 403. Es la misma regla que la pantalla de
 *    Reparto: no se ofrece una puerta cerrada.
 * 2. **Uno por jugador.** En cuanto el hilo contiene el tuyo, la caja desaparece. No hace falta
 *    preguntárselo al servidor: si estás en el hilo, ya comentaste.
 * 3. **Inmutable.** No hay botón de editar y el de borrar solo sale para quien administra el
 *    grupo — tampoco para el autor. Esa asimetría es el sentido de la funcionalidad entera, así
 *    que se dice en voz alta debajo de la caja en vez de descubrirse al intentarlo.
 *
 * **Los permisos de cliente son solo UX**: el backend decide y responde 403/409 igualmente. Lo que
 * se evita aquí es ofrecer acciones que no pueden salir bien.
 */
@Component({
  selector: 'app-match-comments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfAvatar, NfButton, NfSkeleton],
  templateUrl: './match-comments.component.html',
  styleUrl: './match-comments.component.scss',
})
export class MatchCommentsComponent {
  protected readonly comments = inject(MatchCommentsStore);
  private readonly session = inject(Session);
  private readonly groups = inject(GroupsStore);
  private readonly toasts = inject(ToastService);

  readonly matchId = input.required<string>();
  /** De qué grupo es la partida, para saber si quien mira puede moderar. `null` no modera. */
  readonly groupId = input<string | null>(null);
  /** Los diez que la jugaron. Decide si se pinta la caja de texto. */
  readonly participantIds = input<readonly string[]>([]);

  protected readonly maxLength = MAX_LENGTH;
  protected readonly skeletonRows = [1, 2];

  protected readonly draft = signal('');

  protected readonly thread = this.comments.comments;
  protected readonly alreadyCommented = this.comments.alreadyCommented;
  protected readonly myUserId = computed(() => this.session.user()?.userId ?? null);

  protected readonly iPlayed = computed(() => {
    const me = this.myUserId();
    return !!me && this.participantIds().includes(me);
  });

  protected readonly canWrite = computed(
    () => this.comments.status() === 'ready' && this.iPlayed() && !this.alreadyCommented(),
  );

  /**
   * Si quien mira administra el grupo de la partida. Sale de `/me/groups`, que esta sesión ya
   * tiene cargado y que solo contiene grupos suyos — que es justo la condición para ver la
   * partida, así que no hace falta pedir nada.
   */
  protected readonly canModerate = computed(() => {
    const id = this.groupId();
    if (!id) return false;
    const role = this.groups.groups().find((group) => group.id === id)?.role;
    return role === 'OWNER' || role === 'ADMIN';
  });

  protected readonly remaining = computed(() => MAX_LENGTH - this.draft().trim().length);

  protected readonly canSubmit = computed(
    () => !this.comments.saving() && this.draft().trim().length > 0 && this.remaining() >= 0,
  );

  constructor() {
    this.groups.ensureLoaded();

    effect(() => {
      const id = this.matchId();
      if (!id) return;
      // `untracked` por el mismo motivo que en el resto de vistas: los métodos del store leen sus
      // propias signals de estado, y llamarlos dentro del efecto lo suscribiría a lo que él mismo
      // escribe. La única dependencia debe ser el id de la partida.
      untracked(() => {
        this.draft.set('');
        void this.comments.ensureLoaded(id);
      });
    });
  }

  protected authorName(comment: MatchComment): string {
    // Sin nombre es una cuenta borrada, no un dato que falte por llegar: lo que dijo esa persona
    // sobrevive a su cuenta, así que la línea se queda y quien la firma deja de tener nombre.
    return comment.discordUsername ?? 'Cuenta eliminada';
  }

  protected tintOf(userId: string): number {
    return hueFromId(userId);
  }

  protected relative(iso: string): string {
    return formatRelativeTime(iso);
  }

  protected longDate(iso: string): string {
    return formatLongDate(iso);
  }

  protected onDraft(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  protected retry(): void {
    void this.comments.reload(this.matchId());
  }

  /**
   * Pesimista y no reentrante: el botón se apaga mientras viaja, y el comentario aparece cuando el
   * servidor confirma. El texto que se pinta es el que él devuelve, no el que se escribió — viene
   * recortado.
   */
  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    try {
      await this.comments.leave(this.matchId(), this.draft().trim());
      this.draft.set('');
      this.toasts.success('Publicado. Ya no se puede editar.');
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  protected async remove(commentId: string): Promise<void> {
    if (this.comments.deleting()) return;
    try {
      await this.comments.remove(this.matchId(), commentId);
      this.toasts.success('Comentario retirado');
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }
}
