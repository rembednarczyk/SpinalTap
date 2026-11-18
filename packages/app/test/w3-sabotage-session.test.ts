import { describe, expect, it } from "vitest";
import { type DomainState, type EffectDescriptor, SABOTAGE, W3_VIRUS_FLAG, W3_VIRUS_ITEM, contractAlarmFlag, contractObjective, contractSecondsLeft, contractTag } from "@seki/core";
import { GENZO_SPOT, SIM_HZ, W3_CORE_BLIND_SPOT, W3_VIRUS_TERMINAL, stateHash } from "@seki/sim";
import { translateText } from "@seki/ui";
import { frame, setup, steps, teleport } from "./story-helpers";
import type { GameSession } from "../src/game-session";

/**
 * W-3's sabotage in a session, headless (ADR-0082 stage 3): Genzō offers it once, the virus goes
 * into the core in server room N from the camera's dead angle, the line's screens and beacons
 * follow the job through the renderer's port, out of the zone unseen the job is paid by phone; a
 * save during the upload loads to the same state; 06:00 without the virus ships the batch.
 */

const ui = (u: ReturnType<typeof setup>["ui"]) => u.getState();
/** The running job's step as the HUD writes it in Polish. */
const step = (session: GameSession): string => {
  const c = session.sim.domain.contracts.active;
  return c ? translateText("pl", contractObjective(c, contractSecondsLeft(c, session.sim.tick, SIM_HZ))) : "";
};

const start = () => {
  const s = setup();
  const effects: EffectDescriptor[] = [];
  const play = s.render.playEffect.bind(s.render);
  s.render.playEffect = (e: EffectDescriptor) => {
    effects.push(e);
    play(e);
  };
  s.session.newGame();
  steps(s.session, 2);
  return { ...s, effects };
};

const offer = (session: GameSession, u: ReturnType<typeof setup>["ui"]) => {
  teleport(session, GENZO_SPOT.x + 0.3, GENZO_SPOT.z - 1.8, 0);
  steps(session, 1);
  steps(session, 1, frame({ interact: true }));
  return ui(u).dialogue?.choices ?? [];
};

const acceptSabotage = (session: GameSession, u: ReturnType<typeof setup>["ui"]) => {
  const choice = offer(session, u).find((c) => c.text.startsWith("Co to za partia dronów"));
  if (!choice) throw new Error("no sabotage offer");
  session.intents.choose(choice.index);
  session.intents.closeDialogue();
  steps(session, 2);
  const job = session.sim.domain.contracts.active;
  if (job?.kind !== "sabotage") throw new Error("no sabotage");
  return job;
};

/** In server room N by the core, in the camera's dead angle on the east rack's side, facing the terminal. */
const atCore = (session: GameSession) => {
  const s = W3_CORE_BLIND_SPOT;
  teleport(session, s.x, s.z, Math.atan2(W3_VIRUS_TERMINAL.x - s.x, W3_VIRUS_TERMINAL.z - s.z));
  steps(session, 1);
};

const last = <K extends EffectDescriptor["kind"]>(effects: readonly EffectDescriptor[], kind: K) =>
  effects.filter((e): e is Extract<EffectDescriptor, { kind: K }> => e.kind === kind).at(-1);

type Holder = { holder: { domain: DomainState } };
const setDomain = (session: GameSession, change: (d: DomainState) => DomainState): void => {
  const holder = (session.sim as unknown as Holder).holder;
  holder.domain = change(holder.domain);
};

describe("W-3's sabotage in a session (ADR-0082 stage 3)", () => {
  it("quiet: the virus in by the core, the screens and the way out unseen paid by phone, Tessen as it was", () => {
    const { session, ui: u, effects } = start();
    const tessen = session.sim.domain.reputation.tessen;
    const job = acceptSabotage(session, u);
    expect(step(session)).toContain("rdzenia kalibracji");
    expect(last(effects, "line-screens")?.state).toBe("idle");
    expect(last(effects, "alarm-light")?.active).toBe(false);
    // The four posts, the shift manager on the mezzanine (G-929) and the observer in the tower's cabin (G-908).
    const crew = [...session.sim.world].filter((e) => e.tag === contractTag(job.id));
    expect(crew).toHaveLength(6);
    for (const g of crew) g.health = { current: 0, max: g.health!.max };
    atCore(session);
    expect(ui(u).prompt ?? "").toMatch(/Upload the virus|Wgraj wirusa/);
    steps(session, 1, frame({ interact: true }));
    // The breach is optional: lost (no daemon), the upload runs its 40 s.
    session.intents.submitBreach([]);
    steps(session, 2);
    expect(session.sim.domain.contracts.active).toMatchObject({ route: "quiet" });
    expect(last(effects, "line-screens")?.state).toBe("upload");
    expect(step(session)).toContain("aż wirus się wgra");
    steps(session, SABOTAGE.uploadSeconds * SIM_HZ);
    expect(session.sim.domain.flags).toContain(W3_VIRUS_FLAG);
    // Genzō's pendrive stays in the core (G-907).
    expect(session.sim.domain.inventory.keyItems).not.toContain(W3_VIRUS_ITEM);
    expect(last(effects, "line-screens")?.state).toBe("infected");
    expect(step(session)).toContain("niezauważona");
    const eddies = session.sim.domain.wallet.eddies;
    teleport(session, 2527, 384, 0);
    steps(session, 2);
    expect(session.sim.domain.contracts.active).toBeNull();
    expect(session.sim.domain.wallet.eddies).toBeGreaterThan(eddies + job.reward - 1);
    // The crew knocked out is Tessen's loss on its own; the job itself costs nothing with Tessen.
    const crewCost = crew.length * 4;
    expect(session.sim.domain.reputation.tessen).toBe(tessen - crewCost);
    // Genzō does not offer it again.
    expect(offer(session, u).map((c) => c.text)).not.toContain("Co to za partia dronów?");
  });

  it("the alarm turns the line's beacons red, and a save during the upload loads to the same state", async () => {
    const { session, ui: u, effects } = start();
    const job = acceptSabotage(session, u);
    for (const g of [...session.sim.world].filter((e) => e.tag === contractTag(job.id))) g.health = { current: 0, max: g.health!.max };
    atCore(session);
    steps(session, 1, frame({ interact: true }));
    session.intents.submitBreach([]);
    steps(session, 10 * SIM_HZ);
    const hash = stateHash(session.sim.snapshot(null, "t", ""));
    expect(await session.saves.saveAsync("mid")).toBe(true);
    expect(await session.saves.loadAsync("mid")).toBe(true);
    expect(stateHash(session.sim.snapshot(null, "t", ""))).toBe(hash);
    expect(session.sim.domain.contracts.active?.progress).toBeGreaterThan(9 * SIM_HZ);
    setDomain(session, (d) => ({ ...d, flags: [...d.flags, contractAlarmFlag(job.id)] }));
    steps(session, 1);
    expect(last(effects, "alarm-light")?.active).toBe(true);
  });

  it("a camera rebooted stays blind through a save and a load (G-882): no alarm till its reboot runs out", async () => {
    const { session, ui: u } = start();
    const job = acceptSabotage(session, u);
    for (const g of [...session.sim.world].filter((e) => e.tag === contractTag(job.id))) g.health = { current: 0, max: g.health!.max };
    // In front of the terminal, in the camera's view, with it rebooted for 20 s more (as `reboot_optics` leaves it).
    const cam = [...session.sim.world].find((e) => e.key === "dev:w3-server-cam")!;
    session.sim.world.addComponent(cam, "hackFx", { pinged: 0, blind: 20, crippled: 0 });
    teleport(session, W3_VIRUS_TERMINAL.x, W3_VIRUS_TERMINAL.z - 1, 0);
    steps(session, 1);
    expect(await session.saves.saveAsync("blind")).toBe(true);
    expect(await session.saves.loadAsync("blind")).toBe(true);
    const alarm = contractAlarmFlag(job.id);
    steps(session, 5 * SIM_HZ);
    expect(session.sim.domain.flags).not.toContain(alarm);
    steps(session, 18 * SIM_HZ);
    expect(session.sim.domain.flags).toContain(alarm);
  });

  it("06:00 without the virus ships the batch: the job fails, the beacons go back to amber", () => {
    const { session, ui: u, effects } = start();
    const job = acceptSabotage(session, u);
    setDomain(session, (d) => ({ ...d, flags: [...d.flags, contractAlarmFlag(job.id)] }));
    steps(session, 1);
    expect(last(effects, "alarm-light")?.active).toBe(true);
    setDomain(session, (d) => ({ ...d, contracts: { ...d.contracts, active: { ...job, deadlineTick: session.sim.tick + 1 } } }));
    steps(session, 3);
    expect(session.sim.domain.contracts.active).toBeNull();
    expect(session.sim.domain.flags).toContain(`contract_failed:${job.id}`);
    // The batch gone, Genzō has his pendrive back (G-907).
    expect(session.sim.domain.inventory.keyItems).not.toContain(W3_VIRUS_ITEM);
    expect(last(effects, "alarm-light")?.active).toBe(false);
  });
});
