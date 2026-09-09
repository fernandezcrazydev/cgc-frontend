import { Injectable, inject } from '@angular/core';
import { GroupsStore } from '../../../../core/groups';
import { GroupStore } from '../../../../core/group-store';

/**
 * «¿Estoy yo en este grupo?», que es la pregunta de la que cuelgan dos decisiones del perfil y
 * que tiene que responderse igual en las dos.
 *
 * Vivía dentro de `ProfileGroupsCard`, y al necesitarla también la gráfica de LP del perfil ajeno
 * había dos caminos: copiarla, o sacarla aquí. Copiada, el día que la regla cambie —cuando exista
 * la visibilidad de grupo, ver la BACKEND NOTE— una de las dos copias se queda vieja y la misma
 * pantalla se contradice: la tarjeta de grupos diciendo «Grupo ajeno» al lado de una gráfica que
 * sí enseña su LP.
 *
 * Las dos fuentes son opcionales a propósito: un test que monte solo la tarjeta no tiene por qué
 * proveer los stores, y sin ellos la respuesta correcta es «no soy miembro».
 *
 * BACKEND NOTE: hoy se contesta cruzando contra los grupos del usuario en sesión, que es lo único
 * que se puede saber en cliente. La regla definitiva es la **visibilidad del grupo**
 * (`Roadmap.md` §5.5.14: grupo público o cerrado), que el backend todavía no modela: no hay campo
 * de visibilidad en `GroupResponse`, `GroupSearchResult` ni en el `Group` de `lobby.ts`. Cuando
 * exista, un grupo **público** debe poder enseñar su clasificación aunque tú no estés dentro, y
 * uno **privado** no debe enseñarla ni aunque el jugador que miras esté en él.
 */
@Injectable({ providedIn: 'root' })
export class SharedGroups {
  private readonly real = inject(GroupsStore, { optional: true });
  private readonly mock = inject(GroupStore, { optional: true });

  /** ¿Está el usuario en sesión dentro de este grupo? */
  has(groupId: string): boolean {
    const inReal = this.real?.groups().some((g) => g.id === groupId) ?? false;
    const inMock = this.mock?.groups().some((g) => g.id === groupId) ?? false;
    return inReal || inMock;
  }
}
