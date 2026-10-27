import { DISTRICT_M0_PROPS, type StaticProp } from "@seki/sim";
import { Color3, type Mesh, MeshBuilder, MeshClass, type Scene, Vector3, VertexBuffer } from "../babylon";
import type { PresetName } from "../npr/presets";
import type { ToonMaterials } from "../npr/toon-material";

/** Deterministic PRNG: the dressing is identical every run (reference snapshots). */
const lcg = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

const PALETTE = {
  ledge: "#4b5260",
  ledgeDark: "#353a45",
  shopDark: "#0f1218",
  shutter: "#596171",
  ac: "#8b929b",
  acGrille: "#2b2f36",
  pipe: "#3e444f",
  iron: "#22262d",
  tank: "#6b5a4a",
  antenna: "#2a2e35",
  line: "#b9b28f",
  manhole: "#1a1c22",
  bag: "#1b2420",
  bag2: "#121417",
  cardboard: "#8a6a45",
  cable: "#0d0f13",
  vending: "#c8ccd2",
  awnings: ["#2c7d8c", "#8c2c3f", "#a8862d", "#3c4f8c"],
} as const;

interface Part {
  mesh: Mesh;
  color: string;
}

/** Collects primitive parts and merges them into one vertex-coloured mesh per material. */
class Batch {
  readonly parts: Part[] = [];
  constructor(
    private readonly scene: Scene,
    readonly name: string,
  ) {}

  box(w: number, h: number, d: number, at: Vector3, color: string, rotY = 0, rotX = 0, rotZ = 0): void {
    const m = MeshBuilder.CreateBox(`${this.name}-${this.parts.length}`, { width: w, height: h, depth: d }, this.scene);
    m.position.copyFrom(at);
    m.rotation.set(rotX, rotY, rotZ);
    this.parts.push({ mesh: m, color });
  }

  cylinder(h: number, top: number, bottom: number, at: Vector3, color: string, rotX = 0, rotZ = 0, tessellation = 10): void {
    const m = MeshBuilder.CreateCylinder(`${this.name}-${this.parts.length}`, { height: h, diameterTop: top, diameterBottom: bottom, tessellation }, this.scene);
    m.position.copyFrom(at);
    m.rotation.set(rotX, 0, rotZ);
    this.parts.push({ mesh: m, color });
  }

  sphere(d: number, at: Vector3, color: string, scale: [number, number, number]): void {
    const m = MeshBuilder.CreateSphere(`${this.name}-${this.parts.length}`, { diameter: d, segments: 8 }, this.scene);
    m.position.copyFrom(at);
    m.scaling.set(...scale);
    this.parts.push({ mesh: m, color });
  }

  /** A sagging cable between two points as a chain of thin cylinders. */
  cable(a: Vector3, b: Vector3, sag: number, color: string): void {
    const segments = 8;
    let prev = a;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const p = Vector3.Lerp(a, b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      const mid = Vector3.Lerp(prev, p, 0.5);
      const len = Vector3.Distance(prev, p);
      const m = MeshBuilder.CreateCylinder(`${this.name}-${this.parts.length}`, { height: len, diameter: 0.035, tessellation: 4 }, this.scene);
      m.position.copyFrom(mid);
      const dir = p.subtract(prev).normalize();
      // Align the cylinder's Y axis with the segment.
      const axis = Vector3.Cross(Vector3.Up(), dir);
      const angle = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(Vector3.Up(), dir))));
      if (axis.lengthSquared() > 1e-8) m.rotate(axis.normalize(), angle);
      this.parts.push({ mesh: m, color });
      prev = p;
    }
  }

  build(materials: ToonMaterials, preset: PresetName): Mesh | null {
    if (this.parts.length === 0) return null;
    for (const { mesh, color } of this.parts) {
      mesh.bakeCurrentTransformIntoVertices();
      const c = Color3.FromHexString(color);
      const n = mesh.getTotalVertices();
      const colors = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b, 1], i * 4);
      mesh.setVerticesData(VertexBuffer.ColorKind, colors);
    }
    const merged = MeshClass.MergeMeshes(
      this.parts.map((p) => p.mesh),
      true,
      true,
    );
    if (!merged) return null;
    merged.name = this.name;
    merged.material = materials.get(preset);
    merged.isPickable = false;
    merged.freezeWorldMatrix();
    return merged;
  }
}

type Block = StaticProp & { view: Extract<StaticProp["view"], { kind: "block" }> };

const isBuilding = (p: StaticProp): p is Block => p.view.kind === "block" && p.solid && p.view.size.y >= 8 && p.view.size.x < 30 && p.view.size.z < 30;

/** Facade facing the street: buildings left and right of x = 0 face inwards. */
const facadeOf = (b: Block) => {
  const { center, view } = b;
  const sx = center.x < 0 ? 1 : -1;
  return {
    normal: new Vector3(sx, 0, 0),
    plane: center.x + (sx * view.size.x) / 2,
    zMin: center.z - view.size.z / 2,
    zMax: center.z + view.size.z / 2,
    height: view.size.y,
    roof: { x: center.x, z: center.z, w: view.size.x, d: view.size.z },
  };
};

export interface Dressing {
  readonly meshes: Mesh[];
  /** Meshes that cast the moon shadow (puddles lie flat on the ground and must not). */
  readonly casters: Mesh[];
}

/**
 * Procedural set dressing for the M0 district: everything that turns boxes into a lived-in
 * street (ledges, shop fronts, awnings, AC units, pipes, fire escapes, rooftop tanks, road
 * markings, puddles, rubbish, a vending machine, cables overhead). Pure presentation, merged
 * into a handful of vertex-coloured meshes.
 */
export const createDressing = (scene: Scene, materials: ToonMaterials): Dressing => {
  const rand = lcg(1337);
  const main = new Batch(scene, "dressing");
  const puddles = new Batch(scene, "puddles");
  const glow = new Batch(scene, "dressing-glow");
  const buildings = DISTRICT_M0_PROPS.filter(isBuilding);
  // Keep facade clutter off the neon signs.
  const signs = DISTRICT_M0_PROPS.filter((p) => p.view.kind === "neon").map((p) => {
    const size = p.view.kind === "neon" ? p.view.size : { x: 0, y: 0, z: 0 };
    return { x: p.center.x, y: p.center.y, z: p.center.z, hy: size.y / 2 + 0.8, hz: Math.max(size.z, size.x) / 2 + 0.8 };
  });
  const onSign = (x: number, y: number, z: number) =>
    signs.some((s) => Math.sign(s.x) === Math.sign(x) && Math.abs(s.y - y) < s.hy && Math.abs(s.z - z) < s.hz);

  for (const b of buildings) {
    const f = facadeOf(b);
    const out = (d: number) => f.plane + f.normal.x * d;
    const width = f.zMax - f.zMin;
    const zc = (f.zMin + f.zMax) / 2;
    // Floor ledges every third floor and a heavy cornice at the roofline.
    for (let y = 3.2 * 3; y < f.height - 1; y += 3.2 * 3) main.box(0.22, 0.14, width, new Vector3(out(0.11), y, zc), PALETTE.ledge);
    main.box(0.5, 0.35, width + 0.3, new Vector3(out(0.25), f.height - 0.18, zc), PALETTE.ledgeDark);
    // Ground floor: recessed shop fronts with shutters and awnings.
    const shops = Math.max(1, Math.floor(width / 5));
    for (let i = 0; i < shops; i++) {
      const z = f.zMin + ((i + 0.5) * width) / shops;
      const w = Math.min(3.6, width / shops - 0.6);
      main.box(0.06, 2.5, w, new Vector3(out(0.03), 1.25, z), rand() < 0.5 ? PALETTE.shopDark : PALETTE.shutter);
      // Shutter slats read as fine horizontal ink lines.
      for (let y = 0.3; y < 2.4; y += 0.28) main.box(0.08, 0.03, w, new Vector3(out(0.05), y, z), PALETTE.ledgeDark);
      if (rand() < 0.75) {
        const color = PALETTE.awnings[Math.floor(rand() * PALETTE.awnings.length)] ?? PALETTE.awnings[0];
        main.box(1.3, 0.06, w + 0.4, new Vector3(out(0.62), 2.95, z), color, 0, 0, f.normal.x * 0.32);
      }
    }
    // AC units hanging under windows.
    const acs = 3 + Math.floor(rand() * 5);
    for (let i = 0; i < acs; i++) {
      const z = f.zMin + 1 + rand() * (width - 2);
      const floor = 1 + Math.floor(rand() * Math.max(1, (f.height - 4) / 3.2));
      const y = floor * 3.2 + 3.0;
      if (y > f.height - 1.5 || onSign(f.plane, y, z)) continue;
      main.box(0.55, 0.55, 0.85, new Vector3(out(0.28), y, z), PALETTE.ac);
      main.box(0.04, 0.4, 0.6, new Vector3(out(0.57), y, z), PALETTE.acGrille);
    }
    // Drain pipe down one edge.
    const pz = rand() < 0.5 ? f.zMin + 0.4 : f.zMax - 0.4;
    main.cylinder(f.height, 0.14, 0.14, new Vector3(out(0.12), f.height / 2, pz), PALETTE.pipe);
    // Fire escape on the taller buildings.
    if (f.height > 16 && rand() < 0.7) {
      const ez = zc + (rand() - 0.5) * (width - 4);
      for (let y = 6.4; y < f.height - 2; y += 3.2) {
        main.box(1.0, 0.06, 2.6, new Vector3(out(0.5), y, ez), PALETTE.iron);
        main.box(0.04, 0.9, 2.6, new Vector3(out(1.0), y + 0.45, ez), PALETTE.iron);
        main.box(0.85, 0.04, 0.12, new Vector3(out(0.5), y + 1.6, ez + 0.6), PALETTE.iron, 0, 0, f.normal.x * 0.85);
      }
    }
    // Rooftop: water tank or an antenna cluster.
    const roofY = f.height;
    if (rand() < 0.5) {
      const tx = f.roof.x + (rand() - 0.5) * f.roof.w * 0.5;
      const tz = f.roof.z + (rand() - 0.5) * f.roof.d * 0.5;
      main.cylinder(2.2, 2.2, 2.2, new Vector3(tx, roofY + 2.3, tz), PALETTE.tank, 0, 0, 12);
      main.cylinder(0.8, 0, 2.4, new Vector3(tx, roofY + 3.8, tz), PALETTE.tank, 0, 0, 12);
      for (const [dx, dz] of [
        [-0.8, -0.8],
        [0.8, -0.8],
        [-0.8, 0.8],
        [0.8, 0.8],
      ] as const) {
        main.cylinder(1.2, 0.1, 0.1, new Vector3(tx + dx, roofY + 0.6, tz + dz), PALETTE.iron);
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const h = 3 + rand() * 4;
        main.cylinder(h, 0.05, 0.08, new Vector3(f.roof.x + (rand() - 0.5) * 4, roofY + h / 2, f.roof.z + (rand() - 0.5) * 4), PALETTE.antenna);
      }
    }
  }

  // Overhead cables criss-crossing the street between facing buildings.
  for (let z = -30; z < 30; z += 6 + rand() * 4) {
    const y1 = 7 + rand() * 6;
    const y2 = 7 + rand() * 6;
    main.cable(new Vector3(-7, y1, z), new Vector3(7, y2, z + (rand() - 0.5) * 6), 0.8 + rand() * 1.2, PALETTE.cable);
  }

  // Road: dashed centre line, a crosswalk by the bar, the manhole the steam rises from.
  for (let z = -33; z < 30; z += 4) main.box(0.14, 0.012, 2, new Vector3(0, 0.006, z), PALETTE.line);
  for (let x = -5.5; x <= 5.5; x += 1.1) main.box(0.55, 0.012, 3, new Vector3(x, 0.006, -3.5), PALETTE.line);
  main.cylinder(0.03, 0.9, 0.9, new Vector3(1.8, 0.015, 5.5), PALETTE.manhole, 0, 0, 16);

  // Puddles: dark glossy patches that catch the street lights.
  for (let i = 0; i < 16; i++) {
    const x = (rand() - 0.5) * 11;
    const z = -32 + rand() * 76;
    const m = MeshBuilder.CreateDisc(`puddle-${i}`, { radius: 0.7 + rand() * 1.4, tessellation: 18 }, scene);
    m.rotation.x = Math.PI / 2;
    m.scaling.set(1 + rand(), 1, 1);
    m.position.set(x, 0.01, z);
    puddles.parts.push({ mesh: m, color: "#ffffff" });
  }

  // Rubbish: bag piles and cardboard by the alley and the shop fronts.
  for (const [x, z] of [
    [-6.4, 15],
    [6.3, -18],
    [-4.5, 47],
    [6.6, 33],
    [-6.5, -29],
  ] as const) {
    for (let i = 0; i < 4; i++) {
      main.sphere(0.7, new Vector3(x + (rand() - 0.5) * 0.9, 0.25, z + (rand() - 0.5) * 1.2), rand() < 0.5 ? PALETTE.bag : PALETTE.bag2, [1, 0.75, 1.1]);
    }
    main.box(0.6, 0.45, 0.5, new Vector3(x + 0.6, 0.22, z - 0.9), PALETTE.cardboard, rand());
  }

  // Vending machine next to the Neon Koi.
  main.box(0.8, 1.9, 0.75, new Vector3(6.5, 0.95, -4.6), PALETTE.vending, Math.PI / 2);
  glow.box(0.04, 1.2, 0.55, new Vector3(6.08, 1.15, -4.6), "#ffffff");

  const solid = main.build(materials, "dressing");
  const wet = puddles.build(materials, "puddle");
  const lit = glow.build(materials, "vendingGlow");
  const meshes = [solid, wet, lit].filter((m): m is Mesh => m !== null);
  return { meshes, casters: solid ? [solid] : [] };
};
