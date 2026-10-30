import { describe, expect, it } from "vitest";
import { checksum, decodeSave } from "@seki/persistence";
import { CLINIC_WAKE_SPOT, Simulation } from "@seki/sim";

/** An old save as v14 wrote it in the old city: Seki on Ulica Kanałowa, a bag in the alley. */
const v14Save = (): string => {
  const now = Simulation.create({ seed: 4 }).snapshot(null, "stara", "");
  const payload = {
    ...now,
    version: 14,
    entities: now.entities.map((e) => (e.key === "player" ? { ...e, position: { x: 40, y: 0, z: 78 } } : { ...e, position: { x: 0, y: 0, z: 30 } })),
    streaming: { loadedChunks: ["shinsekai-7", "kanal"] },
    domain: { ...now.domain, loot: { ...now.domain.loot, containers: [{ key: "loot:guard", position: { x: 0, y: 0, z: 33 }, chunk: "shinsekai-7", expiresAtTick: 1e6, lines: [{ kind: "eddies", qty: 40 }] }] } },
  };
  const text = JSON.stringify(payload);
  return JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text });
};

describe("a save from before Lublin (ADR-0045)", () => {
  it("loads into the clinic on Krakowskie Przedmieście with everyone where the content puts them", () => {
    const sim = Simulation.fromSnapshot(decodeSave("stara", v14Save()));
    // The migration spells the chair out; the content computes it (ADR-0045).
    const p = sim.player()!.position;
    expect(Math.hypot(p.x - CLINIC_WAKE_SPOT.x, p.y - CLINIC_WAKE_SPOT.y, p.z - CLINIC_WAKE_SPOT.z)).toBeLessThan(1e-6);
    expect(sim.streamer.loadedChunks).toEqual(["krakowskie-2-0"]);
    expect(sim.district).toBe("shinsekai-7");
    const at = (key: string) => [...sim.world].find((e) => e.key === key)?.position;
    // Kaito by the chair, Ume on the deptak, the courier's crew in the yard behind the car wash.
    expect(Math.hypot(at("fixer")!.x - CLINIC_WAKE_SPOT.x, at("fixer")!.z - CLINIC_WAKE_SPOT.z)).toBeLessThan(3);
    expect(Math.hypot(at("guard")!.x - CLINIC_WAKE_SPOT.x, at("guard")!.z - CLINIC_WAKE_SPOT.z)).toBeGreaterThan(60);
    // The bag from the old alley lies on the clinic's floor, with what was in it, from the first step.
    sim.step();
    const bag = [...sim.world.with("lootBag")].find((b) => b.lootBag.key === "loot:guard");
    expect(bag).toBeDefined();
    expect(Math.hypot(bag!.position.x - CLINIC_WAKE_SPOT.x, bag!.position.z - CLINIC_WAKE_SPOT.z)).toBeLessThan(4);
    expect(sim.player()!.position.y).toBeCloseTo(CLINIC_WAKE_SPOT.y, 1);
  });
});
