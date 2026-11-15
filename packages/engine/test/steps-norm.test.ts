import { STEP_NORM, mulberry32 } from "@seki/core";
import { LUBLIN_CHUNKS, groundView } from "@seki/sim/lublin";
import { describe, expect, it } from "vitest";
import { STEP_LOOK } from "../src/npr/toon-city";
import { TOON_VERTEX } from "../src/npr/toon-shader";
import { planGround } from "../src/renderer/mapcity/cell-ground";
import { MapEntries } from "../src/renderer/mapcity/map-entries";
import { type P2, boundsOf, cleanRing, orientedBox } from "../src/renderer/mapcity/polygon";
import { planSteps } from "../src/renderer/mapcity/steps-plan";
import { MeshSink } from "../src/renderer/mesh-sink";

/**
 * The one norm of a step (G-840): every flight the map city lays keeps it, and from far lies on
 * one ramp the line art draws no riser on. Before it, a flight was cut into treads 0.33 m deep
 * with risers of whatever the smoothed terrain fell on each, from 4.5 cm up, and its dark risers
 * every 0.33 m read from afar as a black patch (Plac Zamkowy, 15.11).
 */

type Q = { readonly ys: readonly number[]; readonly u: number; readonly up: boolean; readonly along: boolean };

/** A sink's quads in the frame of the band `ring`: whether each looks up, faces along the run, its heights and where along the run. */
const quads = (s: MeshSink, ring: readonly P2[], lifted = false): Q[] => {
  const box = orientedBox(ring);
  const out: Q[] = [];
  for (let q = 0; q + 3 < s.vertexCount; q += 4) {
    const y = (k: number) => (s.positions[(q + k) * 3 + 1] ?? 0) + (lifted && (s.uvs2[(q + k) * 2] ?? 0) >= STEP_LOOK.code.tread ? (s.uvs2[(q + k) * 2 + 1] ?? 0) : 0);
    const p = [0, 1, 2].map((k) => [s.positions[(q + k) * 3] ?? 0, y(k), s.positions[(q + k) * 3 + 2] ?? 0]) as [number[], number[], number[]];
    const e1 = p[1].map((v, c) => v - (p[0][c] ?? 0));
    const e2 = p[2].map((v, c) => v - (p[0][c] ?? 0));
    const n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
    const l = Math.hypot(...n);
    const u = [0, 1, 2, 3].reduce((a, k) => a + ((s.positions[(q + k) * 3] ?? 0) - box.cx) * box.ux + ((s.positions[(q + k) * 3 + 2] ?? 0) - box.cz) * box.uz, 0) / 4;
    out.push({ ys: [0, 1, 2, 3].map(y), u, up: l > 0 && Math.abs(n[1]!) > 0.5 * l, along: l > 0 && Math.abs(n[0]! * box.ux + n[2]! * box.uz) > Math.SQRT1_2 * l });
  }
  return out;
};

const height = (q: Q) => Math.max(...q.ys) - Math.min(...q.ys);

/** What of the flight on `ring` breaks the norm, read off its risers (not the kerbs at its ends), or null. */
const offNorm = (s: MeshSink, ring: readonly P2[], counted = false): string | null => {
  const half = orientedBox(ring).halfLong;
  const risers = quads(s, ring)
    .filter((q) => !q.up && q.along && height(q) > 1e-6 && half - Math.abs(q.u) > 0.02)
    .sort((a, b) => a.u - b.u);
  if (risers.length === 0) return null;
  const hs = risers.map(height);
  if (Math.min(...hs) < STEP_NORM.riserMin - 1e-6 || Math.max(...hs) > STEP_NORM.riserMax + 1e-6) return `risers ${Math.min(...hs).toFixed(3)}-${Math.max(...hs).toFixed(3)}`;
  if (Math.max(...hs) - Math.min(...hs) > 1e-6) return "unequal risers";
  let run = 1;
  for (let i = 0; i + 1 < risers.length; i++) {
    const tread = risers[i + 1]!.u - risers[i]!.u;
    const stride = 2 * hs[i]! + tread;
    if (tread >= STEP_NORM.landingMin - 1e-6) run = 1;
    else if (stride < STEP_NORM.strideMin - 1e-6 || stride > STEP_NORM.strideMax + 1e-6) return `tread ${tread.toFixed(3)}, stride ${stride.toFixed(3)}`;
    else if (++run > STEP_NORM.maxRun && !counted) return `${run} risers with no landing`;
  }
  return null;
};

/** The risers of the flight on `ring`, a step at either end too: not the kerbs there, the treads' lift of 0.05 m. */
const risersOf = (s: MeshSink, ring: readonly P2[]): Q[] => quads(s, ring).filter((q) => !q.up && q.along && height(q) > 0.06);

/** How far the treads of the flight on `ring` lie under the ground `h` along its axis at most, less their lift of 0.05 m. */
const sunkUnder = (s: MeshSink, ring: readonly P2[], h: (x: number, z: number) => number): number => {
  const box = orientedBox(ring);
  let worst = 0;
  for (let q = 0; q + 3 < s.vertexCount; q += 4) {
    const ys = [0, 1, 2, 3].map((k) => s.positions[(q + k) * 3 + 1] ?? 0);
    if (Math.max(...ys) - Math.min(...ys) > 1e-9) continue;
    const us = [0, 1, 2, 3].map((k) => ((s.positions[(q + k) * 3] ?? 0) - box.cx) * box.ux + ((s.positions[(q + k) * 3 + 2] ?? 0) - box.cz) * box.uz);
    for (let u = Math.min(...us); u <= Math.max(...us); u += 0.02) worst = Math.max(worst, h(box.cx + box.ux * u, box.cz + box.uz * u) - (ys[0]! - 0.05));
  }
  return worst;
};

/** The landings of the flight on `ring`: level stretches between two risers at least `landingMin` long. */
const landings = (s: MeshSink, ring: readonly P2[]): number => {
  const half = orientedBox(ring).halfLong;
  const us = quads(s, ring)
    .filter((q) => !q.up && q.along && height(q) > 1e-6 && half - Math.abs(q.u) > 0.02)
    .map((q) => q.u)
    .sort((a, b) => a - b);
  return us.slice(1).filter((u, i) => u - us[i]! >= STEP_NORM.landingMin - 1e-6).length;
};

/** The steps of the map's chunk `chunk` laid the way the map city lays them, every chunk's terrain under them. */
const mapFlights = (chunk: string, at: (box: ReturnType<typeof orientedBox>) => boolean): { ring: P2[]; sink: MeshSink; h: (x: number, z: number) => number }[] => {
  const e = new MapEntries();
  let id = 1;
  for (const c of LUBLIN_CHUNKS) {
    const g = c.terrain;
    e.terrains.set(id++, { grid: g, open: undefined, bounds: { minX: g.originX, maxX: g.originX + (g.cols - 1) * g.cell, minZ: g.originZ, maxZ: g.originZ + (g.rows - 1) * g.cell }, mesh: null });
  }
  const c = LUBLIN_CHUNKS.find((k) => k.id === chunk);
  if (!c) throw new Error(chunk);
  const out: { ring: P2[]; sink: MeshSink; h: (x: number, z: number) => number }[] = [];
  for (const g of c.ground) {
    const view = groundView(g);
    if (g.surface !== "steps" || view.kind !== "ground") continue;
    const ring = cleanRing(view.outline.map((p) => ({ x: p.x, z: p.z })));
    if (ring.length < 3 || !at(orientedBox(ring))) continue;
    e.addGround(++id, { surface: "steps", ring, y: 0, bounds: boundsOf(ring), cell: "" });
    const sink = new MeshSink();
    planGround(sink, new MeshSink(), e, id);
    const entry = e.grounds.get(id)!;
    out.push({ ring, sink, h: e.groundHeight(entry, e.terrainOf(entry)) });
  }
  return out;
};

describe("the flight from Plac Zamkowy up to the castle (G-840, T-113)", () => {
  // The main run w1305889408 between the balustrades, 15.7 m long, 5.3 m up.
  const [main] = mapFlights("podzamcze-1-0", (b) => Math.hypot(b.cx - 792.5, b.cz - 243) < 1);

  it("climbs its 40 mapped steps (step_count) in one flight of the norm's stride, no landing (round 2)", () => {
    expect(main).toBeDefined();
    const { ring, sink } = main!;
    expect(risersOf(sink, ring)).toHaveLength(40);
    // 5.25 m by 40 is 0.131, a tread 15.73 / 40 = 0.39: 2h + s 0.65, in the norm with no landing.
    expect(offNorm(sink, ring, true)).toBeNull();
    expect(landings(sink, ring)).toBe(0);
  });

  it("keeps every tread on the ground, at most 0.02 m (less its lift) under it on the axis (round 2)", () => {
    const { ring, sink } = main!;
    expect(sunkUnder(sink, ring, main!.h)).toBeLessThanOrEqual(0.02 + 1e-6);
  });

  it("lies from far on one ramp: no upright face, no crease the line art inks", () => {
    const { ring, sink } = main!;
    const far = quads(sink, ring, true).filter((q) => q.along && !q.up);
    // Every riser shrinks to nothing on the ramp through the nosings.
    const near = quads(sink, ring);
    quads(sink, ring, true).forEach((q, i) => {
      if (!near[i]!.up && near[i]!.along && orientedBox(ring).halfLong - Math.abs(q.u) > 0.02) expect(height(q), `riser at ${q.u.toFixed(3)}`).toBeLessThan(1e-6);
    });
    expect(far.length).toBeGreaterThan(0);
    // The geometry buffer's normals: the ramp's on tread and riser alike, no crease between them
    // (the line art inks one where 1 - n·n' passes 0.35).
    let worst = 0;
    for (let v = 0; v + 1 < sink.vertexCount; v++) {
      if ((sink.uvs2[v * 2] ?? 0) < STEP_LOOK.code.tread || (sink.uvs2[(v + 1) * 2] ?? 0) < STEP_LOOK.code.tread) continue;
      const d = [0, 1, 2].reduce((a, k) => a + (sink.normals[v * 3 + k] ?? 0) * (sink.normals[(v + 1) * 3 + k] ?? 0), 0);
      worst = Math.max(worst, 1 - d);
    }
    expect(worst).toBeLessThan(0.35);
    // The vertex stage lays it so (`STEPS_VERTEX_GLSL`).
    expect(TOON_VERTEX).toContain("stepsMorph(onRamp, nw, uv2)");
  });
});

describe("any flight on a run of steps (G-840)", () => {
  // Runs 1-30 m long climbing gently to as steep as the norm, on ground with bumps and a crest.
  const rand = mulberry32(840);
  const runs = Array.from({ length: 200 }, () => {
    const length = 1 + rand() * 29;
    const grade = rand() * 0.4;
    const bump = rand() * 0.3;
    const phase = rand() * 6;
    const across = (rand() - 0.5) * 0.2;
    return { length, ground: (x: number, z: number) => grade * x + bump * Math.sin(x * 0.7 + phase) * Math.min(1, x / 3) + across * z };
  });

  it.each(runs.map((r, i) => ({ i, ...r })))("keeps the norm: run $i", ({ length, ground }) => {
    const ring = [{ x: 0, z: 0 }, { x: length, z: 0 }, { x: length, z: 3 }, { x: 0, z: 3 }];
    const sink = new MeshSink();
    planSteps(sink, ring, ground);
    // Steeper than the norm at the foot, the flight starts there; it never tilts its risers or treads for it.
    expect(offNorm(sink, ring), `run ${length.toFixed(2)} m`).toBeNull();
  });

  it.each(runs.map((r, i) => ({ i, ...r })))("lies at most 0.02 m under the ground on its axis (round 2): run $i", ({ length, ground }) => {
    const ring = [{ x: 0, z: 0 }, { x: length, z: 0 }, { x: length, z: 3 }, { x: 0, z: 3 }];
    const sink = new MeshSink();
    planSteps(sink, ring, ground);
    expect(sunkUnder(sink, ring, ground)).toBeLessThanOrEqual(0.02 + 1e-6);
  });

  it("lays as many steps as its map counts, in one flight with no landing every 12 (round 2)", () => {
    // 40 steps on a run 15.7 m long rising 5.25 m: 0.131 on treads of 0.39, as the castle stairs.
    const ring = [{ x: 0, z: 0 }, { x: 15.73, z: 0 }, { x: 15.73, z: 10 }, { x: 0, z: 10 }];
    const sink = new MeshSink();
    planSteps(sink, ring, (x) => (x / 15.73) * 5.25, () => false, 40);
    expect(risersOf(sink, ring)).toHaveLength(40);
    expect(landings(sink, ring)).toBe(0);
    expect(offNorm(sink, ring, true)).toBeNull();
  });

  it("lies as paving where its ends lie less than the norm's lowest riser apart", () => {
    const ring = [{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 3 }, { x: 0, z: 3 }];
    const sink = new MeshSink();
    planSteps(sink, ring, (x) => (x / 8) * (STEP_NORM.riserMin - 0.01));
    expect(sink.empty).toBe(false);
    for (let v = 0; v < sink.vertexCount; v++) {
      expect(sink.normals[v * 3 + 1] ?? 0).toBeGreaterThan(0.9);
      expect(sink.uvs2[v * 2] ?? 0).toBeLessThan(STEP_LOOK.code.tread);
    }
  });
});
