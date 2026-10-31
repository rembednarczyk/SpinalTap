// @ts-expect-error The engine is typed for the browser; the test reads the file off disk.
import { readFileSync } from "node:fs";
import type { StreetPropItem } from "@seki/core";
import { WORLD_CHUNKS, WORLD_STREET_PROPS, chunkAt, inBuilding, nearestWall } from "@seki/sim";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { parseCityProps, transformProp, triangleCount } from "../src/renderer/city-props";
import { ToonMaterials } from "../src/npr/toon-material";
import { MeshSink } from "../src/renderer/mesh-sink";
import { type WorldProp, toWorld } from "../src/renderer/mapcity/prop-batch";
import { DOG_DEPTH, clearOf, dogModel, gateDogs, stallDog } from "../src/renderer/mapcity/robodogs";
import { StreetProps } from "../src/renderer/mapcity/street-props";
import { CABLE_SPAN, bakePoles, farPole, isPoleLamp, poleFits, poleCables, poleLights, poleModel, polePairs, poleXform } from "../src/renderer/mapcity/utility-poles";

/** The body's radius (`BODY` in sim's `world/factory.ts`): a body's middle never comes nearer a wall or a solid. */
const BODY = { radius: 0.38 } as const;

/** CC-BY street props (ADR-0063): utility poles on Podzamcze's and Nabrzeże's side streets, robot dogs. */

const bytes = (readFileSync as (url: URL) => Uint8Array)(new URL("../../app/public/city/city-props.glb", import.meta.url));
const props = parseCityProps(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
const pole = poleModel(props)!;
const dog = dogModel(props)!;

const district = (id: string) => WORLD_CHUNKS.find((c) => c.id === id)?.district;
const pieces: WorldProp[] = Object.values(WORLD_STREET_PROPS).flatMap((items) => toWorld(items, { x: 0, y: 0, z: 0 }));
const poles = pieces.filter(isPoleLamp);

describe("CC-BY street props in city-props.glb (ADR-0063)", () => {
  it("holds the pole and the robot dog: light, in metres, the pole's mast on its origin with a lamp", () => {
    expect(triangleCount(pole)).toBeLessThanOrEqual(1500);
    expect(triangleCount(dog)).toBeLessThanOrEqual(1500);
    expect(pole.size.y).toBeGreaterThan(7.5);
    expect(pole.size.y).toBeLessThan(10);
    expect(pole.lights?.length).toBe(1);
    // The lamp hangs over the street, in front of the mast, some 5 to 7 m up.
    const lamp = poleLights(pole)[0]!;
    expect(lamp.at.y).toBeGreaterThan(5);
    expect(lamp.at.y).toBeLessThan(7);
    expect(lamp.at.z).toBeGreaterThan(0.5);
    // The mast's foot: the vertices of the bottom half metre lie within the lamp's solid (0.19 m half side, ADR-0050) and a little.
    const { positions } = transformProp(pole, poleXform({ prop: "lamp-road", x: 0, y: 0, z: 0, yaw: 0, shape: 0, scale: 1 }));
    for (let i = 0; i < positions.length; i += 3) if (positions[i + 1]! < 0.5) expect(Math.hypot(positions[i]!, positions[i + 2]!)).toBeLessThan(0.36);
    // The dog: half a metre tall, narrower than what the body keeps clear of a wall.
    expect(dog.size.y).toBeGreaterThan(0.35);
    expect(dog.size.y).toBeLessThan(0.7);
    expect(dog.size.x).toBeLessThanOrEqual(DOG_DEPTH);
    expect(DOG_DEPTH).toBeLessThan(BODY.radius);
  });
});

describe("utility poles over the side streets (ADR-0063)", () => {
  it("stand on road lamps of Podzamcze and Nabrzeże only, never on the Rynek, the Old Town or Krakowskie", () => {
    expect(poles.length).toBeGreaterThan(30);
    expect(poles.every((p) => p.prop === "lamp-road")).toBe(true);
    const where = new Set(poles.map((p) => chunkAt(p.x, p.z)?.district));
    expect([...where].sort()).toEqual(["doki", "targ"]);
    // The main roads keep their lamps: most road lamps of the two districts stay lamps.
    const lamps = pieces.filter((p) => p.prop === "lamp-road" && ["targ", "doki"].includes(chunkAt(p.x, p.z)?.district ?? ""));
    expect(poles.length).toBeLessThan(lamps.length / 2);
  });

  it("stand clear of the buildings with the whole pole, not just its foot: Ciasna's lamp by the wall stays a lamp", () => {
    const fitting = poles.filter((p) => poleFits(pole, p));
    expect(fitting.length).toBeGreaterThan(40);
    const ciasna = poles.find((p) => Math.hypot(p.x - 634.9, p.z - 538.0) < 0.5);
    expect(ciasna).toBeDefined();
    expect(poleFits(pole, ciasna!)).toBe(false);
    for (const p of fitting) {
      const { positions } = transformProp(pole, poleXform(p));
      for (let i = 0; i < positions.length; i += 3) expect(inBuilding(positions[i]!, positions[i + 2]!)).toBe(false);
    }
  });

  it("draws the far pole's light where its halo hangs", () => {
    const far = farPole(pole);
    const lamp = poleLights(pole)[0]!.at;
    const lit: number[][] = [];
    for (let i = 0; i < far.vertexCount; i++) if (far.colors[i * 4 + 3] === 0) lit.push([far.positions[i * 3]!, far.positions[i * 3 + 1]!, far.positions[i * 3 + 2]!]);
    expect(lit.length).toBeGreaterThan(0);
    const mid = [0, 1, 2].map((k) => lit.reduce((n, v) => n + v[k]!, 0) / lit.length);
    expect(mid[0]!).toBeCloseTo(lamp.x, 1);
    expect(mid[1]!).toBeCloseTo(lamp.y, 1);
    expect(mid[2]!).toBeCloseTo(lamp.z, 1);
    // Nothing of the far pole stands above the pole itself (the road lamp's head was at 8.8 m).
    for (let i = 1; i < far.positions.length; i += 3) expect(far.positions[i]!).toBeLessThanOrEqual(pole.size.y + 0.15);
  });

  it("string each pole to a near one, over the street and clear of the buildings", () => {
    const pairs = polePairs(poles);
    expect(pairs.length).toBeGreaterThan(poles.length / 3);
    for (const [a, b] of pairs) {
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(CABLE_SPAN);
      for (let t = 0.1; t < 1; t += 0.1) expect(inBuilding(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)).toBe(false);
      // Four cables; the two of a crossarm do not cross.
      const c = poleCables(a, b);
      expect(c).toHaveLength(4);
      const [p0, q0] = c[0]!;
      const [p1, q1] = c[1]!;
      const ux = b.x - a.x;
      const uz = b.z - a.z;
      const off = (v: { x: number; z: number }, o: WorldProp) => ux * (v.z - o.z) - uz * (v.x - o.x);
      expect(off(p0, a)).toBeLessThanOrEqual(off(p1, a));
      expect(off(q0, b)).toBeLessThanOrEqual(off(q1, b));
    }
  });

  it("are baked into one sink with their cables", () => {
    const sink = new MeshSink();
    bakePoles(sink, props, pole, poles.slice(0, 4));
    expect(sink.vertexCount).toBeGreaterThan(4 * pole.positions.length / 3);
  });
});

describe("robot dogs (ADR-0063)", () => {
  it("lie against a stall's counter in Podzamcze, one stall in a few, within the band the body never enters", () => {
    const stalls = pieces.filter((p) => p.prop === "market-stall");
    const dogs = stalls.map(stallDog).filter((s) => s !== null);
    expect(dogs.length).toBeGreaterThan(0);
    expect(dogs.length).toBeLessThan(stalls.length / 2);
    for (const s of dogs) expect(chunkAt(s.at.x, s.at.z)?.district).toBe("targ");
    // The Old Town's stalls get none.
    expect(stalls.filter((p) => chunkAt(p.x, p.z)?.district === "kanal").map(stallDog).filter((s) => s)).toHaveLength(0);
  });

  it("guard the city gates and a few gateways: against the facade, outside the buildings", () => {
    const spots = gateDogs();
    expect(spots.length).toBeGreaterThanOrEqual(2);
    for (const s of spots) {
      expect(inBuilding(s.at.x, s.at.z)).toBe(false);
      // Its far side within the band the body keeps clear of the wall.
      expect(nearestWall(s.at.x, s.at.z).d + DOG_DEPTH / 2).toBeLessThan(BODY.radius);
      expect(Math.hypot(s.front.x, s.front.z)).toBeCloseTo(1, 5);
    }
    // Brama Krakowska and Brama Grodzka (ADR-0063): one each.
    expect(spots.filter((s) => Math.hypot(s.at.x - 487, s.at.z + 87.2) < 8 || Math.hypot(s.at.x - 457, s.at.z + 95.6) < 8)).toHaveLength(1);
    expect(spots.filter((s) => Math.hypot(s.at.x - 702, s.at.z - 128.4) < 8 || Math.hypot(s.at.x - 728, s.at.z - 152.6) < 8)).toHaveLength(1);
  });

  it("keep clear of other furniture", () => {
    const at = { x: 0, y: 0, z: 0 };
    const sign: WorldProp = { prop: "a-frame-sign", x: 0.5, y: 0, z: 0, yaw: 0, shape: 0, scale: 1 };
    expect(clearOf({ at, front: { x: 1, y: 0, z: 0 } }, [sign])).toBe(false);
    expect(clearOf({ at, front: { x: 1, y: 0, z: 0 } }, [{ ...sign, x: 2 }])).toBe(true);
  });
});

describe("the street furniture with the CC-BY props (ADR-0063)", () => {
  const items = (id: string): readonly StreetPropItem[] => WORLD_STREET_PROPS[id] ?? [];
  const podzamcze = Object.keys(WORLD_STREET_PROPS).filter((id) => district(id) === "targ");
  const make = (quality: "high" | "low") => {
    const scene = new Scene(new NullEngine());
    const s = new StreetProps({ scene, materials: new ToonMaterials(scene), quality });
    podzamcze.forEach((id, i) => s.spawn(i + 1, items(id), { x: 0, y: 0, z: 0 }));
    s.flush();
    return s;
  };
  const near = (s: StreetProps, eye = { x: 560, y: -17, z: 270 }) => {
    for (let i = 0; i < 40; i++) s.update(eye);
    return s.meshes.filter((m) => m.name.startsWith("props-") && !m.name.startsWith("props-far") && m.name !== "props-halo" && m.isEnabled());
  };
  const vertices = (s: StreetProps) => near(s).reduce((n, m) => n + m.getTotalVertices(), 0);

  it("bakes the poles and dogs into the blocks' meshes once the props load: more vertices, no more meshes", () => {
    const s = make("high");
    const before = near(s);
    const v0 = vertices(s);
    s.setProps(props);
    const after = near(s);
    expect(after.length).toBe(before.length);
    expect(vertices(s)).toBeGreaterThan(v0);
  });

  it("rebuilds the far blocks with the far poles once the props load: no lamp head above the poles", () => {
    const s = make("high");
    const fitting = poles.filter((p) => chunkAt(p.x, p.z)?.district === "targ" && poleFits(pole, p));
    const top = () => {
      let y = -Infinity;
      for (const m of s.meshes.filter((m) => m.name.startsWith("props-far"))) {
        const pos = m.getVerticesData("position") ?? [];
        for (let i = 0; i < pos.length; i += 3) {
          if (fitting.some((p) => Math.hypot(pos[i]! - p.x, pos[i + 2]! - p.z) < 0.3)) y = Math.max(y, pos[i + 1]! - (fitting.find((p) => Math.hypot(pos[i]! - p.x, pos[i + 2]! - p.z) < 0.3)?.y ?? 0));
        }
      }
      return y;
    };
    expect(top()).toBeGreaterThan(8.8);
    s.setProps(props);
    expect(top()).toBeLessThanOrEqual(pole.size.y + 0.15);
  });

  it("leaves the phones' blocks as they were", () => {
    const s = make("low");
    const v0 = vertices(s);
    s.setProps(props);
    expect(vertices(s)).toBe(v0);
  });
});
