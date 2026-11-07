import { describe, expect, it } from "vitest";
import { DIFFICULTY_PRESETS, type DomainState, type EntitySnapshot, type SaveSnapshot } from "@seki/core";
import { Simulation, gangerEntity, runReplay, stateHash, type ReplayFrame } from "../src";
import { input, run, streetSim } from "./helpers";

/**
 * Out of Mori's clinic, where a new game starts (ADR-0038): off the chair, through the doorway
 * in the partition, out of the automatic door onto the deptak, facing east along it again
 * (the clinic is a room of a tenement on Krakowskie Przedmieście since ADR-0045).
 */
const outOfTheClinic = (): ReplayFrame[] => {
  const walk = (n: number): ReplayFrame[] => Array.from({ length: n }, () => ({ input: input({ moveZ: 1 }) }));
  const turn = (yaw: number): ReplayFrame => ({ input: input({ lookYaw: yaw }) });
  return [...walk(43), turn(Math.PI / 2), ...walk(80), turn(Math.PI / 2), ...walk(17), turn(-Math.PI / 2), ...walk(130), turn(-Math.PI / 2)];
};

/**
 * A scripted run: out of the clinic, sprint east down the deptak towards Plac Łokietka, look around,
 * creep forward crouched, then fire at whatever is ahead while strafing, half of the time
 * crouched, then aimed down sights.
 */
const script = (): ReplayFrame[] => {
  const frames: ReplayFrame[] = [];
  frames.push({ input: input(), commands: [{ type: "set-flag", flag: "met_fixer" }] });
  frames.push(...outOfTheClinic());
  for (let i = 0; i < 150; i++) frames.push({ input: input({ moveZ: 1, sprint: true }) });
  for (let i = 0; i < 30; i++) frames.push({ input: input({ lookYaw: 0.01, lookPitch: 0.002 }) });
  for (let i = 0; i < 60; i++) frames.push({ input: input({ moveZ: 1, crouch: true }) });
  for (let i = 0; i < 360; i++) {
    frames.push({ input: input({ fire: true, crouch: i % 180 >= 90, moveX: i % 120 < 60 ? 1 : -1, lookYaw: i % 90 < 45 ? -0.004 : 0.004 }) });
  }
  // Aim down sights (ADR-0019): walk in slowly, fire aimed, let go halfway.
  for (let i = 0; i < 120; i++) frames.push({ input: input({ aim: i < 90, fire: i >= 20, moveZ: i % 60 < 30 ? 1 : 0, lookYaw: i % 40 < 20 ? 0.002 : -0.002 }) });
  // Weapon handling (ADR-0015): reload, an empty slot, holster, draw again and keep firing.
  frames.push({ input: input({ reload: true }) });
  for (let i = 0; i < 40; i++) frames.push({ input: input() });
  frames.push({ input: input({ weaponSlot: 3 }) });
  frames.push({ input: input({ toggleWeapon: true }) });
  frames.push({ input: input({ weaponSlot: 2 }) });
  for (let i = 0; i < 120; i++) frames.push({ input: input({ fire: true, lookYaw: i % 60 < 30 ? 0.003 : -0.003 }) });
  return frames;
};

const hashOf = (sim: Simulation) => stateHash(sim.snapshot(null, "test", ""));

/**
 * The hash of a run as schema v31 had it (before the cyberdeck's grades, decision of 6.11 after
 * ADR-0059 stage 6): the same snapshot, only the version. The runs' player has no cyberdeck, so
 * nothing else in the save differs and the runs hash to the goldens of v31.
 */
const v31HashOf = (sim: Simulation) => stateHash({ ...sim.snapshot(null, "test", ""), version: 31 } as unknown as SaveSnapshot);

/**
 * The snapshot of a run as v30 wrote it, before the player's style and bad luck (ADR-0059, stage
 * 6): the progression without them. The runs' player defeats and hacks no one (no fight, no bag
 * of hers), so without the fields the runs hash to the goldens of v30.
 */
const beforeV31 = (sim: Simulation): SaveSnapshot => {
  const snap = sim.snapshot(null, "test", "");
  const { style: _s, unlucky: _u, ...progression } = snap.domain.progression;
  return { ...snap, domain: { ...snap.domain, progression } } as unknown as SaveSnapshot;
};

/** The hash of a run as schema v30 had it: without the style and the bad luck, the goldens of v30. */
const v30HashOf = (sim: Simulation) => stateHash({ ...beforeV31(sim), version: 30 } as unknown as SaveSnapshot);

/**
 * The snapshot of a run as v28 wrote it, before item levels and traits (ADR-0059, stage 4): the
 * pieces in the bag and in the loot bags without them. The player of these runs starts at level 1
 * and ends at level 2 at most; the levels and traits come from a stream of their own and no tier
 * of a piece in the runs differs from before, so without the fields the runs hash as v28 and the
 * older schemas would hash them (since stage 5 the enemies' levels change the runs, and those
 * goldens were re-recorded with it).
 */
const beforeV29 = (sim: Simulation): SaveSnapshot => {
  const snap = beforeV31(sim);
  const strip = <T extends object>(p: T): T => {
    const { level: _l, traits: _t, ...rest } = p as T & { level?: number; traits?: unknown };
    return rest as T;
  };
  const items = snap.domain.inventory.items.map(strip);
  const containers = snap.domain.loot.containers.map((c) => ({ ...c, lines: c.lines.map(strip) }));
  return { ...snap, domain: { ...snap.domain, inventory: { ...snap.domain.inventory, items }, loot: { ...snap.domain.loot, containers } } };
};

/** The hash of a run as schema v28 had it: without the item levels, the goldens of v28. */
const v28HashOf = (sim: Simulation) => stateHash({ ...beforeV29(sim), version: 28 } as unknown as SaveSnapshot);

/**
 * The hash of a run as schema v27 had it (G-233): without the bodies of a won mugging, of which
 * these runs have none (no micro-event starts in them), so only the version differs from v28.
 */
const v27HashOf = (sim: Simulation) => {
  const { strayBodies: _b, ...snap } = beforeV29(sim);
  return stateHash({ ...snap, version: 27 } as unknown as SaveSnapshot);
};

/**
 * The snapshot of a run as v26 wrote it, before a walker's stuck check was saved (G-208): without
 * it. Saving it changes no rule; the rule G-208 changes (the side a reinforcement first leans to)
 * does not show in these runs, so the hashes of the older schemas stand.
 */
const beforeV27 = (sim: Simulation): SaveSnapshot => {
  const snap = beforeV29(sim);
  const v26 = ({ walk: _w, ...e }: EntitySnapshot): EntitySnapshot => e;
  const r = snap.reinforcements;
  const reinforcements = r ? { reinforcements: { ...r, people: r.people.map((p) => ({ ...p, state: v26(p.state) })) } } : {};
  return { ...snap, entities: snap.entities.map(v26), ...reinforcements };
};

/** The hash of a run as schema v26 had it (G-208): without the walkers' stuck check, the goldens of v26. */
const v26HashOf = (sim: Simulation) => stateHash({ ...beforeV27(sim), version: 26 } as unknown as SaveSnapshot);

/**
 * The snapshot of a run as v25 wrote it, before the reinforcements were saved with the tick they
 * came in at (G-202): without it. Saving it changes no rule, so the hashes of the older schemas stand.
 */
const beforeV26 = (sim: Simulation): SaveSnapshot => {
  const snap = beforeV27(sim);
  const r = snap.reinforcements;
  if (!r) return snap;
  return { ...snap, reinforcements: { ...r, people: r.people.map(({ since: _s, ...p }) => p) } } as unknown as SaveSnapshot;
};

/** The hash of a run as schema v25 had it (G-202): the reinforcements without their tick, the goldens of v25. */
const v25HashOf = (sim: Simulation) => stateHash({ ...beforeV26(sim), version: 25 } as unknown as SaveSnapshot);

/**
 * The snapshot of a run as v24 wrote it, before an NPC's gun and a sniper's aim were saved
 * (G-185): without them. Saving them changes no rule, so the hashes of the older schemas stand.
 */
const beforeV25 = (sim: Simulation): SaveSnapshot => {
  const snap = beforeV26(sim);
  const v24 = ({ gun: _g, sniper: _s, ...e }: EntitySnapshot): EntitySnapshot => e;
  const r = snap.reinforcements;
  const reinforcements = r ? { reinforcements: { ...r, people: r.people.map((p) => ({ ...p, state: v24(p.state) })) } } : {};
  return { ...snap, entities: snap.entities.map(v24), ...reinforcements };
};

/** The hash of a run as schema v24 had it (G-185): without the guns and snipers, the goldens of v24. */
const v24HashOf = (sim: Simulation) => stateHash({ ...beforeV25(sim), version: 24 } as unknown as SaveSnapshot);

/**
 * The snapshot of a run as v22 wrote it, before the heat's reinforcements were saved (G-179):
 * without them. Saving them changes no rule, so the hashes of the older schemas below stand.
 */
const beforeV23 = (sim: Simulation): SaveSnapshot => {
  const { reinforcements: _r, ...snap } = beforeV25(sim);
  return snap;
};

/**
 * The hash of a run as schema v17 had it, before the difficulty (ADR-0066): without the profile.
 * "normal" changes no rule, so its runs hash to the goldens recorded before v18.
 */
const v17HashOf = (sim: Simulation) => {
  const snap = beforeV23(sim);
  const { difficulty: _d, ...domain } = snap.domain;
  return stateHash({ ...snap, version: 17, domain } as unknown as SaveSnapshot);
};

/**
 * The hash of a run as schema v19 had it, before a waiting difficulty was saved (G-171): with no
 * profile waiting the snapshot differs in the version only, so it hashes to the goldens of v19.
 */
const v19HashOf = (sim: Simulation) => {
  const snap = beforeV23(sim);
  expect(snap.pendingDifficulty).toBeUndefined();
  return stateHash({ ...snap, version: 19 } as unknown as SaveSnapshot);
};

/**
 * The hash of a run as schema v20 had it, before a guard's suspicion was saved (G-174): with no
 * guard half sure at the end the snapshot differs in the version only, so it hashes to the
 * goldens of v20.
 */
const v20HashOf = (sim: Simulation) => {
  const snap = beforeV23(sim);
  expect(snap.entities.filter((e) => e.suspicion !== undefined)).toEqual([]);
  return stateHash({ ...snap, version: 20 } as unknown as SaveSnapshot);
};

/**
 * The hash of a run as schema v21 had it, before a contract ended with its people about was saved
 * (G-178): with none ended the snapshot differs in the version only, so it hashes to the goldens
 * of v21.
 */
const v21HashOf = (sim: Simulation) => {
  const snap = beforeV23(sim);
  expect(snap.endedContract).toBeUndefined();
  return stateHash({ ...snap, version: 21 } as unknown as SaveSnapshot);
};

/** The hash of a run as schema v22 had it (G-179): without the reinforcements, the goldens of v22. */
const v22HashOf = (sim: Simulation) => stateHash({ ...beforeV23(sim), version: 22 } as unknown as SaveSnapshot);

/**
 * The hash of a run as schema v23 had it, before an AI pinned in the world while its chunk sleeps
 * was marked (G-188): with none pinned at the end the snapshot differs in the version only, so it
 * hashes to the goldens of v23.
 */
const v23HashOf = (sim: Simulation) => {
  const snap = beforeV25(sim);
  expect(snap.entities.filter((e) => e.away !== undefined)).toEqual([]);
  return stateHash({ ...snap, version: 23 } as unknown as SaveSnapshot);
};

/** The scripted run on "hard" (ADR-0066): the profile set by command in its first frame. */
const hardScript = (): ReplayFrame[] => {
  const [first, ...rest] = script();
  if (!first) return rest;
  return [{ ...first, commands: [{ type: "set-difficulty", profile: DIFFICULTY_PRESETS.hard }, ...(first.commands ?? [])] }, ...rest];
};

describe("determinism", () => {
  it("same seed + same input stream = same end state", () => {
    const a = runReplay(1234, script());
    const b = runReplay(1234, script());
    expect(hashOf(a)).toBe(hashOf(b));
    expect(a.tick).toBe(1159);
  });

  it("a different seed diverges once randomness is involved", () => {
    expect(hashOf(runReplay(1234, script()))).not.toBe(hashOf(runReplay(4321, script())));
  });

  it("matches the recorded golden hash (update deliberately when rules change)", () => {
    const sim = runReplay(1234, script());
    expect(hashOf(sim)).toMatchInlineSnapshot(`"dde46992"`);
    // Re-recorded for the v18 field (ADR-0066), the v19 version (ADR-0065, no new rule), the v20
    // version (G-171, no new rule), the v21 version (G-174, no new rule), the v22 version (G-178,
    // no new rule) and the v23 reinforcements (G-179: the run's are saved now, the keyed world ends
    // as before), the v24 version (G-188, no new rule in this run), the v25 guns of the NPCs
    // (G-185, saved, no new rule), the v26 tick each reinforcement came in at (G-202, saved, no
    // new rule: nobody in the run hacks one), the v27 stuck check of the walkers (G-208, saved)
    // and the v28 version (G-233: the bodies of a won mugging, none in the run, no new rule).
    // G-208 also changes a rule: a reinforcement first leans to the side of its number in the heat
    // (`security.n`), not of its id, since a loaded game gives it another id. It shows where a
    // stuck reinforcement has no repath and leans (the player on a warehouse roof in the docks,
    // `reinforcement-sidestep.test.ts`), not in this run: without the field, as v17, it is the
    // golden of before, and as v19 to v27 the goldens of those.
    // Re-recorded (with the "hard" one, v27 included) for G-098, no new rule: the Brigittines' bell
    // tower is a building more in the map, so the ids of the run's entities come one later and a
    // stuck ganger's first side (by its id) flips: only the saved `walk` differs, v26 stands.
    // Re-recorded (all of them, "hard" too) for ADR-0069, a new rule: every ganger of the run sees
    // in its type's cone, a crouching player from half as far, and fills a suspicion before the
    // alarm (it turns to her on the first of it) instead of alerting in the step it has a clear line.
    // Re-recorded (all of them, "hard" too) for G-343, a new rule: a fleeing bystander keeps the
    // way whose walk round a corner it follows and does not turn back while it is open. Bystanders
    // 1082 and 294 (G-329) of the run swung back and forth in the panic: 283 and 84 jumps, now 40 and 10.
    // Re-recorded (all of them, "hard" and the duel too) for the v29 item levels (ADR-0059, stage 4),
    // fields, no new rule shows in these runs: the starter kit is of level 1 and, as v28, the runs hash
    // to the goldens of before.
    // Re-recorded (all of them, "hard" too; the duel's brawler is made by hand, with no level) for
    // the district bands of ADR-0059, stage 5, a new rule: the run's player reaches level 2 and,
    // inside Krakowskie's band (1-8), the gangers about keep up with her (level 2, 83 of 80 health).
    // Then again with the v30 version of the market's move (ADR-0063, stage 6), no new rule in the
    // run: the older vN hashes stand.
    // Re-recorded (all of them, "hard" and the duel too) for the v31 style and bad luck of ADR-0059,
    // stage 6: fields of the progression, no new rule shows in these runs (the player defeats and
    // hacks no one: no fight, a count of 0), so as v30 they hash to the goldens of before.
    // Re-recorded (all of them, "hard" and the duel too) for the v32 version of the cyberdeck's
    // grades (after ADR-0059 stage 6): the runs' player has no deck, so no new field and no new rule
    // shows, and as v31 they hash to the goldens of before.
    expect(v31HashOf(sim)).toBe("8a184ff0");
    expect(v30HashOf(sim)).toBe("7dd4e4ad");
    expect(v17HashOf(sim)).toBe("1ce01d19");
    expect(v19HashOf(sim)).toBe("6c657123");
    expect(v20HashOf(sim)).toBe("e3f6e797");
    expect(v21HashOf(sim)).toBe("0b324838");
    expect(v22HashOf(sim)).toBe("16a7e7d5");
    expect(v23HashOf(sim)).toBe("ac734ccd");
    expect(v24HashOf(sim)).toBe("90600c96");
    expect(v25HashOf(sim)).toBe("94c21ad3");
    expect(v26HashOf(sim)).toBe("b8d0ace2");
    expect(v27HashOf(sim)).toBe("ef0f8c1e");
    expect(v28HashOf(sim)).toBe("0dfb20ef");
  });

  it("the same run on 'hard' has a golden hash of its own (ADR-0066)", () => {
    const sim = runReplay(1234, hardScript());
    expect(sim.domain.difficulty).toEqual(DIFFICULTY_PRESETS.hard);
    expect(hashOf(sim)).toBe(hashOf(runReplay(1234, hardScript())));
    expect(hashOf(sim)).toMatchInlineSnapshot(`"a12dbddf"`);
    // Not just the field: without it the run still ends elsewhere than on "normal".
    expect(v31HashOf(sim)).toBe("13a15bf5");
    expect(v30HashOf(sim)).toBe("30834a04");
    expect(v17HashOf(sim)).not.toBe("1ce01d19");
    expect(v19HashOf(sim)).toBe("01e929be");
    expect(v20HashOf(sim)).toBe("93e8e16a");
    expect(v21HashOf(sim)).toBe("7e76b28b");
    expect(v22HashOf(sim)).toBe("b3ca81f8");
    expect(v23HashOf(sim)).toBe("3f2c0e82");
    expect(v24HashOf(sim)).toBe("a995b57b");
    expect(v25HashOf(sim)).toBe("76e283bc");
    expect(v26HashOf(sim)).toBe("be1e9237");
    expect(v27HashOf(sim)).toBe("3aa62e95");
    expect(v28HashOf(sim)).toBe("5250f136");
  });

  // One case per density: three full replays in one case ran close to the 20 s limit under coverage.
  let golden: string | undefined;
  const goldenRun = (): string => (golden ??= hashOf(runReplay(1234, script())));
  for (const crowd of ["low", "high"] as const) {
    it(`the crowd of residents (ADR-0041) and the traffic (ADR-0050) leave the golden run as it was, at density ${crowd}`, () => {
      const sim = runReplay(1234, script(), crowd);
      expect([...sim.world].some((e) => e.view?.kind === "crowd")).toBe(true);
      // The traffic follows the crowd's density: cars on Lubartowska and Królewska by Plac Łokietka.
      if (crowd === "high") expect([...sim.world].some((e) => e.vehicle !== undefined)).toBe(true);
      expect(hashOf(sim)).toBe(goldenRun());
    });
  }

  it("without the v13 fields of ADR-0033, the v17 progression and the v18 difficulty the replay hashes as with sim B of wave 2 (fields, not rules)", () => {
    const snap = beforeV23(runReplay(1234, script()));
    // The v17 progression (ADR-0059) is left out as well: the run's XP changes no rule it hashes.
    // So is the v18 difficulty (ADR-0066): "normal" changes no rule either.
    const { buffs: _b, capacityShards: _c, disguise: _d, progression: _p, difficulty: _f, ...domain } = snap.domain;
    const { doors: _doors, ...rest } = snap;
    // Re-recorded for ADR-0038 (the run starts in the clinic) and ADR-0045 (the clinic is on
    // Krakowskie Przedmieście), and for the car wash moved off Plac Łokietka into the yard behind
    // it; the v14 door states are left out too. Re-recorded for ADR-0069: the gangers of the run see
    // in a cone and fill a suspicion before the alarm. Re-recorded for G-343: fleeing bystanders
    // no longer turn back and forth. Re-recorded for ADR-0059, stage 5: the gangers keep up with
    // the player's level 2 in Krakowskie's band.
    expect(stateHash({ ...rest, version: 12, domain } as unknown as SaveSnapshot)).toBe("d100771d");
  });

  it("a loaded snapshot continues exactly like the original run", () => {
    const frames = script();
    // Split while standing with a settled aim: crouch and bloom are transient and not saved (ADR-0016).
    const original = runReplay(1234, frames.slice(0, 455));
    const restored = Simulation.fromSnapshot(original.snapshot(null, "mid", ""));
    expect(hashOf(restored)).toBe(hashOf(original));
    for (const f of frames.slice(455)) {
      original.step(f.input);
      restored.step(f.input);
    }
    expect(hashOf(restored)).toBe(hashOf(original));
  });

  it("a melee duel replays to its golden hash (ADR-0019)", () => {
    const duel = () => {
      const base = streetSim({ seed: 77 });
      const snap = base.snapshot(null, "t", "");
      const d: DomainState = snap.domain;
      const domain: DomainState = {
        ...d,
        inventory: { ...d.inventory, items: [...d.inventory.items, { uid: "i9", def: "baton", rarity: "common" }], nextUid: d.inventory.nextUid + 1 },
        equipment: { ...d.equipment, melee: "i9", active: "melee" },
      };
      const sim = Simulation.fromSnapshot({ ...snap, domain });
      const p = sim.player()!;
      const b = gangerEntity(4000, { key: "brawler", position: { x: p.position.x, y: p.position.y, z: p.position.z + 4 }, yaw: Math.PI }, null, 90, p.chunk ?? "", undefined, "hebi_brawler");
      b.ai!.alerted = true;
      sim.world.add(b);
      const seen: string[] = [];
      for (const t of ["MeleeSwing", "AttackBlocked", "Staggered", "DamageDealt"] as const) sim.bus.on(t, () => seen.push(t));
      // Guard, parry attempts, combos, a step back during a windup.
      for (let i = 0; i < 600; i++) {
        const phase = i % 150;
        sim.step(input({ aim: phase >= 40 && phase < 70, fire: phase >= 80 && phase < 120, moveZ: phase >= 130 ? -1 : 0, lookYaw: i % 50 < 25 ? 0.003 : -0.003 }));
      }
      return { sim, seen };
    };
    const { sim, seen } = duel();
    // Swings both ways, a blocked blow and staggers: the duel exercises the whole package.
    for (const t of ["MeleeSwing", "AttackBlocked", "Staggered", "DamageDealt"]) expect(seen).toContain(t);
    expect(hashOf(sim)).toBe(hashOf(duel().sim));
    // Back to the hashes before ADR-0059 stage 8, round 2 (all of them): with the floor of round 3
    // a kill's XP is the type's own up to level 6, so the brawler the player of level 1 downs is
    // worth 70 XP again, not 4. The only XP the scripted run above earns is a quest step's, so its
    // hashes stand; contracts' XP and kills above level 1 show in no golden hash (the balance test
    // and progression tests cover them).
    expect(hashOf(sim)).toMatchInlineSnapshot(`"b036f5d7"`);
    expect(v31HashOf(sim)).toBe("5ce46e55");
    expect(v30HashOf(sim)).toBe("ae6c21d0");
    expect(v17HashOf(sim)).toBe("3e78c5b2");
    expect(v19HashOf(sim)).toBe("6ebebd7e");
    expect(v20HashOf(sim)).toBe("116f9cfa");
    expect(v21HashOf(sim)).toBe("ce560791");
    expect(v22HashOf(sim)).toBe("7c4d11bc");
    expect(v23HashOf(sim)).toBe("9398eab3");
    expect(v24HashOf(sim)).toBe("2cbf3696");
    expect(v25HashOf(sim)).toBe("66d7b85d");
    expect(v26HashOf(sim)).toBe("94efe6f8");
    expect(v27HashOf(sim)).toBe("de01c1cf");
    expect(v28HashOf(sim)).toBe("402f2952");
  });

  it("restores killed NPCs as absent", () => {
    const sim = Simulation.create({ seed: 1 });
    sim.enqueue({ type: "set-flag", flag: "dead:guard" });
    run(sim, 1);
    const restored = Simulation.fromSnapshot(sim.snapshot(null, "x", ""));
    expect([...restored.world].some((e) => e.key === "guard")).toBe(false);
    expect([...restored.world].some((e) => e.key === "courier")).toBe(true);
  });
});
