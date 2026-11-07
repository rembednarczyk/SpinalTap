import { ATTRIBUTE_IDS, type DomainState, PERK_IDS, type PerkId, type ProgressionState, perkDef, perkRequirement, progressionFromXp, spendAttributePoint, spendPerkPoint, xpForLevel } from "@seki/core";
import type { Simulation } from "../src";

/* Scenes of the perk tests (ADR-0059, stages 3 and 3b): a character with perks bought the way the game buys them. */

/**
 * One rank of the first perk not asked for on each tier below the highest one asked for in a
 * tree: the path a tier needs (stage 3b), bought in both scenes so the comparison keeps only the
 * perks asked for.
 */
const pathOf = (perks: Partial<Record<PerkId, number>>): PerkId[] => {
  const asked = (Object.keys(perks) as PerkId[]).filter((id) => (perks[id] ?? 0) > 0);
  const path: PerkId[] = [];
  for (const tree of ATTRIBUTE_IDS) {
    const top = Math.max(-1, ...asked.filter((id) => perkDef(id).tree === tree).map((id) => perkDef(id).tier));
    for (let tier = 0; tier < top; tier++) {
      const filler = PERK_IDS.find((id) => perkDef(id).tree === tree && perkDef(id).tier === tier && !(id in perks));
      if (filler) path.push(filler);
    }
  }
  return path;
};

/**
 * A level-`level` character with `perks` bought by the rules: each tree raised just to the tier
 * its perks need, the path through the tiers below (`pathOf`), then the ranks bought one by one,
 * lowest tier first. Throws when the points do not
 * reach. Without `bought` the same attributes and path and none of `perks`: the scene to compare with.
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
  const buy = (id: PerkId): void => {
    const r = spendPerkPoint(s, id);
    if (!r.ok) throw new Error(`${id}: ${r.reason}`);
    s = r.state;
  };
  pathOf(perks).forEach(buy);
  if (!bought) return s;
  const order = (Object.entries(perks) as [PerkId, number][]).sort(([a], [b]) => perkDef(a).tier - perkDef(b).tier);
  for (const [id, ranks] of order) for (let i = 0; i < ranks; i++) buy(id);
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
