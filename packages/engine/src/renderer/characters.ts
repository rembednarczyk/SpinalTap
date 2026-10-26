import { type Mesh, MeshBuilder, type Scene, TransformNode } from "../babylon";
import { applyOutline } from "../npr/outline";
import type { PresetName } from "../npr/presets";
import { type ToonMaterials, presetHasOutline } from "../npr/toon-material";

/** A procedurally built character with pivots for simple procedural animation. */
export interface CharacterRig {
  readonly root: TransformNode;
  readonly body: TransformNode;
  readonly legL: TransformNode;
  readonly legR: TransformNode;
  readonly armL: TransformNode;
  readonly armR: TransformNode;
  readonly meshes: Mesh[];
  /** Arm that holds a weapon is posed forward instead of swinging. */
  readonly aiming: boolean;
  phase: number;
}

type Shape =
  | { kind: "capsule"; radius: number; height: number }
  | { kind: "sphere"; diameter: number }
  | { kind: "box"; w: number; h: number; d: number }
  | { kind: "cylinder"; height: number; top: number; bottom: number }
  | { kind: "torus"; diameter: number; thickness: number };

class RigBuilder {
  readonly meshes: Mesh[] = [];
  constructor(
    private readonly scene: Scene,
    private readonly materials: ToonMaterials,
    private readonly name: string,
  ) {}

  node(name: string, parent: TransformNode, x = 0, y = 0, z = 0): TransformNode {
    const n = new TransformNode(`${this.name}-${name}`, this.scene);
    n.parent = parent;
    n.position.set(x, y, z);
    return n;
  }

  part(shape: Shape, preset: PresetName, parent: TransformNode, x = 0, y = 0, z = 0): Mesh {
    const id = `${this.name}-p${this.meshes.length}`;
    let m: Mesh;
    switch (shape.kind) {
      case "capsule":
        m = MeshBuilder.CreateCapsule(id, { radius: shape.radius, height: shape.height, tessellation: 12, subdivisions: 1 }, this.scene);
        break;
      case "sphere":
        m = MeshBuilder.CreateSphere(id, { diameter: shape.diameter, segments: 12 }, this.scene);
        break;
      case "box":
        m = MeshBuilder.CreateBox(id, { width: shape.w, height: shape.h, depth: shape.d }, this.scene);
        break;
      case "cylinder":
        m = MeshBuilder.CreateCylinder(id, { height: shape.height, diameterTop: shape.top, diameterBottom: shape.bottom, tessellation: 14 }, this.scene);
        break;
      case "torus":
        m = MeshBuilder.CreateTorus(id, { diameter: shape.diameter, thickness: shape.thickness, tessellation: 18 }, this.scene);
        break;
    }
    m.material = this.materials.get(preset);
    m.parent = parent;
    m.position.set(x, y, z);
    m.isPickable = false;
    if (presetHasOutline(preset)) applyOutline(m);
    this.meshes.push(m);
    return m;
  }
}

interface Palette {
  skin: PresetName;
  top: PresetName;
  legs: PresetName;
}

/** Shared humanoid skeleton: legs and arms on pivots, torso and head on a bobbing body node. */
const humanoid = (b: RigBuilder, root: TransformNode, pal: Palette, build: { width: number; height: number }) => {
  const s = build.height / 1.8;
  const body = b.node("body", root);
  const hipY = 0.92 * s;
  const legL = b.node("legL", body, -0.1 * build.width, hipY, 0);
  const legR = b.node("legR", body, 0.1 * build.width, hipY, 0);
  for (const leg of [legL, legR]) b.part({ kind: "capsule", radius: 0.08 * build.width, height: 0.94 * s }, pal.legs, leg, 0, -0.45 * s, 0);
  b.part({ kind: "capsule", radius: 0.18 * build.width, height: 0.66 * s }, pal.top, body, 0, 1.24 * s, 0);
  b.part({ kind: "cylinder", height: 0.12 * s, top: 0.09, bottom: 0.1 }, pal.skin, body, 0, 1.56 * s, 0);
  const head = b.part({ kind: "sphere", diameter: 0.25 * s }, pal.skin, body, 0, 1.68 * s, 0.01);
  const shoulderY = 1.46 * s;
  const armL = b.node("armL", body, -0.24 * build.width, shoulderY, 0);
  const armR = b.node("armR", body, 0.24 * build.width, shoulderY, 0);
  for (const arm of [armL, armR]) b.part({ kind: "capsule", radius: 0.055 * build.width, height: 0.62 * s }, pal.top, arm, 0, -0.29 * s, 0);
  for (const arm of [armL, armR]) b.part({ kind: "sphere", diameter: 0.1 * build.width }, pal.skin, arm, 0, -0.6 * s, 0);
  return { body, legL, legR, armL, armR, head, s };
};

const finish = (root: TransformNode, b: RigBuilder, parts: Omit<CharacterRig, "root" | "meshes" | "phase" | "aiming">, aiming: boolean): CharacterRig => {
  if (aiming) parts.armR.rotation.x = -1.35;
  return { root, meshes: b.meshes, aiming, phase: 0, ...parts };
};

export const buildHeroine = (scene: Scene, materials: ToonMaterials, name: string): CharacterRig => {
  const root = new TransformNode(name, scene);
  const b = new RigBuilder(scene, materials, name);
  const h = humanoid(b, root, { skin: "skin", top: "heroineCoat", legs: "heroineLegs" }, { width: 0.92, height: 1.74 });
  const { body, s } = h;
  // Long coat tail and high collar.
  b.part({ kind: "cylinder", height: 0.62 * s, top: 0.32, bottom: 0.5 }, "heroineCoat", body, 0, 0.78 * s, -0.01);
  b.part({ kind: "cylinder", height: 0.1 * s, top: 0.2, bottom: 0.24 }, "heroineCoat", body, 0, 1.53 * s, 0);
  // Bob haircut with straight bangs.
  const hair = b.part({ kind: "sphere", diameter: 0.28 * s }, "heroineHair", body, 0, 1.73 * s, -0.045);
  hair.scaling.set(1.04, 0.9, 1);
  b.part({ kind: "box", w: 0.25 * s, h: 0.05 * s, d: 0.06 }, "heroineHair", body, 0, 1.79 * s, 0.075);
  b.part({ kind: "box", w: 0.29 * s, h: 0.17 * s, d: 0.16 }, "heroineHair", body, 0, 1.64 * s, -0.08);
  // Cybernetic optic line.
  b.part({ kind: "box", w: 0.15, h: 0.018, d: 0.02 }, "heroineVisor", body, 0, 1.69 * s, 0.12);
  // Pistol in the right hand.
  b.part({ kind: "box", w: 0.05, h: 0.09, d: 0.2 }, "gun", h.armR, 0, -0.62 * s, 0.05);
  return finish(root, b, h, true);
};

export const buildFixer = (scene: Scene, materials: ToonMaterials, name: string): CharacterRig => {
  const root = new TransformNode(name, scene);
  const b = new RigBuilder(scene, materials, name);
  const h = humanoid(b, root, { skin: "fixerSkin", top: "fixerJacket", legs: "fixerPants" }, { width: 1.3, height: 1.86 });
  b.part({ kind: "box", w: 0.2, h: 0.045, d: 0.04 }, "shades", h.body, 0, 1.7 * h.s, 0.12);
  const chain = b.part({ kind: "torus", diameter: 0.3, thickness: 0.02 }, "gold", h.body, 0, 1.47 * h.s, 0.04);
  chain.rotation.x = 1.2;
  h.armL.rotation.z = 0.15;
  h.armR.rotation.z = -0.15;
  return finish(root, b, h, false);
};

export const buildGanger = (scene: Scene, materials: ToonMaterials, name: string): CharacterRig => {
  const root = new TransformNode(name, scene);
  const b = new RigBuilder(scene, materials, name);
  const h = humanoid(b, root, { skin: "skin", top: "gangerHood", legs: "gangerPants" }, { width: 1.05, height: 1.8 });
  const hood = b.part({ kind: "sphere", diameter: 0.33 * h.s }, "gangerHood", h.body, 0, 1.7 * h.s, -0.03);
  hood.scaling.set(1, 1.05, 1.08);
  b.part({ kind: "box", w: 0.17, h: 0.03, d: 0.03 }, "gangerMask", h.body, 0, 1.66 * h.s, 0.13);
  b.part({ kind: "box", w: 0.06, h: 0.12, d: 0.34 }, "gun", h.armR, 0, -0.62 * h.s, 0.1);
  return finish(root, b, h, true);
};

export const buildCivilian = (scene: Scene, materials: ToonMaterials, name: string): CharacterRig => {
  const root = new TransformNode(name, scene);
  const b = new RigBuilder(scene, materials, name);
  const h = humanoid(b, root, { skin: "skin", top: "umeCoat", legs: "umeCoat" }, { width: 1, height: 1.52 });
  b.part({ kind: "cylinder", height: 0.55 * h.s, top: 0.36, bottom: 0.52 }, "umeCoat", h.body, 0, 0.75 * h.s, 0);
  b.part({ kind: "sphere", diameter: 0.15 }, "umeHair", h.body, 0, 1.86 * h.s, -0.05);
  b.part({ kind: "sphere", diameter: 0.27 * h.s }, "umeHair", h.body, 0, 1.71 * h.s, -0.03);
  // Umbrella held in the left hand.
  h.armL.rotation.x = -0.6;
  b.part({ kind: "cylinder", height: 1.1, top: 0.02, bottom: 0.02 }, "pole", h.armL, 0, -0.1, 0.2);
  b.part({ kind: "cylinder", height: 0.32, top: 0, bottom: 1.15 }, "umbrella", h.armL, 0, 0.55, 0.2);
  return finish(root, b, h, false);
};

/** Advances the walk cycle from the entity's horizontal speed. */
export const animateRig = (rig: CharacterRig, speed: number, dt: number): void => {
  const amount = Math.min(1, speed / 4.2);
  rig.phase += dt * (4 + speed * 1.9) * (amount > 0.05 ? 1 : 0);
  const swing = Math.sin(rig.phase) * 0.75 * amount;
  rig.legL.rotation.x = swing;
  rig.legR.rotation.x = -swing;
  rig.armL.rotation.x = -swing * 0.6;
  if (!rig.aiming) rig.armR.rotation.x = swing * 0.6;
  rig.body.position.y = Math.abs(Math.cos(rig.phase)) * 0.045 * amount;
};
