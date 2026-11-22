import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type DomainEvents } from "@seki/core";
import { ALL_GALLERY_SHOPS, CLINIC_WAKE_SPOT, INTERIORS, Simulation, TRASA_PODZIEMNA_WALK, clinicPoint, w3, groundY, interiorAt, koiPoint, stateHash } from "../src";
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
    // The metro's platforms (ADR-0071 stage 4) last, in the line's order.
    const shops = INTERIORS.filter((i) => i.id.startsWith("alchemia-shop-"));
    expect(INTERIORS.filter((i) => !shops.includes(i)).map((i) => i.id)).toEqual(["clinic", "neon-koi", "tessen-office", "w3-hall", "w3-basement", "trasa-podziemna", "capsule", "metro-shinsekai", "metro-kanal", "metro-targ", "metro-doki", "alchemia-foodhall", "alchemia-parking", "alchemia-p2", "alchemia-p2-tunnel", "alchemia-shelter", "alchemia-gallery"]);
    // Each of Alchemia's shops and front units an interior of its own (22.11), inside the gallery and found before it.
    expect(shops.map((i) => i.id)).toEqual(ALL_GALLERY_SHOPS.map((s) => `alchemia-shop-${s.id}`));
    const gallery = INTERIORS.findIndex((i) => i.id === "alchemia-gallery");
    for (const i of shops) {
      expect(i.within).toBe("alchemia-gallery");
      expect(i.autosave).toBe(false);
      expect(INTERIORS.indexOf(i)).toBeLessThan(gallery);
    }
    expect(new Set(INTERIORS.map((i) => i.id)).size).toBe(INTERIORS.length);
    for (const i of INTERIORS) expect(i.name).toBe(`interior.${i.id}`);
  });

  it("finds the clinic, the bar and the office from their rooms, and nothing on the street", () => {
    expect(interiorAt(CLINIC_WAKE_SPOT)?.id).toBe("clinic");
    expect(interiorAt(clinicPoint(-10, 0, 6.6))?.id).toBe("clinic");
    expect(interiorAt(koiPoint(12.6, 0, 1.2))?.id).toBe("neon-koi");
    expect(interiorAt(w3(2491, 0, 441))?.id).toBe("tessen-office");
    expect(interiorAt(clinicPoint(-5.6, 0, 4.4))).toBeNull();
    expect(interiorAt(w3(2497.4, 0, 443))).toBeNull();
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
  });

  it("keeps the interior out of the snapshot: the same game hashes the same inside and out", () => {
    const a = quiet(7);
    const b = quiet(7);
    run(a, 3, input());
    b.session.interior = null;
    run(b, 3, input());
    expect(stateHash(a.snapshot(null, "t", ""))).toBe(stateHash(b.snapshot(null, "t", "")));
  });
});

describe("Alchemia's shops and P-2's tunnel as rooms of their own (22.11)", () => {
  const mid = (s: (typeof ALL_GALLERY_SHOPS)[number], y: number) => ({ x: (s.rect.x0 + s.rect.x1) / 2, y, z: (s.rect.z0 + s.rect.z1) / 2 });

  it("finds every shop from its middle, and the gallery on the floor before it", () => {
    for (const s of ALL_GALLERY_SHOPS) {
      const room = INTERIORS.find((i) => i.id === `alchemia-shop-${s.id}`)!.rooms[0]!;
      expect(interiorAt(mid(s, room.bottom + 0.1))?.id, s.id).toBe(`alchemia-shop-${s.id}`);
    }
    const p1 = ALL_GALLERY_SHOPS.find((s) => s.id === "p1-w1")!;
    expect(interiorAt({ x: p1.rect.x1 + 1, y: -2.1, z: (p1.rect.z0 + p1.rect.z1) / 2 })?.id).toBe("alchemia-gallery");
  });

  it("steps from the gallery into a shop at its wall, the gallery's keep notwithstanding, and back out past the shop's", () => {
    const s = ALL_GALLERY_SHOPS.find((x) => x.id === "p1-w1")!;
    const z = (s.rect.z0 + s.rect.z1) / 2;
    // Just inside the shop's front (x1, it opens east), held by the gallery.
    expect(interiorAt({ x: s.rect.x1 - 0.1, y: -2.1, z }, "alchemia-gallery", INTERIOR_KEEP)?.id).toBe("alchemia-shop-p1-w1");
    // Just out of it, held by the shop: it keeps the player a step, then the gallery.
    expect(interiorAt({ x: s.rect.x1 + 0.1, y: -2.1, z }, "alchemia-shop-p1-w1", INTERIOR_KEEP)?.id).toBe("alchemia-shop-p1-w1");
    expect(interiorAt({ x: s.rect.x1 + 0.5, y: -2.1, z }, "alchemia-shop-p1-w1", INTERIOR_KEEP)?.id).toBe("alchemia-gallery");
  });

  it("tells P-2's tunnel from its store", () => {
    const tunnel = INTERIORS.find((i) => i.id === "alchemia-p2-tunnel")!.rooms[0]!;
    const at = { x: (tunnel.minX + tunnel.maxX) / 2, y: tunnel.bottom + 0.1, z: (tunnel.minZ + tunnel.maxZ) / 2 };
    expect(interiorAt(at)?.id).toBe("alchemia-p2-tunnel");
    expect(interiorAt({ ...at, z: tunnel.minZ - 3 })?.id).toBe("alchemia-p2");
  });
});
