import { Color3, DynamicTexture, type Mesh, MeshBuilder, MeshClass, type Scene, StandardMaterial, TransformNode, Vector3, VertexBuffer, VertexData } from "../babylon";
import type { ViewDescriptor } from "@seki/core";
import type { ToonMaterials } from "../npr/toon-material";
import type { PresetName } from "../npr/presets";

export interface PropView {
  readonly root: TransformNode;
  /** Meshes that should bloom in the glow layer. */
  readonly glowing: Mesh[];
  /** Meshes that block the TPP camera. */
  readonly blockers: Mesh[];
  /** Meshes that cast the moon shadow. */
  readonly casters: Mesh[];
  readonly light: { position: { x: number; y: number; z: number }; color: string; range: number; intensity: number } | null;
}

type Block = Extract<ViewDescriptor, { kind: "block" }>;
type Neon = Extract<ViewDescriptor, { kind: "neon" }>;
type Loot = Extract<ViewDescriptor, { kind: "loot" }>;
type Water = Extract<ViewDescriptor, { kind: "water" }>;

/** Mist layers over open water (ADR-0024): heights above the surface and opacity, lowest first. */
const MIST_LAYERS: readonly (readonly [height: number, alpha: number])[] = [
  [0.5, 0.16],
  [1.7, 0.09],
  [3.4, 0.05],
];

/** One mist material per scene and layer, shared by every water surface (streaming adds and removes them). */
const mistMaterials = new WeakMap<Scene, StandardMaterial[]>();
const mistMaterial = (scene: Scene, layer: number): StandardMaterial => {
  let list = mistMaterials.get(scene);
  if (!list) mistMaterials.set(scene, (list = []));
  let m = list[layer];
  if (!m) {
    m = new StandardMaterial(`mist-${layer}`, scene);
    m.disableLighting = true;
    m.emissiveColor = Color3.FromHexString("#6f8aa0");
    m.alpha = MIST_LAYERS[layer]?.[1] ?? 0.05;
    m.backFaceCulling = false;
    list[layer] = m;
  }
  return m;
};

/**
 * Open water (ADR-0024): a dark glossy plane that catches the quay lights, and a few layers of
 * thin mist above it that thicken towards the surface. Nothing to collide with or cast shadows.
 */
export const buildWater = (scene: Scene, materials: ToonMaterials, name: string, v: Water, at: Vector3): PropView => {
  const root = new TransformNode(name, scene);
  root.position.copyFrom(at);
  const surface = MeshBuilder.CreateGround(`${name}-mesh`, { width: v.size.x, height: v.size.z, subdivisions: 1 }, scene);
  surface.parent = root;
  surface.material = materials.get("water");
  surface.isPickable = false;
  surface.freezeWorldMatrix();
  MIST_LAYERS.forEach(([height], i) => {
    const mist = MeshBuilder.CreateGround(`${name}-mist${i}`, { width: v.size.x, height: v.size.z, subdivisions: 1 }, scene);
    mist.parent = root;
    mist.position.y = height;
    mist.material = mistMaterial(scene, i);
    mist.isPickable = false;
    mist.freezeWorldMatrix();
  });
  return { root, glowing: [], blockers: [], casters: [], light: null };
};

/** Strip colour per best rarity in a loot bag; the same hues as the UI rarity frames. */
const LOOT_STRIP: Readonly<Record<NonNullable<Loot["best"]> | "none", string>> = {
  none: "#8a93a6",
  common: "#c9d1e0",
  uncommon: "#5ff2ff",
  rare: "#ff3d8b",
  unique: "#ffbf4a",
};

/** A dark duffel bag with a neon strip in the colour of the best item inside (ADR-0015). */
export const buildLootBag = (scene: Scene, materials: ToonMaterials, name: string, v: Loot, at: Vector3): PropView => {
  const root = new TransformNode(name, scene);
  root.position.copyFrom(at);
  const bag = MeshBuilder.CreateCapsule(`${name}-mesh`, { radius: 0.15, height: 0.56, orientation: Vector3.Right(), tessellation: 10, subdivisions: 1 }, scene);
  bag.parent = root;
  bag.position.y = 0.14;
  bag.scaling.set(1, 0.85, 1);
  bag.material = materials.get("cyberDark");
  bag.isPickable = true;
  bag.freezeWorldMatrix();
  const strip = MeshBuilder.CreateBox(`${name}-strip`, { width: 0.5, height: 0.03, depth: 0.012 }, scene);
  strip.parent = root;
  strip.position.set(0, 0.2, -0.13);
  strip.isPickable = false;
  const mat = new StandardMaterial(`${name}-strip-mat`, scene);
  mat.disableLighting = true;
  mat.emissiveColor = Color3.FromHexString(LOOT_STRIP[v.best ?? "none"]);
  strip.material = mat;
  strip.freezeWorldMatrix();
  return { root, glowing: [strip], blockers: [], casters: [bag], light: null };
};

/**
 * A building: tall, with a footprint wide enough for rooms. It keeps the procedural windows;
 * everything else (district walls, pillars, shaft walls, decks, kiosks) is a bare structure.
 */
export const isBuildingBlock = (v: Pick<Block, "size" | "material">): boolean =>
  v.material !== "asphalt" && v.size.y >= 6 && Math.min(v.size.x, v.size.z) >= 3 && Math.max(v.size.x, v.size.z) < 40;

export const blockPreset = (v: Block): PresetName => {
  if (v.material === "asphalt") return "asphalt";
  if (v.size.y < 0.2) return "sidewalk";
  if (v.rungs) return "metal";
  if (v.material === "glass") return "glass";
  if (isBuildingBlock(v)) return v.material === "metal" ? "metal" : "concrete";
  // Bare structures get a procedural skin (ADR-0027): formwork concrete or ribbed sheet metal.
  return v.material === "metal" ? "metalPanel" : "concreteBare";
};

type Slope = NonNullable<Block["slope"]>;

/** 0 at the slope's low end .. 1 at its high end, for a local coordinate along its axis. */
const slopeT = (slope: Slope, local: number, length: number): number => {
  const f = Math.max(0, Math.min(1, local / length + 0.5));
  return slope.dir === 1 ? f : 1 - f;
};

/** Stairs: one box per step, merged; each step's tread sits at the ramp height mid-step (ADR-0020). */
const buildSteps = (scene: Scene, name: string, size: Block["size"], slope: Slope & { steps: number }): Mesh => {
  const along = slope.axis === "x" ? size.x : size.z;
  const run = along / slope.steps;
  const parts: Mesh[] = [];
  for (let i = 0; i < slope.steps; i++) {
    const t = (i + 0.5) / slope.steps;
    const h = Math.max(0.02, slope.low + (size.y - slope.low) * t);
    const local = (slope.dir === 1 ? t - 0.5 : 0.5 - t) * along;
    const step = MeshBuilder.CreateBox(`${name}-step${i}`, slope.axis === "x" ? { width: run, height: h, depth: size.z } : { width: size.x, height: h, depth: run }, scene);
    step.position.set(slope.axis === "x" ? local : 0, h / 2 - size.y / 2, slope.axis === "z" ? local : 0);
    parts.push(step);
  }
  const merged = MeshClass.MergeMeshes(parts, true);
  if (!merged) throw new Error(`stairs ${name}: nothing to merge`);
  merged.name = `${name}-mesh`;
  return merged;
};

/** Rail and rung thickness of a ladder, metres. */
const LADDER_BAR = 0.05;

/**
 * A fire escape ladder (ADR-0021): two side rails along the height and `rungs` bars across
 * the wider horizontal side, merged into one mesh.
 */
const buildLadder = (scene: Scene, name: string, size: Block["size"], rungs: number): Mesh => {
  const alongX = size.x >= size.z;
  const width = alongX ? size.x : size.z;
  const parts: Mesh[] = [];
  for (const side of [-1, 1]) {
    const rail = MeshBuilder.CreateBox(`${name}-rail${side}`, { width: LADDER_BAR, height: size.y, depth: LADDER_BAR }, scene);
    rail.position.set(alongX ? (side * (width - LADDER_BAR)) / 2 : 0, 0, alongX ? 0 : (side * (width - LADDER_BAR)) / 2);
    parts.push(rail);
  }
  for (let i = 0; i < rungs; i++) {
    const rung = MeshBuilder.CreateBox(`${name}-rung${i}`, alongX ? { width, height: LADDER_BAR * 0.8, depth: LADDER_BAR * 0.8 } : { width: LADDER_BAR * 0.8, height: LADDER_BAR * 0.8, depth: width }, scene);
    rung.position.y = -size.y / 2 + ((i + 0.5) / rungs) * size.y;
    parts.push(rung);
  }
  const merged = MeshClass.MergeMeshes(parts, true);
  if (!merged) throw new Error(`ladder ${name}: nothing to merge`);
  merged.name = `${name}-mesh`;
  return merged;
};

/** A box whose top slopes (a stair railing, a ramp): the top vertices follow the slope. */
const buildWedge = (scene: Scene, name: string, size: Block["size"], slope: Slope): Mesh => {
  const m = MeshBuilder.CreateBox(`${name}-mesh`, { width: size.x, height: size.y, depth: size.z, updatable: true }, scene);
  const pos = m.getVerticesData(VertexBuffer.PositionKind);
  const indices = m.getIndices();
  if (!pos || !indices) return m;
  const length = slope.axis === "x" ? size.x : size.z;
  for (let i = 0; i < pos.length; i += 3) {
    if ((pos[i + 1] ?? 0) <= 0) continue;
    const t = slopeT(slope, (slope.axis === "x" ? pos[i] : pos[i + 2]) ?? 0, length);
    pos[i + 1] = -size.y / 2 + slope.low + (size.y - slope.low) * t;
  }
  const normals: number[] = [];
  VertexData.ComputeNormals(pos, indices, normals);
  m.updateVerticesData(VertexBuffer.PositionKind, pos);
  m.updateVerticesData(VertexBuffer.NormalKind, normals);
  m.refreshBoundingInfo();
  return m;
};

export const buildBlock = (scene: Scene, materials: ToonMaterials, name: string, v: Block, at: Vector3): PropView => {
  const root = new TransformNode(name, scene);
  root.position.copyFrom(at);
  const m = v.rungs
    ? buildLadder(scene, name, v.size, v.rungs)
    : v.slope
    ? v.slope.steps
      ? buildSteps(scene, name, v.size, { ...v.slope, steps: v.slope.steps })
      : buildWedge(scene, name, v.size, v.slope)
    : MeshBuilder.CreateBox(`${name}-mesh`, { width: v.size.x, height: v.size.y, depth: v.size.z }, scene);
  m.parent = root;
  m.material = materials.get(blockPreset(v));
  m.isPickable = true;
  m.freezeWorldMatrix();
  const tall = v.size.y > 0.3;
  return { root, glowing: [], blockers: tall ? [m] : [], casters: tall ? [m] : [], light: null };
};

const neonTexture = (scene: Scene, name: string, label: string, color: string, vertical: boolean, aspect: number): DynamicTexture => {
  const w = vertical ? 128 : Math.min(1024, Math.round(128 * aspect));
  const h = vertical ? Math.min(1024, Math.round(128 * aspect)) : 128;
  const tex = new DynamicTexture(`${name}-tex`, { width: w, height: h }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = "#06070b";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${vertical ? 84 : 76}px "Rajdhani", "Arial Narrow", sans-serif`;
  if (vertical) {
    const step = h / (label.length + 1);
    [...label].forEach((ch, i) => ctx.fillText(ch, w / 2, step * (i + 1)));
  } else {
    ctx.fillText(label, w / 2, h / 2 + 4, w - 30);
  }
  tex.update();
  return tex;
};

export const buildNeon = (scene: Scene, name: string, v: Neon, at: Vector3): PropView => {
  const root = new TransformNode(name, scene);
  root.position.copyFrom(at);
  const thinX = v.size.x <= v.size.z && v.size.x <= v.size.y;
  const width = thinX ? v.size.z : v.size.x;
  const height = v.size.y;
  const plane = MeshBuilder.CreatePlane(`${name}-mesh`, { width, height }, scene);
  plane.parent = root;
  // Face the street: east-side signs look west, west-side signs look east, the rest look south.
  plane.rotation.y = thinX ? (at.x > 0 ? Math.PI / 2 : -Math.PI / 2) : 0;
  plane.isPickable = false;
  const mat = new StandardMaterial(`${name}-mat`, scene);
  mat.disableLighting = true;
  const color = Color3.FromHexString(v.color);
  if (v.label) {
    const tex = neonTexture(scene, name, v.label, v.color, height > width, Math.max(width, height) / Math.min(width, height));
    mat.emissiveTexture = tex;
    mat.diffuseTexture = tex;
  }
  mat.emissiveColor = v.label ? Color3.White() : color;
  mat.backFaceCulling = false;
  plane.material = mat;
  plane.freezeWorldMatrix();
  const outward = thinX ? (at.x > 0 ? -1.2 : 1.2) : 0;
  return {
    root,
    glowing: [plane],
    blockers: [],
    casters: [],
    light: { position: { x: at.x + outward, y: at.y, z: at.z + (thinX ? 0 : -1.2) }, color: v.color, range: 11, intensity: 0.55 },
  };
};

export const buildLamp = (scene: Scene, materials: ToonMaterials, name: string, color: string, at: Vector3): PropView => {
  const root = new TransformNode(name, scene);
  root.position.copyFrom(at);
  const towardStreet = at.x > 0 ? -1 : 1;
  const pole = MeshBuilder.CreateCylinder(`${name}-pole`, { height: 5.2, diameter: 0.14, tessellation: 10 }, scene);
  pole.parent = root;
  pole.position.y = 2.6;
  pole.material = materials.get("pole");
  const arm = MeshBuilder.CreateBox(`${name}-arm`, { width: 1.3, height: 0.08, depth: 0.1 }, scene);
  arm.parent = root;
  arm.position.set(towardStreet * 0.6, 5.15, 0);
  arm.material = materials.get("pole");
  const bulb = MeshBuilder.CreateBox(`${name}-bulb`, { width: 0.5, height: 0.07, depth: 0.22 }, scene);
  bulb.parent = root;
  bulb.position.set(towardStreet * 1.05, 5.07, 0);
  const mat = new StandardMaterial(`${name}-mat`, scene);
  mat.disableLighting = true;
  mat.emissiveColor = Color3.FromHexString(color);
  bulb.material = mat;
  for (const m of [pole, arm, bulb]) {
    m.isPickable = false;
    m.freezeWorldMatrix();
  }
  return {
    root,
    glowing: [bulb],
    blockers: [],
    casters: [pole, arm],
    light: { position: { x: at.x + towardStreet * 1.05, y: 4.6, z: at.z }, color, range: 14, intensity: 0.85 },
  };
};
