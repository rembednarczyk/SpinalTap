import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { type StreetPropItem, type StreetPropKind, barrierVariant } from "@seki/core";
import { BOLLARD, chainDir, chainVariant } from "@seki/sim";
import { LUBLIN_CHUNKS, LUBLIN_STREET_PROPS } from "@seki/sim/lublin";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { MeshSink } from "../src/renderer/mesh-sink";
import { collectInstances, countByKind, planHalos, toWorld, writeMatrix } from "../src/renderer/mapcity/prop-batch";
import { propGallery } from "../src/renderer/mapcity/prop-gallery";
import { PROP_KINDS, buildPropModel, chainModel, farModel, nearModel, propModel } from "../src/renderer/mapcity/prop-models";
import { PROP_LOD, PROP_SHAPES, bandOf, cellBand, shapeOf, showsNear } from "../src/renderer/mapcity/prop-shapes";
import { StreetProps } from "../src/renderer/mapcity/street-props";

const item = (prop: StreetPropKind, x: number, z: number, variant = 0): StreetPropItem => ({ prop, x, y: 0, z, yaw: 0, variant });

const valid = (s: MeshSink): boolean =>
  !s.empty && s.indices.every((i) => i < s.vertexCount) && s.positions.every(Number.isFinite) && s.normals.every(Number.isFinite) && s.colors.length === s.vertexCount * 4;

describe("street furniture models (ADR-0047)", () => {
  it("has a valid model for every kind and shape, and the same variant always gives the same geometry", () => {
    // 49 with the map's barriers (ADR-0077), a wall stretch in the gallery; 53 with the building sites' fence, gate, board and container (ADR-0087); 55 with its crane and scaffold (stage 2); 56 with the odds and ends (ADR-0096).
    expect(PROP_KINDS).toHaveLength(56);
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

  it("draws a bollard as a slim black cast-iron post with a ball, its chain a band of links from its shaft to the next post's (G-032, G-819)", () => {
    const post = propModel("bollard", 0).sink;
    const xs = (s: MeshSink) => s.positions.filter((_, k) => k % 3 === 0);
    const ys = (s: MeshSink) => s.positions.filter((_, k) => k % 3 === 1);
    const zs = (s: MeshSink) => s.positions.filter((_, k) => k % 3 === 2);
    const radiusAt = (s: MeshSink, lo: number, hi: number) => Math.max(0, ...xs(s).flatMap((x, k) => (ys(s)[k]! > lo && ys(s)[k]! < hi ? [Math.hypot(x, zs(s)[k]!)] : [])));
    // Lublin's posts (Plac Łokietka, Plac Wolności): 0.95 m, a 0.10 m shaft on a 0.15 m foot, a 0.12 m ball.
    expect(Math.max(...ys(post))).toBeCloseTo(0.95, 3);
    expect(radiusAt(post, 0, 0.12)).toBeCloseTo(0.075, 2);
    expect(radiusAt(post, 0.13, 0.2)).toBeCloseTo(0.05, 2);
    expect(radiusAt(post, 0.83, 0.89)).toBeCloseTo(0.06, 2);
    expect(Math.max(...xs(post).map(Math.abs))).toBeLessThanOrEqual(BOLLARD.radius);
    // Black iron, but for the 2077 ring of LED.
    const rgb = Array.from({ length: post.vertexCount }, (_, k) => post.colors.slice(k * 4, k * 4 + 3));
    expect(rgb.filter((c) => Math.max(...c) > 0.2).length).toBeLessThan(rgb.length / 4);
    // A chain along +x ending at 2.13 m, and one back to a lamp 1.5 m behind, turned 10 degrees.
    const [p] = toWorld([item("bollard", 0, 0, chainVariant(2.13, 1.5, (10 * Math.PI) / 180))], { x: 0, y: 0, z: 0 });
    expect(p!.chains!.map((c) => c.end)).toEqual([2.13, 1.5]);
    expect(p!.chains![0]!.yaw).toBe(0);
    const back = chainDir(p!.chains![1]!.yaw);
    expect(back.x).toBeCloseTo(-Math.cos((10 * Math.PI) / 180), 2);
    const chain = chainModel(p!.chains![0]!.end);
    expect(valid(chain)).toBe(true);
    expect(Math.min(...xs(chain))).toBeCloseTo(0.05, 1);
    expect(Math.max(...xs(chain))).toBeCloseTo(2.13, 1);
    // Hung at 0.75 m, a band of links 4 to 5 cm wide, upright and lying by turns, sagging about a tenth of its span.
    const first = (s: MeshSink, f: (v: MeshSink) => number[]) => f(s).filter((_, k) => xs(s)[k]! < 0.12);
    expect(Math.max(...first(chain, ys))).toBeCloseTo(0.75 + 0.0225, 2);
    expect(Math.max(...first(chain, ys)) - Math.min(...first(chain, ys))).toBeGreaterThanOrEqual(0.04);
    expect(Math.max(...first(chain, zs)) - Math.min(...first(chain, zs))).toBeGreaterThanOrEqual(0.04);
    const mid = ys(chain).filter((_, k) => Math.abs(xs(chain)[k]! - 1.09) < 0.05);
    expect(0.75 - (Math.max(...mid) + Math.min(...mid)) / 2).toBeGreaterThan(0.15);
    expect(0.75 - (Math.max(...mid) + Math.min(...mid)) / 2).toBeLessThan(0.22);
    expect(toWorld([item("bollard", 0, 0, 0)], { x: 0, y: 0, z: 0 })[0]!.chains).toEqual([]);
  });

  it("gives the phones a bollard of a hundred vertices and a chain of two crossed strips on the same line", () => {
    const ys = (s: MeshSink) => s.positions.filter((_, k) => k % 3 === 1);
    const xs = (s: MeshSink) => s.positions.filter((_, k) => k % 3 === 0);
    const zs = (s: MeshSink) => s.positions.filter((_, k) => k % 3 === 2);
    const post = nearModel("bollard", 0, "low");
    const high = nearModel("bollard", 0, "high");
    expect(high).toBe(propModel("bollard", 0).sink);
    expect(valid(post)).toBe(true);
    expect(post.vertexCount).toBeLessThanOrEqual(135);
    expect(high.vertexCount).toBeGreaterThan(3 * post.vertexCount);
    // The same post: as tall, as wide at the foot and the ball, black.
    expect(Math.max(...ys(post))).toBeCloseTo(0.95, 3);
    expect(Math.max(...xs(post).map(Math.abs))).toBeCloseTo(BOLLARD.foot, 3);
    // The ball as wide as the detailed one's, so it stands out of the shaft (not a bulge of it).
    const ballR = (s: MeshSink) => Math.max(...xs(s).flatMap((x, k) => (ys(s)[k]! > 0.85 && ys(s)[k]! < 0.92 ? [Math.hypot(x, zs(s)[k]!)] : [])));
    expect(ballR(post)).toBeCloseTo(ballR(high), 2);
    // Black iron but for the red LED ring, which stands where the detailed one's does.
    const lit = (s: MeshSink) => ys(s).flatMap((y, k) => (s.colors[k * 4]! > 0.5 ? [y] : []));
    expect(lit(post).length).toBeGreaterThan(0);
    expect(Math.min(...lit(post))).toBeCloseTo(Math.min(...lit(high)), 3);
    expect(Math.max(...lit(post))).toBeCloseTo(Math.max(...lit(high)), 3);
    expect(post.colors.filter((c, k) => k % 4 !== 3 && post.colors[k - (k % 4)]! <= 0.5).every((c) => c < 0.2)).toBe(true);
    // Other kinds bake their detailed model on every quality.
    expect(nearModel("bench", 1, "low")).toBe(propModel("bench", 1).sink);
    for (const end of [1.2, 2.13, 3.4]) {
      const links = chainModel(end, "high");
      const low = chainModel(end, "low");
      expect(chainModel(end)).toBe(links);
      expect(valid(low)).toBe(true);
      expect(low.vertexCount).toBeLessThanOrEqual(56);
      expect(links.vertexCount).toBeGreaterThan(5 * low.vertexCount);
      // Along the same span, as wide and deep, sagging as far at its middle.
      expect(Math.min(...xs(low))).toBeCloseTo(Math.min(...xs(links)), 1);
      expect(Math.max(...xs(low))).toBeCloseTo(Math.max(...xs(links)), 1);
      expect(Math.max(...zs(low))).toBeCloseTo(BOLLARD.chain, 3);
      expect(Math.max(...ys(low))).toBeCloseTo(Math.max(...ys(links)), 2);
      expect(Math.min(...ys(low))).toBeCloseTo(Math.min(...ys(links)), 1);
    }
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
  // A stopped clock: a frame bakes all it is due (the bake's share of a frame is timed by the clock).
  const make = (quality: "high" | "low" = "high", now = () => 0) => {
    const scene = new Scene(new NullEngine());
    return new StreetProps({ scene, materials: new ToonMaterials(scene), quality, now });
  };
  const nearMesh = (props: StreetProps) => props.meshes.find((m) => m.name.startsWith("props-") && !m.name.startsWith("props-far") && m.name !== "props-halo");

  it("bakes a block over frames, some milliseconds each, starting before it comes near", () => {
    // A millisecond a reading: eight parts a frame.
    let t = 0;
    const sliced = make("low", () => t++);
    const whole = make("low");
    const pieces = Array.from({ length: 120 }, (_, i) => item(i % 2 ? "bollard" : "bench", 10 + (i % 12) * 3, 10 + Math.floor(i / 12) * 3, i % 2 ? chainVariant(3, 0, 0) : 0));
    for (const p of [sliced, whole]) {
      p.spawn(1, pieces, { x: 0, y: 0, z: 0 });
      p.flush();
    }
    // Beyond the detail distance (80 m on low) by more than the head start: nothing baked.
    sliced.update({ x: -150, y: 2, z: 0 });
    expect(nearMesh(sliced)).toBeUndefined();
    // Within the head start, not near: baked on over frames, the far mesh drawn meanwhile.
    let frames = 0;
    while (!nearMesh(sliced) && frames < 100) {
      sliced.update({ x: -100, y: 2, z: 0 });
      frames++;
      expect(sliced.waiting).toBe(0);
      expect(sliced.stats.far).toBe(1);
    }
    expect(frames).toBeGreaterThan(10);
    expect(frames).toBeLessThan(20);
    expect(sliced.stats.groups).toBe(0);
    // Near: drawn in detail at once, the same mesh as baked in one go.
    sliced.update({ x: -50, y: 2, z: 0 });
    whole.update({ x: -50, y: 2, z: 0 });
    expect(sliced.waiting).toBe(0);
    expect(sliced.stats.groups).toBe(1);
    expect(sliced.stats.far).toBe(0);
    const [a, b] = [nearMesh(sliced)!, nearMesh(whole)!];
    expect(a.getTotalVertices()).toBe(b.getTotalVertices());
    expect([...a.getVerticesData("position")!]).toEqual([...b.getVerticesData("position")!]);
  });

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

  it("bakes the map's barriers into the furniture's blocks, a block of barriers alone into the nearest furnished one (ADR-0077)", () => {
    const props = make();
    props.spawn(1, [item("bench", 300, -100)], { x: 0, y: 0, z: 0 });
    const wall = barrierVariant({ kind: "wall", length: 3, height: 1, rise: 0, material: "plain" });
    props.spawn(2, [item("barrier", 300, -120, wall), item("barrier", 300, -265, wall)], { x: 0, y: 0, z: 0 });
    props.flush();
    expect(props.stats.cells).toBe(1);
    props.update({ x: 300, y: 2, z: -150 });
    expect(props.stats.drawn).toEqual({ bench: 1, barrier: 2 });
    expect(props.stats.groups).toBe(1);
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
