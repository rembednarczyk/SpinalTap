import type { Vec3 } from "@seki/core";
import { type ActorDef, type StaticProp, building, crate, lamp, neon, skin, v } from "../builders";
import { ground, groundY } from "../lublin/terrain";
import { W3_Y, w3 } from "./site";

/**
 * The public strip outside W-3's fence (ADR-0082): the lawn between the two lit riverside paths
 * on the terrace, by the metro's entrance A. Genzō waits by his container office KAIUN, as he did
 * by the docks' passage; the strip keeps the NMT (audit P2).
 */

const SODIUM = "#ffb46a";

/** A prop of the zone on its floor. */
const placeOnFloor = (p: StaticProp): StaticProp => ({ ...p, center: { ...p.center, y: p.center.y + W3_Y } });
/** A prop of the strip standing on the terrace's ground at its own centre (sunk a little on the slope). */
const onGround = (p: StaticProp, sink = 0.15): StaticProp => ({ ...p, center: { ...p.center, y: p.center.y + groundY(p.center.x, p.center.z) - sink } });

/** Genzō, the smuggler who hands out the riverside's jobs, by his container office. */
export const GENZO_SPOT: Vec3 = ground(2491, 386);

export const W3_PUBLIC_PROPS: readonly StaticProp[] = [
  // Genzō's container office KAIUN, its door to the north-west; a fire barrel, a sign, a lamp.
  onGround(building(2495.5, 384.5, 6, 2.8, 3, "metal", skin("shop", "z+", { signs: false })), 0.25),
  // Drawn as Genzō's brazier (`rd-w3-barrel`, `outside-dress.ts`).
  { ...onGround(crate(2492.6, 383.2, 0.7, 0.9, 0.7)), scenery: true },
  onGround(neon(2495.5, 2.3, 386.1, v(3.2, 0.7, 0.15), "#ffb000", "KAIUN")),
  onGround(lamp(2498.6, 387.2, SODIUM), 0),
];

export const W3_PUBLIC_ACTORS: readonly ActorDef[] = [
  {
    kind: "npc",
    spawn: { key: "genzo", position: GENZO_SPOT, yaw: -2.4 },
    preset: "civilian",
    faction: "fixers",
    interactable: { kind: "dialogue", dialogueId: "genzo", prompt: "prompt.talk.genzo", radius: 2.4 },
  },
];

/**
 * The zone's yards: a container on the pickup yard and a dumpster by the hall's west wall, each
 * takes a body (ADR-0065), as the docks' did; cover on the way in.
 */
export const W3_YARD_PROPS: readonly StaticProp[] = [
  { ...placeOnFloor(crate(2530, 447.2, 6, 2.6, 2.4)), hide: "container" },
  { ...placeOnFloor(crate(2498.6, 431, 1.4, 1.4, 2.4, skin("dumpster", "x-"))), hide: "dumpster" },
];

/** A docker on a smoke break on the pickup yard, by the basin: life in the plant, nothing to say. */
export const W3_ZONE_ACTORS: readonly ActorDef[] = [
  { kind: "npc", spawn: { key: "doker", position: w3(2563, 0, 449.4), yaw: Math.PI }, preset: "civilian", faction: "civilians", bystander: true },
];
