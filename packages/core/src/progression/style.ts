import { WEAPON_CATALOG, type WeaponClass } from "../items/catalog";
import type { WeaponId } from "../items/types";

/**
 * The player's style (ADR-0059, stage 6): what she fights with. Four kinds of weapon (the
 * shotgun is a kind of its own, the revolver goes with the pistol, the baton and the blade are
 * melee) and two paths, quickhacks and stealth. The loot tables lean towards it.
 */
export type StyleKind = "pistol" | "smg" | "shotgun" | "rifle" | "melee" | "quickhack" | "stealth";

export const STYLE_KINDS: readonly StyleKind[] = ["pistol", "smg", "shotgun", "rifle", "melee", "quickhack", "stealth"];

export const isStyleKind = (v: unknown): v is StyleKind => typeof v === "string" && (STYLE_KINDS as readonly string[]).includes(v);

/**
 * How many fights the style remembers. A fight is one use: an enemy the player defeated (killed
 * or knocked out) with what defeated it, or the first quickhack that landed on a target (the one
 * that pays XP, so a speaker hacked every second counts once).
 */
export const STYLE_WINDOW = 50;

const STYLE_OF_CLASS: Readonly<Record<WeaponClass, StyleKind>> = {
  pistol: "pistol",
  revolver: "pistol",
  smg: "smg",
  shotgun: "shotgun",
  rifle: "rifle",
  baton: "melee",
  blade: "melee",
};

/** The kind a weapon counts as. */
export const weaponStyle = (id: WeaponId): StyleKind => STYLE_OF_CLASS[WEAPON_CATALOG[id].class];

/** The style with one more fight at its end; past the window the oldest is forgotten. */
export const recordStyle = (style: readonly StyleKind[], kind: StyleKind): readonly StyleKind[] => [...style, kind].slice(-STYLE_WINDOW);

/** Share of each kind in the remembered fights, 0 to 1 (all 0 with none). */
export const styleShares = (style: readonly StyleKind[]): Readonly<Record<StyleKind, number>> => {
  const counts = Object.fromEntries(STYLE_KINDS.map((k) => [k, 0])) as Record<StyleKind, number>;
  for (const k of style) counts[k] += 1;
  if (style.length === 0) return counts;
  for (const k of STYLE_KINDS) counts[k] /= style.length;
  return counts;
};
