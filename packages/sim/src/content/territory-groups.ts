import type { TerritoryId, Vec3 } from "@seki/core";
import type { ActivityPlan } from "../world/activity-types";
import type { ActorDef, Presence } from "./builders";
import { spotNear } from "./lublin/places";

/*
 * The gangs' groups in the city (ADR-0091 stage 4): each territory's members stand in a ring
 * round its core, facing in, and smoke, phone and talk. The cores are on the pavements and yards
 * of the real places of the ADR's §1 table (measured 18.11: off the carriageway, out of the
 * buildings, a free ring of 1.5 m round each). The Rynek's members are the street patrols of
 * ADR-0048 (kanal-patrols.ts); the lookout under Alchemia's Arkady stays a lookout.
 */

interface Group {
  readonly territory: TerritoryId;
  readonly core: { readonly x: number; readonly z: number };
  readonly members: number;
  readonly when?: Presence;
}

/** The car wash's yard is M0's: the gang comes back there once the prologue's courier is dead. */
const AFTER_PROLOGUE: Presence = { all: ["dead:courier"] };

export const TERRITORY_GROUPS: readonly Group[] = [
  { territory: "car-wash-yard", core: { x: 405, z: -25 }, members: 3, when: AFTER_PROLOGUE },
  { territory: "alchemia-arcades", core: { x: 449.5, z: 105.9 }, members: 3 },
  { territory: "kapucynska-alley", core: { x: 153.1, z: -132 }, members: 2 },
  { territory: "grodzka-bridge", core: { x: 650, z: 70 }, members: 3 },
  { territory: "panasa-lane", core: { x: 715, z: 100 }, members: 2 },
  { territory: "bus-station", core: { x: 801.4, z: 386.4 }, members: 3 },
  { territory: "bazaar-halls", core: { x: 660, z: 380 }, members: 3 },
  { territory: "ruska-market", core: { x: 690, z: 460 }, members: 3 },
  { territory: "lubartowska", core: { x: 569.9, z: 347.1 }, members: 2 },
];

/** How far from the core a member stands (m). */
const RING = 1.4;

const memberKey = (t: TerritoryId, i: number): string => `hebi-${t}-${i + 1}`;

const memberAt = (g: Group, i: number): { readonly at: Vec3; readonly yaw: number } => {
  const a = (i / g.members) * 2 * Math.PI;
  const at = spotNear(g.core.x + Math.sin(a) * RING, g.core.z + Math.cos(a) * RING);
  return { at, yaw: Math.atan2(g.core.x - at.x, g.core.z - at.z) };
};

export const TERRITORY_ACTORS: readonly ActorDef[] = TERRITORY_GROUPS.flatMap((g) =>
  Array.from({ length: g.members }, (_, i): ActorDef => {
    const { at, yaw } = memberAt(g, i);
    return { kind: "ganger", spawn: { key: memberKey(g.territory, i), position: at, yaw, tag: null }, territory: g.territory, ...(g.when ? { when: g.when } : {}) };
  }),
);

/** What they do where they stand: a smoke, the phone, a word with the others, in turns of their own. */
const PLANS: readonly ActivityPlan[] = [
  { cycle: ["smoke", "talk", "phone"], minutes: 12 },
  { cycle: ["phone", "smoke", "talk"], minutes: 15 },
  { cycle: ["talk", "phone", "smoke"], minutes: 18 },
];

export const TERRITORY_ACTIVITIES: Readonly<Record<string, ActivityPlan>> = Object.fromEntries(
  TERRITORY_GROUPS.flatMap((g) => Array.from({ length: g.members }, (_, i) => [memberKey(g.territory, i), PLANS[i % PLANS.length]!] as const)),
);
