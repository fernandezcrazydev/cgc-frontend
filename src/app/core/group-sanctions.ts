/**
 * Panel de sanciones del grupo — PLACEHOLDER DESECHABLE.
 *
 * Todo lo de aquí es maqueta determinista sembrada por el id del grupo.
 *
 * BACKEND NOTE: al migrar, las sanciones se gestionan con:
 *   - `GET /groups/{id}/sanctions`             → lista de sanciones activas e histórico
 *   - `POST /groups/{id}/sanctions`            → poner sanción manual (ban)
 *   - `DELETE /groups/{id}/sanctions/{id}`     → levantar sanción (solo árbitro)
 *   - `POST /groups/{id}/sanctions/{id}/appeal` → pedir revisión (solo sancionado)
 */
import { Injectable, Signal, computed, signal } from '@angular/core';
import { hash, seeded } from './group-ranking';
import { Member } from './lobby';

export type SanctionKind = 'AUTO_LP' | 'BAN';
export type SanctionScope = 'LEAGUE' | 'ALL_LEAGUES';
export type SanctionStatus = 'ACTIVE' | 'LIFTED' | 'SERVED';

export interface SanctionAppeal {
  text: string;        // 300 caracteres como mucho
  at: number;          // epoch ms
  byUserId: string;
  byName: string;
}

export interface GroupSanction {
  id: string;                      // `snc-${groupId}-${n}`
  kind: SanctionKind;
  targetUserId: string;
  targetName: string;
  targetAvatar: string | null;
  targetHue: number;
  lpDelta: number | null;          // solo AUTO_LP: -5 o -10
  days: number | null;             // solo BAN
  scope: SanctionScope;            // AUTO_LP siempre 'LEAGUE'
  modality: 'Competitivo' | 'Equilibrado' | 'Caos';
  seasonId: string | null;         // null = la temporada en curso
  seasonName: string | null;
  reason: string;
  roomId: string | null;           // solo AUTO_LP por abandono: pinta ` · Sala #4092`
  byUserId: string | null;         // null = el sistema
  byName: string | null;
  byRole: 'árbitro' | 'propietario' | null;
  createdAt: number;
  endsAt: number | null;
  status: SanctionStatus;
  liftedByName: string | null;
  liftedAt: number | null;
  appeal: SanctionAppeal | null;
}

const AUTO_REASONS = [
  'Abandonó la partida en curso',
  'No apareció a la convocatoria',
  'Desconexión sin aviso previo',
  'Abandono injustificado durante la partida',
];

const BAN_REASONS = [
  'Tercer abandono esta semana',
  'Conducta antideportiva reiterada',
  'Falta de respeto grave en el chat',
  'Inactividad prolongada en partidas asignadas',
  'Toxicidad reiterada durante la competición',
];

const MODALITIES: readonly ('Competitivo' | 'Equilibrado' | 'Caos')[] = [
  'Competitivo',
  'Equilibrado',
  'Caos',
];

export function sanctionsFor(
  groupId: string,
  roster: readonly Member[],
  seasons: readonly { id: string; name: string; status: string }[],
  currentUserId: string | null,
): GroupSanction[] {
  // Sin roster no se siembra NADA. Antes caía a un roster inventado, y eso hacía que la pantalla
  // enseñara sanciones de cinco personas que no eran del grupo en cuanto se entraba por enlace
  // directo, porque el roster mock lo llena `GroupBridge` y la vista no lo pedía. Una pantalla
  // vacía es correcta mientras el puente viaja; una que se inventa a los sancionados, no.
  if (roster.length === 0) return [];

  const rnd = seeded(hash(groupId + ':sanctions'));
  const effectiveRoster = roster;

  const finishedSeasons = seasons.filter((s) => s.status === 'FINISHED');
  const now = Date.now();

  const currentUserMember = currentUserId
    ? effectiveRoster.find((m) => m.userId === currentUserId) ?? null
    : null;

  const otherMembers = currentUserMember
    ? effectiveRoster.filter((m) => m.userId !== currentUserMember.userId)
    : effectiveRoster;

  const m1 = currentUserMember ?? effectiveRoster[0];
  const m2 = otherMembers[0] ?? effectiveRoster[Math.min(1, effectiveRoster.length - 1)];
  const m3 = otherMembers[1] ?? effectiveRoster[Math.min(2, effectiveRoster.length - 1)];

  // Árbitro o owner para quien puso la sanción
  const adminMember = effectiveRoster.find((m) => m.role === 'ADMIN') ?? effectiveRoster[0];

  // 1. Primera activa: del usuario actual si está, AUTO_LP
  const active1: GroupSanction = {
    id: `snc-${groupId}-act-1`,
    kind: 'AUTO_LP',
    targetUserId: m1.userId ?? 'u-1',
    targetName: m1.name,
    targetAvatar: m1.avatar ?? null,
    targetHue: m1.hue ?? 0,
    lpDelta: -10,
    days: null,
    scope: 'LEAGUE',
    modality: 'Caos',
    seasonId: null,
    seasonName: null,
    reason: 'Abandonó la partida en curso',
    roomId: '4092',
    byUserId: null,
    byName: null,
    byRole: null,
    createdAt: now - 12 * 60_000, // hace 12 min
    endsAt: null,
    status: 'ACTIVE',
    liftedByName: null,
    liftedAt: null,
    appeal: null,
  };

  // 2. Segunda activa: BAN con solicitud de revisión (appeal) ya enviada
  const active2: GroupSanction = {
    id: `snc-${groupId}-act-2`,
    kind: 'BAN',
    targetUserId: m2.userId ?? 'u-2',
    targetName: m2.name,
    targetAvatar: m2.avatar ?? null,
    targetHue: m2.hue ?? 0,
    lpDelta: null,
    days: 7,
    scope: 'ALL_LEAGUES',
    modality: 'Competitivo',
    seasonId: null,
    seasonName: null,
    reason: 'Tercer abandono esta semana',
    roomId: null,
    byUserId: adminMember.userId ?? null,
    byName: adminMember.name,
    byRole: 'árbitro',
    createdAt: now - 2 * 86_400_000,
    endsAt: now + 5 * 86_400_000,
    status: 'ACTIVE',
    liftedByName: null,
    liftedAt: null,
    appeal: {
      text: 'Se me cayó el internet a mitad de la partida, no fue a posta. Llevo dos meses sin fallar a nada.',
      at: now - 2 * 3600_000,
      byUserId: m2.userId ?? 'u-2',
      byName: m2.name,
    },
  };

  // 3. Tercera activa: AUTO_LP
  const active3: GroupSanction = {
    id: `snc-${groupId}-act-3`,
    kind: 'AUTO_LP',
    targetUserId: m3.userId ?? 'u-3',
    targetName: m3.name,
    targetAvatar: m3.avatar ?? null,
    targetHue: m3.hue ?? 0,
    lpDelta: -5,
    days: null,
    scope: 'LEAGUE',
    modality: 'Equilibrado',
    seasonId: null,
    seasonName: null,
    reason: 'No apareció a la convocatoria',
    roomId: null,
    byUserId: null,
    byName: null,
    byRole: null,
    createdAt: now - 86_400_000, // ayer
    endsAt: null,
    status: 'ACTIVE',
    liftedByName: null,
    liftedAt: null,
    appeal: null,
  };

  const actives = [active1, active2, active3].sort((a, b) => b.createdAt - a.createdAt);

  // Histórico: entre 6 y 10 sanciones
  const historyCount = 6 + Math.floor(rnd() * 5);
  const history: GroupSanction[] = [];

  for (let i = 0; i < historyCount; i++) {
    const isBan = rnd() < 0.45;
    const target = effectiveRoster[Math.floor(rnd() * effectiveRoster.length)];
    const modality = MODALITIES[Math.floor(rnd() * MODALITIES.length)];
    const finishedSeason = finishedSeasons.length > 0
      ? finishedSeasons[Math.floor(rnd() * finishedSeasons.length)]
      : null;

    const daysAgo = 4 + Math.floor(rnd() * 30);
    const createdAt = now - daysAgo * 86_400_000;
    const isLifted = isBan && rnd() < 0.5;

    if (isBan) {
      const days = [1, 3, 7, 14][Math.floor(rnd() * 4)];
      const scope: SanctionScope = rnd() < 0.5 ? 'ALL_LEAGUES' : 'LEAGUE';
      const reason = BAN_REASONS[Math.floor(rnd() * BAN_REASONS.length)];
      const author = effectiveRoster[Math.floor(rnd() * effectiveRoster.length)];
      const authorRole = author.role === 'OWNER' ? 'propietario' : 'árbitro';

      history.push({
        id: `snc-${groupId}-hist-${i + 1}`,
        kind: 'BAN',
        targetUserId: target.userId ?? `u-target-${i}`,
        targetName: target.name,
        targetAvatar: target.avatar ?? null,
        targetHue: target.hue ?? 0,
        lpDelta: null,
        days,
        scope,
        modality,
        seasonId: finishedSeason?.id ?? null,
        seasonName: finishedSeason?.name ?? null,
        reason,
        roomId: null,
        byUserId: author.userId ?? null,
        byName: author.name,
        byRole: authorRole,
        createdAt,
        endsAt: createdAt + days * 86_400_000,
        status: isLifted ? 'LIFTED' : 'SERVED',
        liftedByName: isLifted ? (adminMember.name ?? 'Victor') : null,
        liftedAt: isLifted ? createdAt + 2 * 86_400_000 : null,
        appeal: null,
      });
    } else {
      const lpDelta = rnd() < 0.6 ? -5 : -10;
      const reason = AUTO_REASONS[Math.floor(rnd() * AUTO_REASONS.length)];
      history.push({
        id: `snc-${groupId}-hist-${i + 1}`,
        kind: 'AUTO_LP',
        targetUserId: target.userId ?? `u-target-${i}`,
        targetName: target.name,
        targetAvatar: target.avatar ?? null,
        targetHue: target.hue ?? 0,
        lpDelta,
        days: null,
        scope: 'LEAGUE',
        modality,
        seasonId: finishedSeason?.id ?? null,
        seasonName: finishedSeason?.name ?? null,
        reason,
        roomId: lpDelta === -10 ? '4012' : null,
        byUserId: null,
        byName: null,
        byRole: null,
        createdAt,
        endsAt: createdAt,
        status: 'SERVED',
        liftedByName: null,
        liftedAt: null,
        appeal: null,
      });
    }
  }

  history.sort((a, b) => b.createdAt - a.createdAt);

  return [...actives, ...history];
}

interface SeedContext {
  roster: readonly Member[];
  seasons: readonly { id: string; name: string; status: string }[];
  currentUserId: string | null;
}

@Injectable({ providedIn: 'root' })
export class GroupSanctionsStore {
  private readonly sanctionsByGroup = signal<Record<string, GroupSanction[]>>({});

  /**
   * Sanciones creadas durante la sesión, aparte de la lista sembrada.
   *
   * Están separadas porque quien las crea no siempre puede reconstruir la semilla del grupo: el
   * modal de decisión arbitral del shell escribe sin roster —no tiene por qué haber abierto el
   * panel de ese grupo— y si la nueva sanción se fusionara con la lista en el momento de crearla,
   * guardaría una lista sembrada desde cero y el grupo perdería todo su histórico. Así la semilla
   * se sigue calculando al leer, y lo nuevo se le pone delante.
   */
  private readonly addedByGroup = signal<Record<string, GroupSanction[]>>({});

  /**
   * Con qué se sembró por última vez cada grupo.
   *
   * Existe por un fallo que costó la lista entera: las escrituras reconstruían la semilla con los
   * argumentos que les pasaran, y los tres sitios que escriben —levantar desde Clasificación,
   * pedir revisión y levantar desde el modal— llamaban sin roster. La primera escritura sobre un
   * grupo guardaba entonces una lista sembrada con un roster vacío, así que pedir una revisión
   * dejaba la pantalla con «ACTIVAS (0)» y «HISTÓRICO (0)».
   *
   * No es una signal a propósito: es una caché de contexto, no estado que nadie tenga que pintar.
   */
  private readonly seedContext = new Map<string, SeedContext>();

  sanctionsOf(
    groupId: string,
    roster: readonly Member[] = [],
    seasons: readonly { id: string; name: string; status: string }[] = [],
    currentUserId: string | null = null,
  ): Signal<GroupSanction[]> {
    if (groupId && roster.length > 0) {
      this.seedContext.set(groupId, { roster, seasons, currentUserId });
    }
    return computed(() => {
      if (!groupId) return [];
      const stored = this.sanctionsByGroup()[groupId];
      const base = stored ?? sanctionsFor(groupId, roster, seasons, currentUserId);
      const added = this.addedByGroup()[groupId];
      return added?.length ? [...added, ...base] : base;
    });
  }

  /**
   * La lista sobre la que escribe cualquier mutación: la almacenada, o la semilla reconstruida
   * con el contexto con el que la pantalla la pintó. Nunca con un roster vacío.
   */
  private baseline(
    groupId: string,
    roster: readonly Member[],
    seasons: readonly { id: string; name: string; status: string }[],
    currentUserId: string | null,
    stored: Record<string, GroupSanction[]>,
  ): GroupSanction[] {
    const current = stored[groupId];
    if (current !== undefined) return current;
    const ctx = this.seedContext.get(groupId);
    return sanctionsFor(
      groupId,
      roster.length > 0 ? roster : ctx?.roster ?? [],
      seasons.length > 0 ? seasons : ctx?.seasons ?? [],
      currentUserId ?? ctx?.currentUserId ?? null,
    );
  }

  lift(
    groupId: string,
    sanctionId: string,
    byName: string,
    roster: readonly Member[] = [],
    seasons: readonly { id: string; name: string; status: string }[] = [],
    currentUserId: string | null = null,
  ): void {
    this.sanctionsByGroup.update((all) => {
      const current = this.baseline(groupId, roster, seasons, currentUserId, all);
      const updated = current.map((s) => {
        if (s.id !== sanctionId) return s;
        return {
          ...s,
          status: 'LIFTED' as SanctionStatus,
          liftedByName: byName,
          liftedAt: Date.now(),
        };
      });
      return {
        ...all,
        [groupId]: updated,
      };
    });
    // Una sanción creada en esta sesión vive en la otra lista, y levantarla tiene que funcionar
    // igual que levantar una sembrada.
    this.addedByGroup.update((all) => {
      const current = all[groupId];
      if (!current) return all;
      return {
        ...all,
        [groupId]: current.map((s) =>
          s.id === sanctionId
            ? { ...s, status: 'LIFTED' as SanctionStatus, liftedByName: byName, liftedAt: Date.now() }
            : s,
        ),
      };
    });
  }

  appeal(
    groupId: string,
    sanctionId: string,
    appeal: SanctionAppeal,
    roster: readonly Member[] = [],
    seasons: readonly { id: string; name: string; status: string }[] = [],
    currentUserId: string | null = null,
  ): void {
    this.sanctionsByGroup.update((all) => {
      const current = this.baseline(groupId, roster, seasons, currentUserId, all);
      const updated = current.map((s) => {
        if (s.id !== sanctionId) return s;
        if (s.appeal) return s; // Una sola por sanción: no se repite
        return {
          ...s,
          appeal,
        };
      });
      return {
        ...all,
        [groupId]: updated,
      };
    });
    this.addedByGroup.update((all) => {
      const current = all[groupId];
      if (!current) return all;
      return {
        ...all,
        [groupId]: current.map((s) => (s.id === sanctionId && !s.appeal ? { ...s, appeal } : s)),
      };
    });
  }

  recordSanction(
    groupId: string,
    sanction: Omit<GroupSanction, 'id' | 'createdAt' | 'status' | 'liftedByName' | 'liftedAt' | 'appeal'>,
    roster: readonly Member[] = [],
    seasons: readonly { id: string; name: string; status: string }[] = [],
    currentUserId: string | null = null,
  ): void {
    const now = Date.now();
    const newSanction: GroupSanction = {
      ...sanction,
      id: `snc-${groupId}-${now}`,
      createdAt: now,
      status: 'ACTIVE',
      liftedByName: null,
      liftedAt: null,
      appeal: null,
    };
    this.addedByGroup.update((all) => ({
      ...all,
      [groupId]: [newSanction, ...(all[groupId] ?? [])],
    }));
  }
}
