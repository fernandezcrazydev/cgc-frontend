/**
 * Per-group player perks — short, curated labels an owner/admin pins on a member
 * to capture their gamestyle beyond raw elo/roles ("buen conocimiento del juego",
 * "rager", "afk farmer"…). The assignments live in GroupStore (per group + member
 * tag); this module only defines the fixed catalogue and how each perk renders.
 *
 * Each perk carries a `tone` that drives its badge colour and, later, a numeric
 * bias the matchmaking/balance step can read (e.g. avoid stacking two ragers).
 */
import { NfBadgeColor } from '../ui';

export type PerkTone = 'good' | 'bad' | 'neutral';

export interface Perk {
  /** Stable id stored in the assignments (never shown). */
  id: string;
  /** Spanish label shown in the chip/badge. */
  label: string;
  /** Emoji/symbol prefix for the chip. */
  glyph: string;
  tone: PerkTone;
}

/** Fixed, curated catalogue. Extend here — ids are the persisted contract. */
export const PERK_CATALOG: Perk[] = [
  { id: 'game-knowledge', label: 'Buen conocimiento del juego', glyph: '🧠', tone: 'good' },
  { id: 'shotcaller',     label: 'Shotcaller',                  glyph: '📣', tone: 'good' },
  { id: 'clutch',         label: 'Clutch',                      glyph: '🔥', tone: 'good' },
  { id: 'flex',           label: 'Flexible de roles',           glyph: '🔁', tone: 'good' },
  { id: 'positive',       label: 'Buen ambiente',               glyph: '😎', tone: 'good' },
  { id: 'rager',          label: 'Rager',                       glyph: '😡', tone: 'bad' },
  { id: 'afk-farmer',     label: 'AFK farmer',                  glyph: '🌾', tone: 'bad' },
  { id: 'troller',        label: 'Troll / inting',              glyph: '🤡', tone: 'bad' },
  { id: 'tilteable',      label: 'Se tiltea fácil',             glyph: '📉', tone: 'bad' },
  { id: 'one-trick',      label: 'One-trick',                   glyph: '🎯', tone: 'neutral' },
  { id: 'early-game',     label: 'Fuerte en early',             glyph: '⏱', tone: 'neutral' },
  { id: 'late-game',      label: 'Fuerte en late',              glyph: '🌙', tone: 'neutral' },
];

/** Tone → nf-badge colour, so positives read green and ragers read red. */
export const PERK_COLOR: Record<PerkTone, NfBadgeColor> = {
  good: 'green',
  bad: 'red',
  neutral: 'yellow',
};

/** Spanish heading for each tone, used to group chips in the editor. */
export const PERK_TONE_LABEL: Record<PerkTone, string> = {
  good: 'POSITIVOS',
  bad: 'NEGATIVOS',
  neutral: 'NEUTROS',
};

/** Render order of the tone sections. */
export const PERK_TONES: PerkTone[] = ['good', 'bad', 'neutral'];

const BY_ID = new Map(PERK_CATALOG.map((p) => [p.id, p]));

/** Look up a perk by id (undefined if it's no longer in the catalogue). */
export function perkById(id: string): Perk | undefined {
  return BY_ID.get(id);
}

/** Resolve a list of stored ids to catalogue perks, dropping unknown ones. */
export function perksFromIds(ids: readonly string[]): Perk[] {
  return ids.map((id) => BY_ID.get(id)).filter((p): p is Perk => !!p);
}
