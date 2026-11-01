import { describe, expect, it } from "vitest";
import { type DomainEvents, WITNESS_CALL_SECONDS } from "@seki/core";
import { TAKEDOWN_TIME, escortEntity, takedownDistance } from "../src";
import { collect, run, teleportPlayer } from "./helpers";
import { CROUCH, camera, offset, patrol, quietStreet, stallholder, takeDown, ticks, victim } from "./takedown-scenes";

/** Stage 2 of ADR-0065: who sees a takedown (an assault, heat as for an attack on a civilian). */

describe("witnesses of a takedown (ADR-0065)", () => {
  it("unseen it is no crime; seen by a patrol it is an assault, a level below a murder", () => {
    for (const lethal of [false, true]) {
      const sim = quietStreet();
      const guard = victim(sim);
      const done = collect<DomainEvents["TakedownDone"]>(sim, "TakedownDone");
      const reports = collect(sim, "CrimeReported");
      takeDown(sim, lethal);
      run(sim, ticks(2), CROUCH);
      expect(done).toEqual([{ target: guard.id, lethal, witnessed: false }]);
      expect(reports).toEqual([]);
      expect(sim.domain.heat.level).toBe(0);
    }
    for (const lethal of [false, true]) {
      const sim = quietStreet();
      const guard = victim(sim);
      // Ten metres east, looking at her.
      const w = patrol(sim, 4100, offset(sim, 10, 0), -Math.PI / 2);
      const done = collect<DomainEvents["TakedownDone"]>(sim, "TakedownDone");
      const reports = collect<DomainEvents["CrimeReported"]>(sim, "CrimeReported");
      takeDown(sim, lethal);
      expect(done).toEqual([{ target: guard.id, lethal, witnessed: true }]);
      expect(reports.map((r) => [r.crime, r.channel, r.witnessId])).toEqual(
        lethal ? [["assault", "patrol", w.id], ["murder", "patrol", w.id]] : [["assault", "patrol", w.id]],
      );
      expect(sim.domain.heat.level).toBe(lethal ? 2 : 1);
      expect(sim.domain.heat.faction).toBe("hebi");
    }
  });

  it("a camera is a witness", () => {
    const sim = quietStreet();
    const guard = victim(sim);
    // Six metres south of her, looking north at her.
    const cam = camera(sim, 4200, offset(sim, 0, -6), 0);
    const done = collect<DomainEvents["TakedownDone"]>(sim, "TakedownDone");
    const reports = collect<DomainEvents["CrimeReported"]>(sim, "CrimeReported");
    takeDown(sim);
    expect(done).toEqual([{ target: guard.id, lethal: false, witnessed: true }]);
    expect(reports.map((r) => [r.crime, r.channel, r.witnessId])).toEqual([["assault", "camera", cam.id]]);
    expect(sim.domain.heat.level).toBe(1);
  });

  it("a guard knocked out mid-fight is no crime, even seen", () => {
    const sim = quietStreet();
    const guard = victim(sim);
    guard.ai!.alerted = true;
    guard.melee!.stagger = 2;
    guard.melee!.stunned = true;
    patrol(sim, 4100, offset(sim, 10, 0), -Math.PI / 2);
    const done = collect<DomainEvents["TakedownDone"]>(sim, "TakedownDone");
    const reports = collect(sim, "CrimeReported");
    takeDown(sim);
    expect(guard.unconscious).toBe(true);
    expect(done).toEqual([{ target: guard.id, lethal: false, witnessed: true }]);
    expect(reports).toEqual([]);
  });

  it("takes down a civilian with health, but not an escort", () => {
    const sim = quietStreet();
    const c = stallholder(sim);
    sim.step(CROUCH);
    expect(sim.session.takedownTarget?.id).toBe(c.id);
    sim.world.remove(c);
    sim.world.add(escortEntity(4001, "mika", [offset(sim, 0, 1.2)], sim.player()!.chunk ?? ""));
    sim.step(CROUCH);
    expect(sim.session.takedownTarget).toBeNull();
  });

  it("leaves out anyone with a talk, a shop or a job to offer, even with nobody nearer to talk to", () => {
    for (const interactable of [
      { kind: "dialogue", dialogueId: "hana", prompt: "prompt.talk.hana", radius: 0.5 },
      { kind: "shop", shopId: "oyaji", dialogueId: "oyaji", prompt: "prompt.shop.oyaji", radius: 0.5 },
    ] as const) {
      const sim = quietStreet();
      const c = stallholder(sim);
      // Its talk reaches less far than she stands: no interaction prompt competes.
      sim.world.addComponent(c, "interactable", interactable);
      sim.step(CROUCH);
      expect(sim.session.takedownTarget).toBeNull();
      expect(takedownDistance(sim.player()!, c as Parameters<typeof takedownDistance>[1])).toBeNull();
    }
  });

  it("knocking out a witness on the phone cuts the call off: no report", () => {
    const sim = quietStreet();
    victim(sim);
    // A bystander with health two metres west of her, seeing it all.
    const w = stallholder(sim, 4300, offset(sim, -2, 0));
    const calls = collect(sim, "WitnessCalling");
    const reports = collect(sim, "CrimeReported");
    takeDown(sim);
    expect(calls).toHaveLength(1);
    // Straight after it, before the call goes through; looking away, so no aimed gun cuts the call off.
    teleportPlayer(sim, { ...w.position, x: w.position.x + 0.8 }, Math.PI / 2);
    expect(w.civilian!.crowd?.call).toBeTruthy();
    takeDown(sim);
    expect(w.unconscious).toBe(true);
    run(sim, ticks(WITNESS_CALL_SECONDS + 2), CROUCH);
    expect(reports).toEqual([]);
    expect(w.civilian!.crowd?.call ?? null).toBeNull();
  });

  it("a witness held in the takedown does not finish its call: it waits, and goes quiet once knocked out (G-141)", () => {
    const sim = quietStreet();
    victim(sim);
    const w = stallholder(sim, 4300, offset(sim, -2, 0));
    const reports = collect(sim, "CrimeReported");
    takeDown(sim);
    teleportPlayer(sim, { ...w.position, x: w.position.x + 0.8 }, Math.PI / 2);
    // Less of the call is left than the hold takes.
    const left = 0.38;
    w.civilian!.crowd!.call!.left = left;
    sim.step(CROUCH);
    const held = w.civilian!.crowd!.call!.left;
    sim.enqueue({ type: "takedown", lethal: false });
    run(sim, ticks(TAKEDOWN_TIME / 2), CROUCH);
    expect(sim.session.takedown?.target).toBe(w.id);
    expect(w.civilian!.crowd?.call?.left).toBe(held);
    run(sim, ticks(TAKEDOWN_TIME), CROUCH);
    expect(w.unconscious).toBe(true);
    run(sim, ticks(WITNESS_CALL_SECONDS + 2), CROUCH);
    expect(reports).toEqual([]);
  });

  it("a witness that breaks free of the hold picks its call up where it left it (G-141)", () => {
    const sim = quietStreet();
    victim(sim);
    const w = stallholder(sim, 4300, offset(sim, -2, 0));
    const reports = collect<DomainEvents["CrimeReported"]>(sim, "CrimeReported");
    takeDown(sim);
    teleportPlayer(sim, { ...w.position, x: w.position.x + 0.8 }, Math.PI / 2);
    const left = 0.38;
    w.civilian!.crowd!.call!.left = left;
    sim.step(CROUCH);
    sim.enqueue({ type: "takedown", lethal: false });
    run(sim, ticks(TAKEDOWN_TIME / 2), CROUCH);
    const p = sim.player()!;
    p.health = { ...p.health!, current: p.health!.current - 5 };
    sim.step(CROUCH);
    expect(sim.session.takedown).toBeNull();
    expect(w.unconscious).toBeUndefined();
    expect(reports).toEqual([]);
    run(sim, ticks(left) + 1, CROUCH);
    expect(reports.map((r) => [r.crime, r.channel, r.witnessId])).toEqual([["assault", "civilian", w.id]]);
  });
});
