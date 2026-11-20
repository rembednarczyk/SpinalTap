import { ACT_THREE_ENDING_FLAG, CASTLE_LEAD_FLAG, KAGAMI_GUARD_KEYS, endingFlag } from "@seki/core";
import type { Vec3 } from "@seki/core";
import type { ActorDef } from "./builders";
import { ground } from "./lublin/terrain";

/*
 * Act III on the Castle (ADR-0095): Kagami Biotech's seat on the hill (ADR-0068), the archive's core
 * behind the Trinity Chapel's west door on the courtyard. The courtyard opens east, between the
 * Chapel and the Donjon's wing; the scene stands on its open ground (x 900–925, z 220–240).
 */

/** The Chapel's west door on the courtyard, and the archivist by the core in front of it. */
const CHAPEL_DOOR = { x: 929.5, z: 215.5 } as const;
export const ARCHIVIST_SPOT: Vec3 = ground(927.6, 215.5);
/** Kurosawa waits mid-courtyard, facing the Chapel (the "kagami" ending of act II). */
export const KUROSAWA_CASTLE_SPOT: Vec3 = ground(912, 228);
const GUARD_SPOTS: readonly Vec3[] = [ground(918, 222.5), ground(916, 236), ground(904, 230), ground(922, 229)];

const facing = (from: { x: number; z: number }, to: { x: number; z: number }): number => Math.atan2(to.x - from.x, to.z - from.z);

/** The archivist of Kagami, who plugs her into the core; there from the trail to the act's end and after. */
const ARCHIVIST: ActorDef = {
  kind: "npc",
  spawn: { key: "archivist", position: ARCHIVIST_SPOT, yaw: facing(ARCHIVIST_SPOT, { x: 912, z: 228 }) },
  preset: "civilian",
  faction: "kagami",
  when: { all: [CASTLE_LEAD_FLAG] },
  interactable: { kind: "dialogue", dialogueId: "kagami_core", prompt: "prompt.talk.archivist", radius: 2.4 },
};

/** Kurosawa on the courtyard after the "kagami" ending, until act III ends. */
const KUROSAWA_CASTLE: ActorDef = {
  kind: "npc",
  spawn: { key: "kurosawa-castle", position: KUROSAWA_CASTLE_SPOT, yaw: facing(KUROSAWA_CASTLE_SPOT, CHAPEL_DOOR) },
  preset: "fixer",
  faction: "kagami",
  when: { all: [endingFlag("kagami")], none: [ACT_THREE_ENDING_FLAG] },
  interactable: { kind: "dialogue", dialogueId: "kurosawa_castle", prompt: "prompt.talk.kurosawa", radius: 2.4 },
};

/** Kagami's guards on the courtyard from the trail to the act's end: hostile unless she sided with Kagami in act II. */
const GUARDS: readonly ActorDef[] = KAGAMI_GUARD_KEYS.map((key, i): ActorDef => {
  const at = GUARD_SPOTS[i] ?? KUROSAWA_CASTLE_SPOT;
  return { kind: "ganger", spawn: { key, position: at, yaw: facing(at, { x: 940, z: 230 }), tag: "kagami_guard" }, enemy: "kagami_cleaner", when: { all: [CASTLE_LEAD_FLAG], none: [ACT_THREE_ENDING_FLAG] } };
});

export const CASTLE_ACT3_ACTORS: readonly ActorDef[] = [ARCHIVIST, KUROSAWA_CASTLE, ...GUARDS];
