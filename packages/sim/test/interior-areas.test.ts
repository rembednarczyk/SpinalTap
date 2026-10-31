import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type DomainEvents } from "@seki/core";
import { CLINIC_WAKE_SPOT, INTERIORS, Simulation, TRASA_PODZIEMNA_WALK, clinicPoint, docks, groundY, interiorAt, koiPoint, stateHash } from "../src";
import { inBuilding } from "../src/content/lublin/places";
import { TRASA_PODZIEMNA } from "../src/content/lublin/sites";
import { INTERIOR_KEEP } from "../src/systems/interior-system";
import { input, run, teleportPlayer } from "./helpers";

/**
 * Interiors as areas (ADR-0061): the `interior` system tells the app when the player steps into a
 * place and out of it, once per crossing, never on a start or a load inside one.
 */

type Crossing = `in:${string}` | `out:${string}`;

const crossings = (sim: Simulation): Crossing[] => {
  const out: Crossing[] = [];
  sim.bus.on("InteriorEntered", (e: DomainEvents["InteriorEntered"]) => out.push(`in:${e.interiorId}`));
  sim.bus.on("InteriorLeft", (e: DomainEvents["InteriorLeft"]) => out.push(`out:${e.interiorId}`));
  return out;
};

/** Sprints to (x, z), turning towards it every step; the distance left when it stopped. */
const walkTo = (sim: Simulation, x: number, z: number): number => {
  for (let i = 0; i < 900; i++) {
    const p = sim.player()!;
    const d = Math.hypot(x - p.position.x, z - p.position.z);
    if (d < 0.5) return d;
    const want = Math.atan2(x - p.position.x, z - p.position.z);
    sim.step({ ...EMPTY_INPUT, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) });
  }
  const p = sim.player()!;
  return Math.hypot(x - p.position.x, z - p.position.z);
};

/** A new game with the AI of the street taken out, so nobody walks into the way. */
const quiet = (seed = 3): Simulation => {
  const sim = Simulation.create({ seed });
  run(sim, 1);
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

describe("interiors as areas (ADR-0061)", () => {
  it("names every interior in the catalogues and keeps the ids unique", () => {
    expect(INTERIORS.map((i) => i.id)).toEqual(["clinic", "neon-koi", "tessen-office", "trasa-podziemna"]);
    for (const i of INTERIORS) expect(i.name).toBe(`interior.${i.id}`);
  });

  it("finds the clinic, the bar and the office from their rooms, and nothing on the street", () => {
    expect(interiorAt(CLINIC_WAKE_SPOT)?.id).toBe("clinic");
    expect(interiorAt(clinicPoint(-10, 0, 6.6))?.id).toBe("clinic");
    expect(interiorAt(koiPoint(12.6, 0, 1.2))?.id).toBe("neon-koi");
    expect(interiorAt(docks(-24, 0, 133))?.id).toBe("tessen-office");
    expect(interiorAt(clinicPoint(-5.6, 0, 4.4))).toBeNull();
    expect(interiorAt(docks(-16.6, 0, 132))).toBeNull();
    // A storey above the clinic is not in it.
    expect(interiorAt(clinicPoint(-10, 4.5, 6.6))).toBeNull();
  });

  it("starts Trasa Podziemna at the Trybunał's facade, not metres into its vestibule (G-094)", () => {
    const { from } = TRASA_PODZIEMNA.vestibule;
    let facade = from.x;
    while (!inBuilding(facade, from.z)) facade += 0.01;
    const feet = (x: number) => ({ x, y: TRASA_PODZIEMNA.door + 0.1, z: from.z });
    expect(interiorAt(feet(facade + 0.3))?.id).toBe("trasa-podziemna");
    expect(interiorAt(feet(facade - 0.3))).toBeNull();
    // On the way out the interior holds as far as the doorway, and no further onto the Rynek.
    expect(interiorAt(feet(facade - 0.05), "trasa-podziemna", INTERIOR_KEEP)?.id).toBe("trasa-podziemna");
    expect(interiorAt(feet(facade - 0.3), "trasa-podziemna", INTERIOR_KEEP)).toBeNull();
  });

  it("walks out of the clinic and back in through its door: one event each way, in order", () => {
    const sim = quiet();
    const seen = crossings(sim);
    teleportPlayer(sim, clinicPoint(-10, 0, 4.4));
    run(sim, 1);
    expect(seen).toEqual([]);
    expect(walkTo(sim, clinicPoint(-4, 0, 4.4).x, clinicPoint(-4, 0, 4.4).z)).toBeLessThan(0.5);
    expect(seen).toEqual(["out:clinic"]);
    run(sim, 20);
    expect(walkTo(sim, clinicPoint(-10, 0, 4.4).x, clinicPoint(-10, 0, 4.4).z)).toBeLessThan(0.5);
    run(sim, 20);
    expect(seen).toEqual(["out:clinic", "in:clinic"]);
  });

  it("does not flicker in a doorway: standing on the threshold stays one place", () => {
    const sim = quiet();
    const seen = crossings(sim);
    // Just inside the front wall's inner face, then 0.1 m out into the doorway and back.
    teleportPlayer(sim, clinicPoint(-7.4, 0, 4.4));
    run(sim, 1);
    teleportPlayer(sim, clinicPoint(-7.2, 0, 4.4));
    run(sim, 1);
    teleportPlayer(sim, clinicPoint(-7.4, 0, 4.4));
    run(sim, 1);
    expect(seen).toEqual([]);
  });

  it("starts a new game in the clinic without an event, and a load inside the bar without one", () => {
    const fresh = Simulation.create({ seed: 5 });
    const seen = crossings(fresh);
    run(fresh, 3);
    expect(seen).toEqual([]);
    teleportPlayer(fresh, koiPoint(12.6, 0, 1.2));
    run(fresh, 1);
    expect(seen).toEqual(["out:clinic", "in:neon-koi"]);
    const loaded = Simulation.fromSnapshot(JSON.parse(JSON.stringify(fresh.snapshot(null, "t", ""))));
    const again = crossings(loaded);
    run(loaded, 3);
    expect(again).toEqual([]);
    expect(loaded.session.interior).toBe("neon-koi");
  });

  it("goes down Trasa Podziemna and back up as one interior, whatever room the way runs through", () => {
    const sim = Simulation.create({ seed: 2 });
    const seen = crossings(sim);
    const [x0, z0] = TRASA_PODZIEMNA_WALK[0]!;
    teleportPlayer(sim, { x: x0, y: groundY(x0, z0), z: z0 }, Math.PI / 2);
    run(sim, 1);
    seen.length = 0;
    for (const [x, z] of TRASA_PODZIEMNA_WALK.slice(1)) expect(walkTo(sim, x, z), `${x}, ${z}`).toBeLessThan(0.5);
    expect(seen).toEqual(["in:trasa-podziemna"]);
    for (const [x, z] of [...TRASA_PODZIEMNA_WALK].reverse().slice(1)) expect(walkTo(sim, x, z), `${x}, ${z}`).toBeLessThan(0.5);
    expect(seen).toEqual(["in:trasa-podziemna", "out:trasa-podziemna"]);
  }, 60_000);

  it("keeps the interior out of the snapshot: the same game hashes the same inside and out", () => {
    const a = quiet(7);
    const b = quiet(7);
    run(a, 3, input());
    b.session.interior = null;
    run(b, 3, input());
    expect(stateHash(a.snapshot(null, "t", ""))).toBe(stateHash(b.snapshot(null, "t", "")));
  });
});
