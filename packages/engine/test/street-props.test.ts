import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { StreetPropItem, StreetPropKind } from "@seki/core";
import { BOLLARD, chainDir, chainVariant } from "@seki/sim";
import { LUBLIN_CHUNKS, LUBLIN_STREET_PROPS } from "@seki/sim/lublin";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { MeshSink } from "../src/renderer/mesh-sink";
import { collectInstances, countByKind, planHalos, toWorld, writeMatrix } from "../src/renderer/mapcity/prop-batch";
import { propGallery } from "../src/renderer/mapcity/prop-gallery";
import { PROP_KINDS, buildPropModel, chainModel, farModel, propModel } from "../src/renderer/mapcity/prop-models";
import { PROP_LOD, PROP_SHAPES, bandOf, cellBand, shapeOf, showsNear } from "../src/renderer/mapcity/prop-shapes";
import { StreetProps } from "../src/renderer/mapcity/street-props";

const item = (prop: StreetPropKind, x: number, z: number, variant = 0): StreetPropItem => ({ prop, x, y: 0, z, yaw: 0, variant });

const valid = (s: MeshSink): boolean =>
  !s.empty && s.indices.every((i) => i < s.vertexCount) && s.positions.every(Number.isFinite) && s.normals.every(Number.isFinite) && s.colors.length === s.vertexCount * 4;

describe("street furniture models (ADR-0047)", () => {
  it("has a valid model for every kind and shape, and the same variant always gives the same geometry", () => {
    expect(PROP_KINDS).toHaveLength(47);
    for (const kind of PROP_KINDS) {
      for (let s = 0; s < (PROP_SHAPES[kind] ?? 1); s++) {
        const a = buildPropModel(kind, s);
        const b = buildPropModel(kind, s);
        expect(valid(a.sink), `${kind}:${s}`).toBe(true);
        expect(a.sink.positions).toEqual(b.sink.positions);
        expect(a.sink.colors).toEqual(b.sink.colors);
        expect(propModel(kind, s + (PROP_SHAPES[kind] ?? 1) * 5)).toBe(propModel(kind, s));
      }
    }
    // Variants pick shapes: the three tree species differ.
    const trees = [0, 1, 2].map((s) => JSON.stringify(buildPropModel("tree", s).sink.positions));
    expect(new Set(trees).size).toBe(3);
    expect(shapeOf("monument", 6 * 1234 + 2)).toBe(2);
  });

  it("draws a bollard as big as its solid and its chain from its face to the next post's (G-032)", () => {
    const post = propModel("bollard", 0).sink;
    const xs = (s: MeshSink) => s.positions.filter((_, k) => k % 3 === 0);
    const ys = post.positions.filter((_, k) => k % 3 === 1);
    expect(Math.max(...ys)).toBeCloseTo(BOLLARD.height, 3);
    expect(Math.max(...xs(post).map(Math.abs))).toBeLessThan(BOLLARD.side / 2 + 0.02);
    // No chain on the post itself: a lone post or a row's last has none out past it.
    expect(Math.max(...xs(post))).toBeLessThan(BOLLARD.side);
    // A chain along +x ending at 2.13 m, and one back to a lamp 1.5 m behind, turned 10 degrees.
    const [p] = toWorld([item("bollard", 0, 0, chainVariant(2.13, 1.5, (10 * Math.PI) / 180))], { x: 0, y: 0, z: 0 });
    expect(p!.chains!.map((c) => c.end)).toEqual([2.13, 1.5]);
    expect(p!.chains![0]!.yaw).toBe(0);
    const back = chainDir(p!.chains![1]!.yaw);
    expect(back.x).toBeCloseTo(-Math.cos((10 * Math.PI) / 180), 2);
    const chain = chainModel(p!.chains![0]!.end);
    expect(valid(chain)).toBe(true);
    expect(Math.min(...xs(chain))).toBeCloseTo(BOLLARD.side / 2, 1);
    expect(Math.max(...xs(chain))).toBeCloseTo(2.13, 1);
    expect(toWorld([item("bollard", 0, 0, 0)], { x: 0, y: 0, z: 0 })[0]!.chains).toEqual([]);
  });

  it("lights the lamps and simplifies the tall kinds far away, and nothing small is drawn far", () => {
    for (const kind of PROP_KINDS) {
      if (kind.startsWith("lamp-")) expect(propModel(kind, 0).lights.length, kind).toBeGreaterThan(0);
      const far = farModel(kind, 0);
      if (bandOf(kind) === "tall") {
        expect(far, kind).not.toBeNull();
        expect(far!.vertexCount).toBeLessThan(propModel(kind, 0).sink.vertexCount);
      } else expect(far).toBeNull();
    }
    expect(propModel("lamp-candelabra", 0).lights).toHaveLength(5);
  });
});

describe("street furniture batches (ADR-0047)", () => {
  it("writes instance matrices that turn +z to the yaw and move to the foot", () => {
    const m = new Array<number>(16).fill(0);
    writeMatrix(m, 0, { prop: "bench", x: 3, y: 1, z: -2, yaw: Math.PI / 2, shape: 0, scale: 1 });
    // Row vector (0, 0, 1, 1) times the matrix: +z faces +x.
    expect(m[8]).toBeCloseTo(1, 9);
    expect(m[10]).toBeCloseTo(0, 9);
    expect([m[12], m[13], m[14]]).toEqual([3, 1, -2]);
  });

  it("counts instances per kind from the cells' bands: small things only close by", () => {
    const pieces = toWorld([item("bench", 0, 0), item("bench", 2, 0), item("bollard", 4, 0), item("tree", 6, 0, 1), item("tree", 8, 0, 2)], { x: 0, y: 0, z: 0 });
    expect(countByKind(collectInstances([{ band: "small", pieces }]))).toEqual({ bench: 2, bollard: 1, tree: 2 });
    expect(countByKind(collectInstances([{ band: "medium", pieces }]))).toEqual({ bench: 2, tree: 2 });
    expect(countByKind(collectInstances([{ band: "far", pieces }]))).toEqual({});
    // Two tree species, two meshes.
    expect(collectInstances([{ band: "small", pieces }]).size).toBe(4);
    expect(showsNear("manhole", "medium")).toBe(false);
  });

  it("holds a cell's band for the hysteresis past its edge", () => {
    const lod = PROP_LOD.high;
    expect(cellBand(lod.small + 5, lod, "small")).toBe("small");
    expect(cellBand(lod.small + 5, lod, "medium")).toBe("medium");
    expect(cellBand(lod.far + 5, lod, "far")).toBe("far");
    expect(cellBand(lod.far + 50, lod, "far")).toBe("off");
  });

  it("gives every lamp light a sprite and the pavement lamps a pool", () => {
    const sink = new MeshSink();
    const [p] = toWorld([item("lamp-modern-pole", 0, 0)], { x: 0, y: 0, z: 0 });
    planHalos(sink, p!, propModel("lamp-modern-pole", 0).lights);
    expect(sink.vertexCount).toBe(2 * 2 * 4);
  });

  it("puts every kind in the gallery", () => {
    const kinds = new Set(propGallery().items.map((i) => i.prop));
    for (const k of PROP_KINDS) expect(kinds.has(k), k).toBe(true);
  });
});

describe("street props in the scene (ADR-0047)", () => {
  const make = (quality: "high" | "low" = "high") => {
    const scene = new Scene(new NullEngine());
    return new StreetProps({ scene, materials: new ToonMaterials(scene), quality });
  };

  it("bakes a near cell's pieces into one mesh, far cells into one, and forgets despawned pieces", () => {
    const props = make();
    props.spawn(1, [item("bench", 10, 10), item("bench", 12, 10), item("lamp-pastoral", 14, 10), item("bollard", 16, 10), item("tree", 300, 300, 0)], { x: 0, y: 0, z: 0 });
    props.flush();
    props.update({ x: 10, y: 2, z: 0 });
    expect(props.waiting).toBe(0);
    expect(props.stats.drawn).toEqual({ bench: 2, "lamp-pastoral": 1, bollard: 1 });
    // Benches, lamp and bollard of one cell: one mesh, whatever the kinds (ADR-0050).
    expect(props.stats.groups).toBe(1);
    expect(props.stats.far).toBe(1);
    props.despawn(1);
    props.flush();
    props.update({ x: 10, y: 2, z: 0 });
    expect(props.stats.pieces).toBe(0);
    expect(props.stats.drawn).toEqual({});
  });

  it("draws the generated Lublin within its budget of meshes", () => {
    const props = make("low");
    LUBLIN_CHUNKS.forEach((c, i) => props.spawn(i + 1, LUBLIN_STREET_PROPS[c.id] ?? [], { x: 0, y: 0, z: 0 }));
    props.flush();
    props.update({ x: 20, y: 2, z: -20 });
    const s = props.stats;
    expect(s.pieces).toBeGreaterThan(3000);
    // Draw calls follow the near cells, not the kinds in view (ADR-0050); a few are baked per frame.
    for (let i = 0; i < 20 && props.waiting > 0; i++) props.update({ x: 20, y: 2, z: -20 });
    expect(props.waiting).toBe(0);
    expect(props.stats.groups).toBeLessThanOrEqual(20);
  });
});
