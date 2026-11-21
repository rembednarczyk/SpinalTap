import { DIFFICULTY_PRESETS, type DifficultyProfile, type DomainState, type InputFrame, type Vec3 } from "@seki/core";
import { type ChunkDef, type ReplayFrame, Simulation, building, crate, lamp, placeAt, placeProps, placeRect, v } from "../../src";
import { residentEntity, residentId, type ResidentPlan } from "../../src/world/crowd";
import { input, teleportPlayer } from "../helpers";

/**
 * The determinism test's floor (decision of 16.11): a small world of its own, far outside the city
 * (x and z about -2000, the city is x -200..2700, z -270..580), so no table of Lublin and no
 * content of the map reaches it. A yard 120 by 120 m, flat at y = 0, with two buildings and crates
 * for cover; in it three Hebi with their AI (a ganger, a brawler, a lookout), a bystander with the
 * civilian AI and a crowd of residents standing about. A run on it walks, sprints, crouches, jumps,
 * dashes, shoots, aims, reloads, holsters, swings a baton and scans, and is saved and loaded
 * halfway. Changing the floor or the script changes the golden hash in `determinism.test.ts`.
 */

/** Where the floor's own coordinates stand in the world. */
export const FLOOR_PLACE: Vec3 = { x: -2000, y: 0, z: -2000 };

export const FLOOR_ID = "determinism-floor";

/** A point of the floor in the world. */
export const floorAt = (x: number, z: number, y = 0): Vec3 => placeAt(FLOOR_PLACE, v(x, y, z));

const PROPS = [
  building(-30, 35, 16, 9, 10, "concrete"),
  building(28, 38, 12, 14, 14, "glass"),
  crate(-6, 2, 3, 1.2, 1.2),
  crate(7, 6, 2, 1.4, 2),
  crate(-14, 12, 1.5, 2.5, 1.5),
  lamp(-10, 0, "#00e5ff"),
  lamp(10, 20, "#ff2e88"),
];

/**
 * The floor: one chunk, nothing else in the world. Its district is `shinsekai-7`, so the golden
 * hash hangs on that district's rows of tables of balance, not of the map: `DISTRICT_BANDS`
 * (`content/district-bands.ts`, the band the Hebi's level is kept in, ADR-0059; a band of 4-8
 * instead of 1-8 moves the hash) and `FIXER_HOME` (`systems/contract-layer-system.ts`, the fixer
 * who phones an offer on entering the district, ADR-0029). The run starts in the district and
 * never enters it, so `FIXER_HOME` moves nothing today (Kaito moved to `doki`: the same hash);
 * a script that leaves the floor's district and comes back would hang on it too.
 */
export const FLOOR_CHUNK: ChunkDef = {
  id: FLOOR_ID,
  district: "shinsekai-7",
  bounds: placeRect(FLOOR_PLACE, { minX: -60, maxX: 60, minZ: -60, maxZ: 60 }),
  props: placeProps(FLOOR_PLACE, PROPS),
  actors: [
    { kind: "ganger", enemy: "hebi_ganger", spawn: { key: "floor-ganger", position: floorAt(0, 9), yaw: Math.PI, tag: null } },
    { kind: "ganger", enemy: "hebi_brawler", spawn: { key: "floor-brawler", position: floorAt(-1, 14), yaw: Math.PI, tag: null } },
    { kind: "ganger", enemy: "hebi_lookout", spawn: { key: "floor-lookout", position: floorAt(-12, 16), yaw: Math.PI * 0.8, tag: null } },
    {
      kind: "npc",
      preset: "civilian",
      faction: "civilians",
      bystander: true,
      maxHp: 50,
      spawn: { key: "floor-bystander", position: floorAt(-8, -8), yaw: 0 },
    },
  ],
};

export const FLOOR: readonly ChunkDef[] = [FLOOR_CHUNK];

/**
 * Where the player starts: the south of the yard, looking north at the Hebi. 2.7 m further north
 * since the run of 21.11 (3.5 m/s, sprint 6 m/s; 4.2 and 6.9 before): the scripted walk, sprint, creep
 * and jump cover that much less, so the fight starts where it did.
 */
export const FLOOR_START: Vec3 = floorAt(0, -27.3);

/** The residents standing about the yard (ADR-0041): not saved, so a loaded game has none. */
const RESIDENTS: readonly { readonly at: Vec3; readonly yaw: number }[] = [
  { at: floorAt(-4, -18), yaw: 0.5 },
  { at: floorAt(-3, -17), yaw: -2.6 },
  { at: floorAt(6, -14), yaw: 1.2 },
  { at: floorAt(12, -22), yaw: -1.4 },
  { at: floorAt(-16, -4), yaw: 3 },
];

const residentPlan = (i: number, at: Vec3, yaw: number): ResidentPlan => ({
  chunk: FLOOR_ID,
  index: i,
  look: 7919 * (i + 1),
  umbrella: i % 2 === 1,
  role: { kind: "stander", spot: { chunk: FLOOR_ID, at, yaw, does: ["talk", "smoke", "phone"] } },
});

/** Puts the floor's crowd in: standers with the civilian AI, as the crowd system makes them. */
export const addResidents = (sim: Simulation): void => {
  RESIDENTS.forEach((r, i) => sim.world.add(residentEntity(residentId(0, i), sim.seed, residentPlan(i, r.at, r.yaw), sim.domain.clock)));
};

/**
 * On top of the starter kit (the pistol in the secondary slot): a Hebi SMG in the primary slot, in
 * hand, and a baton (ADR-0019) in the melee slot, with 9 mm to reload from.
 */
const withKit = (d: DomainState): DomainState => ({
  ...d,
  inventory: {
    ...d.inventory,
    items: [...d.inventory.items, { uid: "i8", def: "hebi_smg", rarity: "common", loaded: 30 }, { uid: "i9", def: "baton", rarity: "common" }],
    nextUid: d.inventory.nextUid + 2,
  },
  equipment: { ...d.equipment, primary: "i8", melee: "i9", active: "primary" },
  ammo: { ...d.ammo, "9mm": 120 },
});

/**
 * The floor's difficulty: "normal" but for the damage the player takes, so she lives through the
 * whole run against three Hebi at close range and every step of it counts.
 */
export const FLOOR_DIFFICULTY: DifficultyProfile = { ...DIFFICULTY_PRESETS.normal, damageTaken: 0.3 };

/** A new game on the floor, before the first step: the player at the start, with the kit, and the crowd. */
export const floorSim = (seed: number, difficulty: DifficultyProfile = FLOOR_DIFFICULTY): Simulation => {
  const fresh = Simulation.create({ seed, chunks: FLOOR, difficulty });
  teleportPlayer(fresh, FLOOR_START);
  const snap = fresh.snapshot(null, "floor", "");
  const sim = Simulation.fromSnapshot({ ...snap, domain: withKit(snap.domain) }, undefined, "off", "off", FLOOR);
  addResidents(sim);
  // The first step streams the floor in; its ganger was hurt before the player came, so a fight
  // of the run ends in a kill and a bag of loot.
  sim.step();
  const ganger = [...sim.world].find((e) => e.key === "floor-ganger");
  if (ganger?.health) ganger.health = { ...ganger.health, current: 6 };
  return sim;
};

/**
 * The frame the load test saves at: standing after the walk, before anyone is alarmed, so the
 * whole fight runs after the load. Saves in the fight are tested at every 50th step (G-883).
 */
export const FLOOR_SAVE_AT = 111;

const many = (n: number, f: (i: number) => Partial<InputFrame>): ReplayFrame[] => Array.from({ length: n }, (_, i) => ({ input: input(f(i)) }));

/**
 * The scripted run of the floor, about 22 s of play: walk up towards the crowd and stand, sprint,
 * creep crouched, jump, fire the SMG on the Hebi while strafing (the crowd and the bystander run),
 * aim down sights, reload, the slot in hand again (nothing), holster and draw, a dash, a scan and
 * the medkit, then the baton against whoever came close, the pistol and the SMG again while
 * backing off. The run ends with the hurt ganger dead and its bag on the ground.
 */
export const floorScript = (): ReplayFrame[] => [
  { input: input(), commands: [{ type: "set-flag", flag: "met_fixer" }] },
  ...many(90, () => ({ moveZ: 1 })),
  ...many(20, () => ({})),
  ...many(60, () => ({ moveZ: 1, sprint: true })),
  ...many(20, (i) => ({ lookYaw: i < 10 ? 0.01 : -0.01, lookPitch: 0 })),
  ...many(50, () => ({ moveZ: 1, crouch: true })),
  ...many(30, (i) => ({ moveZ: 1, jump: i === 0 })),
  ...many(300, (i) => ({ fire: true, crouch: i % 160 >= 80, moveX: i % 120 < 60 ? 1 : -1, lookYaw: i % 90 < 45 ? -0.004 : 0.004 })),
  ...many(100, (i) => ({ aim: i < 80, fire: i >= 15, moveZ: i % 50 < 25 ? 1 : 0, lookYaw: i % 40 < 20 ? 0.002 : -0.002 })),
  { input: input({ reload: true }) },
  ...many(40, () => ({})),
  { input: input({ weaponSlot: 1 }) },
  { input: input({ toggleWeapon: true }) },
  ...many(20, () => ({})),
  { input: input({ toggleWeapon: true }) },
  ...many(30, (i) => ({ moveX: -1, dash: i === 0 })),
  { input: input({ scan: true }) },
  ...many(20, () => ({})),
  { input: input({ useItem: true }) },
  { input: input({ weaponSlot: 3 }) },
  ...many(240, (i) => {
    const phase = i % 120;
    // Up to the Hebi 36 steps (30 at the run of 4.2 m/s before 21.11: the same ground at 3.5).
    return { aim: phase >= 36 && phase < 56, fire: phase >= 60 && phase < 100, moveZ: phase < 36 ? 1 : phase >= 104 ? -1 : 0, lookYaw: i % 50 < 25 ? 0.003 : -0.003 };
  }),
  { input: input({ weaponSlot: 2 }) },
  ...many(120, (i) => ({ fire: true, lookYaw: i % 60 < 30 ? 0.003 : -0.003 })),
  { input: input({ weaponSlot: 1 }) },
  ...many(180, (i) => ({ fire: true, moveZ: -1, lookYaw: i % 60 < 30 ? 0.006 : -0.006 })),
];

/** Steps `frames` on `sim`, their commands first. */
export const play = (sim: Simulation, frames: readonly ReplayFrame[]): Simulation => {
  for (const f of frames) {
    for (const c of f.commands ?? []) sim.enqueue(c);
    sim.step(f.input);
  }
  return sim;
};

/** The floor's scripted run from `seed`. */
export const floorRun = (seed: number, frames: readonly ReplayFrame[] = floorScript(), difficulty?: DifficultyProfile): Simulation => play(floorSim(seed, difficulty), frames);
