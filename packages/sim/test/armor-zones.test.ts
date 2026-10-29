import { describe, expect, it } from "vitest";
import { type DomainState, findItem } from "@seki/core";
import { Simulation, playerStatsOf } from "../src";
import { byKey, collect, input, run, teleportPlayer } from "./helpers";

type Hit = { sourceId: number; targetId: number; amount: number; critical: boolean; zone: string };

/** The guard alone in the alley, the player `distance` m south of it facing it. */
const facingGuard = (distance: number, pitch = 0, patch?: (d: DomainState) => DomainState) => {
  let sim = Simulation.create({ seed: 11 });
  if (patch) sim = Simulation.fromSnapshot({ ...sim.snapshot(null, "t", ""), domain: patch(sim.domain) });
  const guard = byKey(sim, "guard")!;
  for (const g of [...sim.world.with("ai")]) if (g !== guard) sim.world.remove(g);
  teleportPlayer(sim, { x: guard.position.x, y: guard.position.y, z: guard.position.z - distance }, 0, pitch);
  return { sim, guard, hits: collect<Hit>(sim, "DamageDealt") };
};

describe("armor per zone (plan E5)", () => {
  it("a head shot skips the ganger's jacket; the torso takes 3 off", () => {
    const { sim, guard, hits } = facingGuard(5);
    guard.ai!.alerted = false;
    guard.health = { current: 10_000, max: 10_000 };
    // Look a touch up and down to land on the torso and on the head.
    for (const pitch of [0.09, -0.01]) {
      sim.player()!.pitch = pitch;
      run(sim, 20, input({ fire: true }));
    }
    const plain = hits.filter((h) => h.targetId === guard.id && !h.critical);
    const byZone = new Map(plain.map((h) => [h.zone, h.amount]));
    expect(byZone.get("head")).toBe(44);
    expect(byZone.get("torso")).toBe(19);
    expect(guard.enemy?.type).toBe("hebi_ganger");
  });

  it("the ganger's SMG hits the player through the jacket, and the jacket wears", () => {
    const { sim, guard, hits } = facingGuard(4);
    guard.ai!.alerted = true;
    const p = sim.player()!;
    for (let i = 0; i < 900 && !hits.some((h) => h.targetId === p.id && h.zone === "torso" && !h.critical); i++) {
      p.health = { ...p.health!, current: p.health!.max };
      sim.step();
    }
    const torso = hits.filter((h) => h.targetId === p.id && h.zone === "torso" && !h.critical);
    expect(torso[0]?.amount).toBe(4);
    const covered = hits.filter((h) => h.targetId === p.id && (h.zone === "torso" || h.zone === "arm")).length;
    expect(findItem(sim.domain.inventory, "i2")?.condition).toBe(100 - 2 * covered);
    expect(findItem(sim.domain.inventory, "i3")?.condition).toBe(100 - 2 * hits.filter((h) => h.targetId === p.id && h.zone === "leg").length);
  });

  it("without clothes the same SMG deals 5 on the torso", () => {
    const naked = (d: DomainState): DomainState => ({ ...d, equipment: { ...d.equipment, torso: null, legs: null } });
    const { sim, guard, hits } = facingGuard(4, 0, naked);
    guard.ai!.alerted = true;
    const p = sim.player()!;
    for (let i = 0; i < 900 && !hits.some((h) => h.targetId === p.id && h.zone === "torso" && !h.critical); i++) {
      p.health = { ...p.health!, current: p.health!.max };
      sim.step();
    }
    expect(hits.find((h) => h.targetId === p.id && h.zone === "torso" && !h.critical)?.amount).toBe(5);
  });

  it("a ballistic vest protects the torso and slows the wearer", () => {
    const vest = (d: DomainState): DomainState => ({
      ...d,
      inventory: { ...d.inventory, items: [...d.inventory.items, { uid: "i4", def: "ballistic_vest", rarity: "common", condition: 100 }], nextUid: 5 },
      equipment: { ...d.equipment, torso: "i4" },
    });
    const { sim } = facingGuard(4, 0, vest);
    expect(playerStatsOf(sim.domain).moveSpeed).toBeCloseTo(4.2 - 0.2);
    run(sim, 30, input({ moveZ: 1 }));
    const v = sim.player()!.velocity!;
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(4.0);
  });
});
