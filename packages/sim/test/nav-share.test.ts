import { afterEach, describe, expect, it } from "vitest";
import { SIM_HZ, Simulation, ground, stateHash } from "../src";
import { type Field, nearBuilds, wideBuilds } from "../src/systems/ai/nav-field";
import type { Raster } from "../src/systems/ai/nav-raster";
import { type Made, type NavShare, shapesKey, shareNav, through } from "../src/systems/ai/nav-share";
import type { Collider } from "../src/world/solids";
import { input, run, teleportPlayer } from "./helpers";

/**
 * The steering's rasters and fields shared by the worlds of a process (ADR-0083 step 3,
 * `nav-share.ts`): the tests' speed-up must leave every world as it was without it.
 */

const mapStore = <T>() => {
  const map = new Map<string, Made<T>>();
  const counts = { hits: 0, misses: 0 };
  return {
    counts,
    size: () => map.size,
    get: (k: string) => {
      const m = map.get(k);
      if (m) counts.hits++;
      else counts.misses++;
      return m;
    },
    set: (k: string, m: Made<T>) => void map.set(k, m),
  };
};

const storeOf = () => ({ rasters: mapStore<Raster>(), fields: mapStore<Field>() });

/** A shot on the deptak: the residents run, round what stands in the way. */
const panic = (): { hashes: string[]; near: ReturnType<typeof nearBuilds>; wide: ReturnType<typeof wideBuilds> } => {
  const sim = Simulation.create({ seed: 8, crowd: "low" });
  teleportPlayer(sim, ground(300, -84), Math.PI / 2);
  run(sim, 2);
  sim.player()!.pitch = -0.6;
  sim.step(input({ fire: true }));
  const hashes: string[] = [];
  for (let i = 0; i < 2; i++) {
    run(sim, SIM_HZ);
    hashes.push(stateHash(sim.snapshot(null, "t", "")));
  }
  return { hashes, near: nearBuilds(sim.world), wide: wideBuilds(sim.world) };
};

let before: NavShare<Raster, Field> | null = null;
afterEach(() => {
  shareNav(before);
});

describe("the steering's store shared by a process's worlds (ADR-0083 step 3)", () => {
  it("leaves a world as without it: the same states and the same rasters and fields made, the second world's from the store", () => {
    before = shareNav(null);
    const alone = panic();
    const store = storeOf();
    shareNav(store);
    const first = panic();
    const hitsBefore = store.fields.counts.hits;
    const second = panic();
    expect(first).toEqual(alone);
    expect(second).toEqual(alone);
    expect(alone.near.fields).toBeGreaterThan(0);
    // The second world made nothing anew: every raster and field it made came out of the store.
    expect(store.rasters.size()).toBeGreaterThan(0);
    expect(store.fields.counts.hits - hitsBefore).toBe(alone.near.fields + alone.wide.fields);
  });

  it("hands back the work reports of the making, in order, without making it again", () => {
    const store = mapStore<string>();
    let made = 0;
    function* make() {
      made++;
      yield 3;
      yield 5;
      return "raster";
    }
    const reports = (steps: Generator<number, string, void>) => {
      const out: number[] = [];
      for (let s = steps.next(); ; s = steps.next()) {
        if (s.done) return { out, value: s.value };
        out.push(s.value);
      }
    };
    expect(reports(through(store, "k", make))).toEqual({ out: [3, 5], value: "raster" });
    expect(reports(through(store, "k", make))).toEqual({ out: [3, 5], value: "raster" });
    expect(made).toBe(1);
    expect(reports(through(undefined, "k", make))).toEqual({ out: [3, 5], value: "raster" });
    expect(made).toBe(2);
  });

  it("knows solids by their shapes, whatever their order, not by their ids", () => {
    const box = (x: number, h = 2): Collider => ({ box: { min: { x, y: 0, z: 0 }, max: { x: x + 1, y: h, z: 1 } }, slope: undefined, prism: null });
    const sloped: Collider = { ...box(4), slope: { axis: "x", dir: 1, low: 0.5 } };
    expect(shapesKey([box(0), box(2), sloped])).toBe(shapesKey([sloped, box(2), box(0)]));
    expect(shapesKey([box(0), box(2)])).not.toBe(shapesKey([box(0), box(2.5)]));
    expect(shapesKey([box(0), box(2)])).not.toBe(shapesKey([box(0), box(2, 3)]));
    expect(shapesKey([box(4)])).not.toBe(shapesKey([sloped]));
    expect(shapesKey([box(0), box(0)])).not.toBe(shapesKey([box(0)]));
  });
});
