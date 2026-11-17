import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type AudioPort, DIFFICULTY_PRESETS, INITIAL_PROGRESSION, SAVE_SCHEMA_VERSION, contractAlarmFlag, contractTag, xpForLevel } from "@seki/core";
import { STORY_SOURCES } from "@seki/narrative";
import { MemorySaveStore, SavePersistence, decodeSave } from "@seki/persistence";
import { type Entity, GENZO_SPOT, SIM_HZ, W3_Y, lineOfSight, playerStatsOf, stateHash } from "@seki/sim";
import { DEFAULT_SETTINGS, W3_SLICE_SLOT, createUiStore, translateText } from "@seki/ui";
import { GameSession } from "../src/game-session";
import { FakeRender, frame, setup, steps, teleport } from "./story-helpers";

/**
 * W-3's start save (ADR-0082, user decision 15.11; G-909), headless: the new game's setup writes
 * it to its slot and loads it like a save, Seki at level 12 by Genzō with the AR-5 loaded in hand.
 * The playtest of 17.11 played W-3 loud from act I at level 6 with the Unity-9 and died in corridor
 * S; the same fights here, before (that game) and after (the start save): a duel with one guard
 * 16 m off in the hall's aisle, and corridor S after the charges' alarm.
 */

type Ui = ReturnType<typeof setup>["ui"];

/** Asks Genzō about the batch from where she stands and takes the job. */
const acceptSabotage = (session: GameSession, u: Ui) => {
  steps(session, 1, frame({ interact: true }));
  const choice = (u.getState().dialogue?.choices ?? []).find((c) => /^(Co to za partia dronów|What's this drone batch)/.test(c.text));
  if (!choice) throw new Error(`no sabotage offer: ${(u.getState().dialogue?.choices ?? []).map((c) => c.text).join(" / ")}`);
  session.intents.choose(choice.index);
  session.intents.closeDialogue();
  steps(session, 2);
  const job = session.sim.domain.contracts.active;
  if (job?.kind !== "sabotage") throw new Error("no sabotage");
  return job;
};

/** The start save, as the new game's setup starts it. */
const slice = async () => {
  const s = setup();
  expect(await s.session.starts.startW3SliceAsync()).toBe(true);
  steps(s.session, 1);
  return s;
};

/** The playtest's game (G-909): a new game raised to level 6 with its kit (the Unity-9), loaded from a slot, by Genzō. */
const levelSix = async () => {
  const s = setup();
  s.session.newGame();
  steps(s.session, 1);
  const snap = s.session.saves.snapshot();
  const progression = { ...INITIAL_PROGRESSION, xp: xpForLevel(6), level: 6, unspent: { attribute: 5, perk: 5 } };
  await new SavePersistence(s.store).save("slot-1", { ...snap, domain: { ...snap.domain, progression } });
  expect(await s.session.saves.loadAsync("slot-1")).toBe(true);
  steps(s.session, 1);
  const p = s.session.sim.player()!;
  p.health = { current: p.health!.max, max: p.health!.max };
  teleport(s.session, GENZO_SPOT.x + 0.3, GENZO_SPOT.z - 1.8, 0);
  steps(s.session, 1);
  return s;
};

const alive = (e: Entity) => (e.health?.current ?? 0) > 0;
const hostiles = (session: GameSession, id: string) => [...session.sim.world].filter((e) => e.tag === contractTag(id) && e.enemy && alive(e));
const eye = (e: Entity) => ({ x: e.position.x, y: e.position.y + 1.62, z: e.position.z });
const chest = (e: Entity) => ({ x: e.position.x, y: e.position.y + 1.25, z: e.position.z });
const flat = (a: Entity, b: Entity) => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);

/** Aims the player at `t`'s chest from her eyes. */
const aimAt = (p: Entity, t: Entity) => {
  const from = eye(p);
  const to = chest(t);
  p.yaw = Math.atan2(to.x - from.x, to.z - from.z);
  p.pitch = -Math.atan2(to.y - from.y, Math.hypot(to.x - from.x, to.z - from.z));
};

interface Fight {
  readonly seconds: number;
  readonly died: boolean;
  readonly kills: number;
  readonly shots: number;
  /** Damage her rounds put into anyone. */
  readonly dealt: number;
  readonly hpLeft: number;
}

/**
 * She stands where she is, the sights up, and shoots the nearest of `targets` she sees (aimed at
 * its chest each step, a perfect aim) until `done`, she dies or `cap` seconds pass.
 */
const fight = (session: GameSession, targets: () => Entity[], done: () => boolean, cap: number): Fight => {
  let shots = 0;
  let dealt = 0;
  const met = new Set<Entity>(targets());
  const me = () => session.sim.player()?.id;
  const off = [
    session.bus.on("ShotFired", (e) => void (e.shooterId === me() && shots++)),
    session.bus.on("DamageDealt", (e) => void (e.sourceId === me() && (dealt += e.amount))),
  ];
  let ticks = 0;
  for (; ticks < cap * SIM_HZ; ticks++) {
    for (const t of targets()) met.add(t);
    const p = session.sim.player();
    if (!p || !alive(p) || done()) break;
    const near = targets()
      .filter((t) => lineOfSight(session.sim.world, eye(p), chest(t)))
      .sort((a, b) => flat(a, p) - flat(b, p))[0];
    if (near) aimAt(p, near);
    session.step(frame({ fire: near !== undefined, aim: true }));
  }
  for (const f of off) f();
  const p = session.sim.player();
  return { seconds: ticks / SIM_HZ, died: !p || !alive(p), kills: [...met].filter((e) => !alive(e)).length, shots, dealt, hpLeft: p?.health?.current ?? 0 };
};

/** One guard of the job 16 m off in the hall's aisle, the others out of the way: the playtest's duel. */
const duel = (session: GameSession, id: string): Fight => {
  const all = hostiles(session, id);
  const g = all.find((e) => e.key === `${id}-g0`) ?? all[0]!;
  for (const o of all) if (o !== g) o.health = { current: 0, max: o.health!.max };
  steps(session, 1);
  g.position = { x: 2512, y: W3_Y, z: 418 };
  g.prevPosition = g.position;
  teleport(session, 2528, 418, -Math.PI / 2, 0, W3_Y);
  steps(session, 1);
  return fight(session, () => hostiles(session, id).filter((e) => e === g), () => !alive(g), 60);
};

/** Into armoury S, the charges taken (the alarm and the first wave), out at its inner door to corridor S. */
const corridor = (session: GameSession, id: string): Fight => {
  teleport(session, 2555, 402, Math.PI, 0, W3_Y);
  steps(session, 1);
  steps(session, 1, frame({ interact: true }));
  expect(session.sim.domain.flags).toContain(contractAlarmFlag(id));
  teleport(session, 2552, 405, -Math.PI / 2, 0, W3_Y);
  return fight(session, () => hostiles(session, id), () => false, 60);
};

const play = async (make: typeof slice, kind: "duel" | "corridor") => {
  const { session, ui } = await make();
  const job = acceptSabotage(session, ui);
  const guard = hostiles(session, job.id).find((e) => e.key === `${job.id}-g0`)!;
  const r = kind === "duel" ? duel(session, job.id) : corridor(session, job.id);
  return { ...r, level: session.sim.domain.progression.level, maxHp: session.sim.player()?.health?.max ?? 0, guard: `L${guard.enemy?.level} ${guard.health?.max} HP` };
};

describe("W-3's start save at level 12 (ADR-0082, G-909)", () => {
  it("loads from its slot like a save: level 12, the AR-5 loaded in hand, by Genzō, who offers W-3", async () => {
    const { session, ui, store } = await slice();
    const d = session.sim.domain;
    expect(d.progression).toMatchObject({ level: 12, xp: xpForLevel(12), unspent: { attribute: 11, perk: 11 } });
    const rifle = d.inventory.items.find((i) => i.uid === d.equipment.primary)!;
    expect(rifle).toMatchObject({ def: "tessen_ar5", level: 12, loaded: 24 });
    expect(d.equipment.active).toBe("primary");
    expect(session.sim.player()?.combatant).toMatchObject({ weapon: "tessen_ar5", uid: rifle.uid, slot: "primary" });
    expect(d.ammo).toMatchObject({ "556": 96, "9mm": 48 });
    expect(d.inventory.stacks.medkit).toBe(3);
    for (const i of d.inventory.items) expect(i.level).toBe(12);
    const p = session.sim.player()!;
    const max = playerStatsOf(d).maxHp;
    expect(p.health).toEqual({ current: max, max });
    expect(flat(p, { position: GENZO_SPOT } as Entity)).toBeLessThan(2.5);
    expect(ui.getState().toasts.map((t) => translateText("en", t.title))).toContain("Nabrzeże · W-3");
    // Written to its slot at the schema of the day, read back through the checksum, migration and validation.
    const text = store.data.get(W3_SLICE_SLOT)!;
    expect(JSON.parse((JSON.parse(text) as { payload: string }).payload)).toMatchObject({ version: SAVE_SCHEMA_VERSION });
    expect(decodeSave(W3_SLICE_SLOT, text).domain.progression.level).toBe(12);
    await session.saves.refreshSlots();
    expect(ui.getState().slots.map((s) => s.slot)).toContain(W3_SLICE_SLOT);
    // Saved and loaded again through the player's slots: the same state.
    const hash = stateHash(session.sim.snapshot(null, "t", ""));
    expect(await session.saves.saveAsync("slot-2")).toBe(true);
    expect(await session.saves.loadAsync("slot-2")).toBe(true);
    expect(stateHash(session.sim.snapshot(null, "t", ""))).toBe(hash);
    // Genzō offers W-3 to her where she stands.
    expect(acceptSabotage(session, ui).kind).toBe("sabotage");
  });

  it("takes the setup's difficulty and the session's seed, and labels the slot in the player's language", async () => {
    const store = new MemorySaveStore();
    const ui = createUiStore({ settings: { ...DEFAULT_SETTINGS, locale: "pl" } });
    const audio: AudioPort = { play() {}, stopAll() {} };
    const session = new GameSession({ render: new FakeRender(), audio, persistence: new SavePersistence(store), ui, story: STORY_SOURCES, seed: () => 5, now: () => new Date(2026, 10, 17, 9, 30) });
    expect(await session.starts.startW3SliceAsync(DIFFICULTY_PRESETS.hard)).toBe(true);
    steps(session, 1);
    expect(session.sim.domain.difficulty).toEqual(DIFFICULTY_PRESETS.hard);
    expect(session.sim.domain.progression.level).toBe(12);
    const saved = decodeSave(W3_SLICE_SLOT, store.data.get(W3_SLICE_SLOT)!);
    expect(saved.seed).toBe(5);
    expect(saved.meta).toEqual({ label: "17.11, 09:30", objective: "Nabrzeże · W-3" });
    expect(ui.getState().toasts.map((t) => translateText("pl", t.text))).toContain("Poziom 12, załadowany AR-5 w dłoni i punkty do wydania. Genzō czeka przy kontenerze KAIUN obok metra: zapytaj go o partię dronów.");
    // Started again, the slice starts over: the slot is written anew.
    session.sim.enqueue({ type: "set-difficulty", profile: DIFFICULTY_PRESETS.story });
    expect(await session.starts.startW3SliceAsync()).toBe(true);
    expect(decodeSave(W3_SLICE_SLOT, store.data.get(W3_SLICE_SLOT)!).domain.difficulty).toEqual(DIFFICULTY_PRESETS.normal);
  });

  it("the playtest's fights: at level 6 with the Unity-9 she dies in corridor S, from the start save she lives", async () => {
    const before = { duel: await play(levelSix, "duel"), corridor: await play(levelSix, "corridor") };
    const after = { duel: await play(slice, "duel"), corridor: await play(slice, "corridor") };
    if (process.env.G909_OUT) writeFileSync(process.env.G909_OUT, JSON.stringify({ before, after }, null, 1));
    // The duel: one guard of her band's level, killed sooner and with fewer rounds than with the pistol.
    expect(before.duel).toMatchObject({ level: 6, died: false, kills: 1 });
    expect(after.duel).toMatchObject({ level: 12, died: false, kills: 1 });
    expect(after.duel.seconds).toBeLessThan(before.duel.seconds / 2);
    expect(after.duel.shots).toBeLessThanOrEqual(24);
    // Corridor S after the alarm: the playtest's death at level 6, alive after a minute from the start save.
    expect(before.corridor.died).toBe(true);
    expect(after.corridor.died).toBe(false);
    expect(after.corridor.seconds).toBe(60);
    expect(after.corridor.kills).toBeGreaterThan(before.corridor.kills);
  }, 120_000);
});
