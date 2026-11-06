import { ATTRIBUTE_IDS, type DomainState, type PerkId, type ProgressionState, perkDef, perkRequirement, progressionFromXp, spendAttributePoint, spendPerkPoint, xpForLevel } from "@seki/core";
import type { Simulation } from "../src";

/* Scenes of the perk tests (ADR-0059, stage 3): a character with perks bought the way the game buys them. */

/**
 * A level-`level` character with `perks` bought by the rules: each tree raised just to the tier
 * its perks need, then the ranks bought one by one. Throws when the points do not reach. Without
 * `bought` the same attributes and no perk: the scene to compare with.
 */
export const perked = (perks: Partial<Record<PerkId, number>>, level = 30, bought = true): ProgressionState => {
  let s = progressionFromXp(xpForLevel(level));
  for (const tree of ATTRIBUTE_IDS) {
    const need = Math.max(0, ...(Object.keys(perks) as PerkId[]).filter((id) => perkDef(id).tree === tree).map(perkRequirement));
    while (s.attributes[tree] < need) {
      const r = spendAttributePoint(s, tree);
      if (!r.ok) throw new Error(`${tree}: ${r.reason}`);
      s = r.state;
    }
  }
  if (!bought) return s;
  for (const [id, ranks] of Object.entries(perks) as [PerkId, number][]) {
    for (let i = 0; i < ranks; i++) {
      const r = spendPerkPoint(s, id);
      if (!r.ok) throw new Error(`${id}: ${r.reason}`);
      s = r.state;
    }
  }
  return s;
};

type Holder = { holder: { domain: DomainState } };

/** Changes the running game's domain in place (no snapshot: the scene stays as built). */
export const patchDomain = (sim: Simulation, patch: (d: DomainState) => DomainState): void => {
  const holder = (sim as unknown as Holder).holder;
  holder.domain = patch(holder.domain);
};

/** Puts `progression` into the running game's domain. */
export const setProgression = (sim: Simulation, progression: ProgressionState): void => patchDomain(sim, (d) => ({ ...d, progression }));

/** Buys `perks` for the running game, or with `bought` false only raises their attributes (see `perked`). */
export const withPerks = (sim: Simulation, perks: Partial<Record<PerkId, number>>, bought = true, level = 30): Simulation => {
  setProgression(sim, perked(perks, level, bought));
  return sim;
};
