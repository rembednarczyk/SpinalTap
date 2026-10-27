import { Bone, Color3, CreateLathe, Matrix, type Mesh, MeshBuilder, MeshClass, Quaternion, type Scene, Skeleton, TransformNode, Vector3, VertexBuffer } from "../babylon";
import { applyOutline } from "../npr/outline";
import { PRESETS, type PresetName } from "../npr/presets";
import { type ToonMaterials, presetHasOutline } from "../npr/toon-material";

/** A procedurally built character with a jointed skeleton for procedural animation. */
export interface CharacterRig {
  readonly root: TransformNode;
  /** Everything above the feet; bobs while walking and tips over on death. */
  readonly body: TransformNode;
  readonly head: TransformNode;
  readonly legL: TransformNode;
  readonly legR: TransformNode;
  readonly kneeL: TransformNode;
  readonly kneeR: TransformNode;
  readonly armL: TransformNode;
  readonly armR: TransformNode;
  readonly elbowL: TransformNode;
  readonly elbowR: TransformNode;
  readonly meshes: Mesh[];
  /** Carries a pistol: holster at the right hip, drawn into the right hand. */
  readonly aiming: boolean;
  /** Pistol in the hand and in the holster; the one not in use is scaled to zero. */
  readonly gunHand: TransformNode | null;
  readonly gunHip: TransformNode | null;
  /** The placeholder box pistols under hand and holster; scaled to zero once a weapon model is mounted. */
  readonly gunBoxes: readonly TransformNode[];
  /** 0 holstered .. 1 drawn, eased towards `drawTarget` over DRAW_SECONDS. */
  drawn: number;
  drawTarget: boolean;
  /** 0 low ready (muzzle down, arm loose) .. 1 aimed; raised by a shot, lowered after `aimHold`. */
  aim: number;
  aimHold: number;
  /** Seconds left of a reload, and its full length; 0 when not reloading. */
  reload: number;
  reloadTotal: number;
  /** Holds a melee weapon (from the appearance): swings and guards instead of aiming (ADR-0019). */
  melee: boolean;
  /** The melee swing being played, or null. */
  swing: Swing | null;
  /** 0..1 guard pose, eased towards the transform's guard. */
  guard: number;
  /** Seconds left of a stagger, and its full length; 0 when steady. */
  stagger: number;
  staggerTotal: number;
  /** Arms hang slightly away from the body (radians around Z). */
  readonly armSpread: number;
  /** Left arm held in a fixed pose (shoulder X, elbow X), e.g. holding an umbrella. */
  readonly leftHold: readonly [number, number] | null;
  phase: number;
  /** Forward stoop of the body at rest (radians around X), e.g. an old woman's bent back. */
  stoop: number;
  /** Seconds alive; drives idle breathing. */
  time: number;
  /** 0..1 flinch after a hit, decays quickly. */
  flinch: number;
  /** null while alive; seconds since death otherwise. */
  dying: number | null;
  /** Vertical speed last frame while airborne, null on the ground (ADR-0021). */
  lastAir: number | null;
  /** 0..1 blend of the jump pose, eased in on take-off and out on landing. */
  airBlend: number;
  /** 0..1 knee dip after landing, stronger after a long drop; decays. */
  landing: number;
  /** 0..1 blend of the ladder pose, and the phase of the hand-over-hand cycle. */
  climbBlend: number;
  climbPhase: number;
}

/** A melee swing in progress: strike `strike` of the combo, timed like the simulation's. */
export interface Swing {
  readonly strike: number;
  readonly windup: number;
  readonly recovery: number;
  elapsed: number;
}

type Profile = readonly (readonly [radius: number, y: number])[];

class RigBuilder {
  readonly meshes: Mesh[] = [];
  readonly presets = new Map<Mesh, PresetName>();
  constructor(
    readonly scene: Scene,
    readonly materials: ToonMaterials,
    readonly name: string,
  ) {}

  node(name: string, parent: TransformNode, x = 0, y = 0, z = 0): TransformNode {
    const n = new TransformNode(`${this.name}-${name}`, this.scene);
    n.parent = parent;
    n.position.set(x, y, z);
    return n;
  }

  private finishPart(m: Mesh, preset: PresetName, parent: TransformNode, x: number, y: number, z: number): Mesh {
    m.material = this.materials.get(preset);
    m.parent = parent;
    m.position.set(x, y, z);
    m.isPickable = false;
    this.presets.set(m, preset);
    this.meshes.push(m);
    return m;
  }

  /** Surface of revolution around local Y. Profile points are (radius, y), bottom to top. */
  lathe(profile: Profile, preset: PresetName, parent: TransformNode, opts: { x?: number; y?: number; z?: number; depth?: number; arc?: number; tessellation?: number } = {}): Mesh {
    const m = CreateLathe(
      `${this.name}-l${this.meshes.length}`,
      {
        shape: profile.map(([r, y]) => new Vector3(r, y, 0)),
        tessellation: opts.tessellation ?? 16,
        arc: opts.arc ?? 1,
        cap: MeshClass.CAP_ALL,
        sideOrientation: MeshClass.DOUBLESIDE,
      },
      this.scene,
    );
    if (opts.depth !== undefined) m.scaling.z = opts.depth;
    return this.finishPart(m, preset, parent, opts.x ?? 0, opts.y ?? 0, opts.z ?? 0);
  }

  sphere(diameter: number, preset: PresetName, parent: TransformNode, x = 0, y = 0, z = 0, scale?: [number, number, number]): Mesh {
    const m = MeshBuilder.CreateSphere(`${this.name}-s${this.meshes.length}`, { diameter, segments: 12 }, this.scene);
    if (scale) m.scaling.set(...scale);
    return this.finishPart(m, preset, parent, x, y, z);
  }

  box(w: number, h: number, d: number, preset: PresetName, parent: TransformNode, x = 0, y = 0, z = 0): Mesh {
    const m = MeshBuilder.CreateBox(`${this.name}-b${this.meshes.length}`, { width: w, height: h, depth: d }, this.scene);
    return this.finishPart(m, preset, parent, x, y, z);
  }

  cylinder(height: number, top: number, bottom: number, preset: PresetName, parent: TransformNode, x = 0, y = 0, z = 0): Mesh {
    const m = MeshBuilder.CreateCylinder(`${this.name}-c${this.meshes.length}`, { height, diameterTop: top, diameterBottom: bottom, tessellation: 14 }, this.scene);
    return this.finishPart(m, preset, parent, x, y, z);
  }

  torus(diameter: number, thickness: number, preset: PresetName, parent: TransformNode, x = 0, y = 0, z = 0): Mesh {
    const m = MeshBuilder.CreateTorus(`${this.name}-t${this.meshes.length}`, { diameter, thickness, tessellation: 18 }, this.scene);
    return this.finishPart(m, preset, parent, x, y, z);
  }
}

/** Body measurements in metres. Defaults describe Seki: tall, long-legged, anime proportions. */
interface Build {
  readonly height: number;
  readonly shoulder: number;
  readonly hip: number;
  readonly chest: number;
  readonly waist: number;
  readonly limb: number;
  readonly female: boolean;
}

interface Look {
  readonly skin: PresetName;
  readonly top: PresetName;
  readonly bottom: PresetName;
  readonly shoes: PresetName;
  /** Upper arm / forearm material; cyber arms add joints. */
  readonly arms: PresetName | "cyber";
  /** Long coat from chest to knees, in this material. */
  readonly coat?: PresetName;
  readonly face?: boolean;
}

interface Joints {
  body: TransformNode;
  head: TransformNode;
  legL: TransformNode;
  legR: TransformNode;
  kneeL: TransformNode;
  kneeR: TransformNode;
  armL: TransformNode;
  armR: TransformNode;
  elbowL: TransformNode;
  elbowR: TransformNode;
  /** Scale factor relative to the 1.74 m reference build. */
  s: number;
}

/**
 * Jointed humanoid from surfaces of revolution: hips/knees and shoulders/elbows are separate
 * pivots so walking bends knees and aiming straightens the gun arm.
 */
const humanoid = (b: RigBuilder, root: TransformNode, build: Build, look: Look): Joints => {
  const s = build.height / 1.74;
  const body = b.node("body", root);

  // Legs: thigh on the hip pivot, shin on the knee pivot.
  const hipY = 0.92 * s;
  const thigh = 0.44 * s;
  const shin = 0.42 * s;
  const lr = build.limb;
  const legs = ([-1, 1] as const).map((side) => {
    const leg = b.node(side < 0 ? "legL" : "legR", body, side * build.hip * 0.55, hipY, 0);
    b.lathe([[0.001, -thigh], [0.058 * lr, -thigh], [0.07 * lr, -thigh * 0.5], [0.082 * lr, -0.02], [0.001, 0.02]], look.bottom, leg, { depth: 0.95 });
    const knee = b.node(side < 0 ? "kneeL" : "kneeR", leg, 0, -thigh, 0);
    b.lathe([[0.001, -shin], [0.05 * lr, -shin], [0.056 * lr, -shin * 0.45], [0.06 * lr, 0], [0.001, 0.02]], look.bottom, knee, { depth: 0.95 });
    b.box(0.085 * lr, 0.07, 0.22 * s, look.shoes, knee, 0, -shin - 0.02, 0.045);
    return { leg, knee };
  });

  // Pelvis and torso: one profile from hips to the base of the neck, flattened front-to-back.
  const chestBump = build.female ? 1.08 : 1;
  b.lathe(
    [
      [0.001, 0.86 * s],
      [build.hip * 0.86, 0.88 * s],
      [build.hip, 0.95 * s],
      [build.waist, 1.08 * s],
      [build.chest * chestBump, 1.26 * s],
      [build.chest, 1.34 * s],
      [build.shoulder * 0.86, 1.42 * s],
      [build.shoulder * 0.55, 1.445 * s],
      [0.001, 1.45 * s],
    ],
    look.top,
    body,
    { depth: 0.68, tessellation: 20 },
  );
  // High-waisted trousers over the pelvis.
  b.lathe(
    [
      [0.001, 0.85 * s],
      [build.hip * 0.9, 0.86 * s],
      [build.hip * 1.04, 0.95 * s],
      [build.waist * 1.04, 1.1 * s],
      [0.001, 1.11 * s],
    ],
    look.bottom,
    body,
    { depth: 0.72, tessellation: 20 },
  );
  if (look.coat) {
    b.lathe(
      [
        [0.001, 0.46 * s],
        [build.hip * 1.35, 0.46 * s],
        [build.hip * 1.18, 0.9 * s],
        [build.waist * 1.12, 1.1 * s],
        [build.chest * 1.1, 1.3 * s],
        [build.shoulder * 0.92, 1.42 * s],
        [0.075, 1.5 * s],
        [0.001, 1.51 * s],
      ],
      look.coat,
      body,
      { depth: 0.74, tessellation: 20 },
    );
  }

  // Neck and head: egg-shaped skull, narrow jaw.
  b.cylinder(0.14 * s, 0.062, 0.078, look.skin, body, 0, 1.5 * s, 0);
  const head = b.node("head", body, 0, 1.6 * s, 0);
  b.lathe(
    [
      [0.001, -0.085],
      [0.035, -0.08],
      [0.062, -0.04],
      [0.074, 0.01],
      [0.072, 0.06],
      [0.05, 0.1],
      [0.001, 0.115],
    ].map(([r, y]) => [(r as number) * s, (y as number) * s] as const),
    look.skin,
    head,
    { depth: 0.92, tessellation: 18 },
  );
  if (look.face !== false) {
    // Anime face read at distance: two dark almond eyes, brows, small mouth.
    for (const side of [-1, 1]) {
      // Large almond eye tilted up at the outer corner, heavy upper lid line, thin brow.
      const eye = b.sphere(0.034 * s, "eyes", head, side * 0.03 * s, 0.01 * s, 0.063 * s, [1, 0.5, 0.18]);
      eye.rotation.z = side * 0.18;
      const lid = b.box(0.036 * s, 0.006 * s, 0.006, "eyes", head, side * 0.031 * s, 0.019 * s, 0.066 * s);
      lid.rotation.z = side * 0.2;
      const brow = b.box(0.03 * s, 0.004 * s, 0.005, "eyes", head, side * 0.031 * s, 0.042 * s, 0.066 * s);
      brow.rotation.z = -side * 0.12;
    }
    b.box(0.018 * s, 0.005 * s, 0.006, "lips", head, 0, -0.045 * s, 0.062 * s);
  }

  // Arms: upper arm on the shoulder, forearm on the elbow.
  const upper = 0.28 * s;
  const fore = 0.26 * s;
  const arms = ([-1, 1] as const).map((side) => {
    const arm = b.node(side < 0 ? "armL" : "armR", body, side * build.shoulder * 1.02, 1.42 * s, 0);
    const elbow = b.node(side < 0 ? "elbowL" : "elbowR", arm, 0, -upper, 0);
    if (look.arms === "cyber") {
      // Ivory plates, copper joints, dark mechanical hands (see the clinic reference).
      b.sphere(0.1 * s, "cyberCopper", arm, 0, 0, 0);
      b.lathe([[0.001, -upper], [0.034 * lr, -upper], [0.043 * lr, -upper * 0.4], [0.047 * lr, -0.03], [0.001, 0]], "cyberIvory", arm);
      b.torus(0.075 * lr, 0.012, "cyberDark", arm, 0, -upper * 0.55, 0);
      b.sphere(0.07 * s, "cyberCopper", elbow, 0, 0, 0);
      b.lathe([[0.001, -fore], [0.028 * lr, -fore], [0.038 * lr, -fore * 0.35], [0.034 * lr, -0.02], [0.001, 0]], "cyberIvory", elbow);
      b.torus(0.06 * lr, 0.01, "cyberDark", elbow, 0, -fore * 0.5, 0);
      b.torus(0.058 * lr, 0.014, "cyberCopper", elbow, 0, -fore, 0);
      b.box(0.05 * lr, 0.085 * s, 0.03, "cyberDark", elbow, 0, -fore - 0.05 * s, 0);
    } else {
      b.lathe([[0.001, -upper], [0.034 * lr, -upper], [0.042 * lr, -upper * 0.4], [0.048 * lr, -0.02], [0.001, 0.02]], look.arms, arm);
      b.lathe([[0.001, -fore], [0.028 * lr, -fore], [0.036 * lr, -fore * 0.4], [0.036 * lr, 0], [0.001, 0.01]], look.arms, elbow);
      b.box(0.048 * lr, 0.08 * s, 0.028, look.skin, elbow, 0, -fore - 0.045 * s, 0);
    }
    return { arm, elbow };
  });

  const [l, r] = legs as [(typeof legs)[0], (typeof legs)[0]];
  const [al, ar] = arms as [(typeof arms)[0], (typeof arms)[0]];
  return { body, head, legL: l.leg, legR: r.leg, kneeL: l.knee, kneeR: r.knee, armL: al.arm, armR: ar.arm, elbowL: al.elbow, elbowR: ar.elbow, s };
};

const EMISSIVE: ReadonlySet<PresetName> = new Set<PresetName>(["heroineVisor", "gangerMask", "docGoggles"]);

/**
 * Turns the loose parts into one skinned mesh per look group: every joint becomes a bone
 * linked to its pivot node (so the procedural animation keeps driving it), and each part's
 * preset colour is baked into vertex colours. A character costs 1-3 draw calls per pass
 * instead of one per part, in every pass (colour, shadow, G-buffer, outline).
 */
const skinCharacter = (b: RigBuilder, root: TransformNode, joints: TransformNode[]): Mesh[] => {
  const skeleton = new Skeleton(`${b.name}-skeleton`, `${b.name}-skeleton`, b.scene);
  const boneOf = new Map<TransformNode, Bone>();
  const local = (n: TransformNode) =>
    Matrix.Compose(n.scaling, n.rotationQuaternion ?? Quaternion.FromEulerAngles(n.rotation.x, n.rotation.y, n.rotation.z), n.position);
  // Parents before children: joints are listed in creation order, which already guarantees that.
  for (const node of joints) {
    const parentBone = node.parent instanceof TransformNode ? (boneOf.get(node.parent) ?? null) : null;
    const bone = new Bone(node.name, skeleton, parentBone, local(node));
    bone.linkTransformNode(node);
    boneOf.set(node, bone);
  }
  root.computeWorldMatrix(true);
  const rootInverse = Matrix.Invert(root.getWorldMatrix());

  const groups = new Map<string, { meshes: Mesh[]; preset: PresetName | null; outline: boolean }>();
  for (const m of b.meshes) {
    const preset = b.presets.get(m) ?? "charVertexColor";
    const parent = m.parent instanceof TransformNode ? m.parent : null;
    const bone = parent ? boneOf.get(parent) : undefined;
    if (!bone) continue;
    // Bake into root space (the bind pose) and tag every vertex with its joint.
    m.computeWorldMatrix(true);
    m.bakeTransformIntoVertices(m.getWorldMatrix().multiply(rootInverse));
    m.parent = null;
    m.position.setAll(0);
    m.rotation.setAll(0);
    m.rotationQuaternion = null;
    m.scaling.setAll(1);
    const count = m.getTotalVertices();
    const color = Color3.FromHexString(PRESETS[preset].base);
    const colors = new Float32Array(count * 4);
    const indices = new Float32Array(count * 4);
    const weights = new Float32Array(count * 4);
    const boneIndex = skeleton.bones.indexOf(bone);
    for (let i = 0; i < count; i++) {
      colors.set([color.r, color.g, color.b, 1], i * 4);
      indices[i * 4] = boneIndex;
      weights[i * 4] = 1;
    }
    m.setVerticesData(VertexBuffer.ColorKind, colors);
    m.setVerticesData(VertexBuffer.MatricesIndicesKind, indices);
    m.setVerticesData(VertexBuffer.MatricesWeightsKind, weights);
    const emissive = EMISSIVE.has(preset);
    const outline = !emissive && presetHasOutline(preset);
    const key = emissive ? `e:${preset}` : outline ? "outlined" : "flat";
    const g = groups.get(key) ?? { meshes: [], preset: emissive ? preset : null, outline };
    g.meshes.push(m);
    groups.set(key, g);
  }

  const out: Mesh[] = [];
  for (const [key, g] of groups) {
    const merged = MeshClass.MergeMeshes(g.meshes, true, true);
    if (!merged) continue;
    merged.name = `${b.name}-${key}`;
    merged.parent = root;
    merged.skeleton = skeleton;
    merged.numBoneInfluencers = 1;
    merged.isPickable = false;
    merged.material = b.materials.get(g.preset ?? (g.outline ? "charVertexColor" : "charVertexColorFlat"));
    if (g.outline) applyOutline(merged);
    out.push(merged);
  }
  return out;
};

interface Pistol {
  readonly hand: TransformNode;
  readonly hip: TransformNode;
  readonly boxes: readonly [TransformNode, TransformNode];
}

/**
 * A pistol twice over: one in the right hand (barrel along the forearm, grip towards the palm
 * side, so it points where the arm aims) and one in a holster on the right hip. Each sits on
 * its own bone; animation shows one and scales the other to zero.
 */
const pistol = (b: RigBuilder, sk: Joints, hipX: number, holster: PresetName, big = 1): Pistol => {
  const s = sk.s;
  const hand = b.node("gunHand", sk.elbowR, 0, -0.29 * s, 0.015);
  const hip = b.node("gunHip", sk.body, hipX, 0.9 * s, 0.025);
  // The boxes sit on their own bones so a mounted weapon model can hide them.
  const boxes = [b.node("gunHandBox", hand), b.node("gunHipBox", hip)] as const;
  for (const n of boxes) {
    b.box(0.034 * big, 0.17 * big, 0.05 * big, "gun", n, 0, -0.07 * big, 0);
    b.box(0.03 * big, 0.045 * big, 0.065 * big, "gun", n, 0, 0.005, -0.04 * big);
  }
  // Grip faces forward in the holster.
  hip.rotation.y = Math.PI;
  b.box(0.05 * big, 0.13 * big, 0.075 * big, holster, sk.body, hipX, 0.86 * s, 0.02);
  return { hand, hip, boxes };
};

const finish = (
  root: TransformNode,
  b: RigBuilder,
  sk: Joints,
  opts: { aiming: boolean; armSpread: number; leftHold?: [number, number]; gun?: Pistol },
): CharacterRig => {
  const { s: _s, ...joints } = sk;
  const order = [joints.body, joints.legL, joints.kneeL, joints.legR, joints.kneeR, joints.head, joints.armL, joints.elbowL, joints.armR, joints.elbowR];
  if (opts.gun) order.push(opts.gun.hand, opts.gun.hip, ...opts.gun.boxes);
  const meshes = skinCharacter(b, root, order);
  // After skinning: a zero scale in the bind pose would make the bind matrix singular.
  opts.gun?.hip.scaling.setAll(0);
  return {
    root,
    meshes,
    gunHand: opts.gun?.hand ?? null,
    gunHip: opts.gun?.hip ?? null,
    gunBoxes: opts.gun?.boxes ?? [],
    drawn: 1,
    drawTarget: true,
    aim: 0,
    aimHold: 0,
    reload: 0,
    reloadTotal: 0,
    melee: false,
    swing: null,
    guard: 0,
    stagger: 0,
    staggerTotal: 0,
    aiming: opts.aiming,
    armSpread: opts.armSpread,
    leftHold: opts.leftHold ?? null,
    phase: 0,
    stoop: 0,
    time: 0,
    flinch: 0,
    dying: null,
    lastAir: null,
    airBlend: 0,
    landing: 0,
    climbBlend: 0,
    climbPhase: 0,
    ...joints,
  };
};

/** Rotation that turns a lathe arc (or its opening) to face +Z. */
const arcFacingForward = (arc: number, opening: boolean): number => {
  const centre = opening ? (1 + arc) * Math.PI : arc * Math.PI;
  return centre - Math.PI / 2;
};

/** Seki: black wavy bob, black tank top, grey high-waisted trousers, cybernetic arms. */
export const buildHeroine = (scene: Scene, materials: ToonMaterials, name: string): CharacterRig => {
  const root = new TransformNode(name, scene);
  const b = new RigBuilder(scene, materials, name);
  const sk = humanoid(
    b,
    root,
    { height: 1.74, shoulder: 0.165, hip: 0.15, chest: 0.135, waist: 0.1, limb: 1, female: true },
    { skin: "skin", top: "sekiTop", bottom: "sekiPants", shoes: "sekiShoes", arms: "cyber" },
  );
  const s = sk.s;
  // Bob: a shell open at the face, then pointed locks around the hairline (sides and back)
  // and a few heavy bangs across the forehead. Pointed cones give the hand-drawn silhouette.
  const bob = b.lathe(
    [
      [0.001, 0.13],
      [0.06, 0.125],
      [0.092, 0.08],
      [0.098, 0.02],
      [0.1, -0.03],
      [0.098, -0.06],
    ].map(([r, y]) => [(r as number) * s, (y as number) * s] as const),
    "sekiHair",
    sk.head,
    { arc: 0.62, depth: 1.02, tessellation: 22 },
  );
  // A lathe arc covers angles [0, arc·2π] from +X towards +Z, and rotation.y by θ moves an
  // angle φ to φ − θ. The opening is centred at (1 + arc)·π; turn it to face forward (+Z, 90°).
  bob.rotation.y = arcFacingForward(0.62, true);
  const lockCount = 11;
  for (let i = 0; i < lockCount; i++) {
    // Angle measured from the face (+Z); locks cover 75°..285°, i.e. sides and back only.
    const fromFront = ((75 + (i / (lockCount - 1)) * 210) * Math.PI) / 180;
    const dx = Math.sin(fromFront);
    const dz = Math.cos(fromFront);
    const len = (0.1 + ((i * 37) % 5) * 0.012) * s;
    const lock = b.cylinder(len, 0, 0.055 * s, "sekiHair", sk.head, dx * 0.088 * s, -0.06 * s - len / 2 + 0.02 * s, dz * 0.09 * s);
    // Tip points down and slightly outwards; alternate a little twist so the edge reads uneven.
    lock.rotation.set(-dz * 0.25, 0, dx * 0.25 + (i % 2 ? 0.08 : -0.08));
  }
  for (const [x, len, tilt] of [
    [-0.045, 0.06, 0.25],
    [-0.012, 0.07, 0.05],
    [0.025, 0.065, -0.2],
    [0.055, 0.05, -0.4],
  ] as const) {
    // Tips stop at the brows (y ≈ 0.045) so the eyes stay visible.
    const bang = b.cylinder(len * s, 0, 0.05 * s, "sekiHair", sk.head, x * s, (0.11 - len / 2) * s, 0.068 * s);
    bang.rotation.set(-0.3, 0, tilt);
  }
  // Optic line: the cybernetic eye glint.
  b.box(0.012, 0.012, 0.012, "heroineVisor", sk.head, 0.032 * s, 0.014 * s, 0.07 * s);
  const gun = pistol(b, sk, 0.165 * s, "cyberDark");
  return finish(root, b, sk, { aiming: true, armSpread: 0.07, gun });
};

export const buildFixer = (scene: Scene, materials: ToonMaterials, name: string): CharacterRig => {
  const root = new TransformNode(name, scene);
  const b = new RigBuilder(scene, materials, name);
  const sk = humanoid(
    b,
    root,
    { height: 1.88, shoulder: 0.23, hip: 0.17, chest: 0.19, waist: 0.17, limb: 1.25, female: false },
    { skin: "fixerSkin", top: "fixerJacket", bottom: "fixerPants", shoes: "shades", arms: "fixerJacket", face: false },
  );
  b.box(0.15, 0.035, 0.03, "shades", sk.head, 0, 0.015 * sk.s, 0.068 * sk.s);
  b.box(0.03, 0.006, 0.006, "lips", sk.head, 0, -0.045 * sk.s, 0.066 * sk.s);
  const chain = b.torus(0.26, 0.018, "gold", sk.body, 0, 1.44 * sk.s, 0.05);
  chain.rotation.x = 1.25;
  return finish(root, b, sk, { aiming: false, armSpread: 0.16 });
};

export const buildGanger = (scene: Scene, materials: ToonMaterials, name: string): CharacterRig => {
  const root = new TransformNode(name, scene);
  const b = new RigBuilder(scene, materials, name);
  const sk = humanoid(
    b,
    root,
    { height: 1.8, shoulder: 0.19, hip: 0.15, chest: 0.16, waist: 0.14, limb: 1.1, female: false },
    { skin: "skin", top: "gangerHood", bottom: "gangerPants", shoes: "gangerPants", arms: "gangerHood", face: false },
  );
  // Hood up, LED mask across the lower face.
  const hood = b.sphere(0.2 * sk.s, "gangerHood", sk.head, 0, 0.015, -0.015, [1, 1.05, 1.08]);
  hood.scaling.z = 1.05;
  b.box(0.13, 0.03, 0.03, "gangerMask", sk.head, 0, -0.02 * sk.s, 0.07 * sk.s);
  const gun = pistol(b, sk, 0.18 * sk.s, "gangerPants", 1.25);
  return finish(root, b, sk, { aiming: true, armSpread: 0.12, gun });
};

/** Babcia Ume: small, long beige coat, grey bun, red umbrella. */
export const buildCivilian = (scene: Scene, materials: ToonMaterials, name: string): CharacterRig => {
  const root = new TransformNode(name, scene);
  const b = new RigBuilder(scene, materials, name);
  const sk = humanoid(
    b,
    root,
    { height: 1.5, shoulder: 0.15, hip: 0.16, chest: 0.15, waist: 0.15, limb: 1.05, female: true },
    { skin: "skin", top: "umeCoat", bottom: "umeCoat", shoes: "sekiShoes", arms: "umeCoat", coat: "umeCoat" },
  );
  b.sphere(0.17 * sk.s, "umeHair", sk.head, 0, 0.03, -0.012, [1, 0.9, 1]);
  b.sphere(0.07, "umeHair", sk.head, 0, 0.1 * sk.s, -0.07 * sk.s);
  // Built in the neutral pose (forearm hanging): the pole runs down the forearm's axis and
  // the canopy sits above the hand once the hold pose raises the arm.
  // The pole continues the forearm past the hand (local -Y), the canopy's apex points the same
  // way. The hold pose bends the elbow up, which turns local -Y skywards.
  const fore = 0.26 * sk.s;
  b.cylinder(0.95, 0.02, 0.02, "pole", sk.elbowL, 0, -fore - 0.42, 0);
  b.cylinder(0.28, 1.15, 0, "umbrella", sk.elbowL, 0, -fore - 0.95, 0);
  const rig = finish(root, b, sk, { aiming: false, armSpread: 0.1, leftHold: [-0.45, -2.35] });
  rig.stoop = rig.body.rotation.x = 0.08;
  return rig;
};

/** Doktor Mori: cream surgical coat, white hair combed back, magnifier goggles. */
export const buildRipperdoc = (scene: Scene, materials: ToonMaterials, name: string): CharacterRig => {
  const root = new TransformNode(name, scene);
  const b = new RigBuilder(scene, materials, name);
  const sk = humanoid(
    b,
    root,
    { height: 1.72, shoulder: 0.18, hip: 0.15, chest: 0.16, waist: 0.15, limb: 1.05, female: false },
    { skin: "fixerSkin", top: "moriCoat", bottom: "fixerPants", shoes: "shades", arms: "moriCoat", coat: "moriCoat", face: false },
  );
  b.lathe(
    [
      [0.001, -0.02],
      [0.07, 0.0],
      [0.08, 0.06],
      [0.06, 0.11],
      [0.001, 0.125],
    ].map(([r, y]) => [(r as number) * sk.s, (y as number) * sk.s] as const),
    "moriHair",
    sk.head,
    { z: -0.012, depth: 1.05 },
  );
  b.box(0.13, 0.03, 0.03, "docGoggles", sk.head, 0, 0.018 * sk.s, 0.07 * sk.s);
  const rig = finish(root, b, sk, { aiming: false, armSpread: 0.12 });
  // Poses go on after skinning: the bind pose must stay neutral.
  rig.stoop = rig.body.rotation.x = 0.1;
  return rig;
};

const DEATH_FALL = 0.65;
const DEATH_LINGER = 5.5;

/** Thigh angle from vertical when fully crouched (negative: knee forward and up). */
export const CROUCH_THIGH = -1.2;
/** Knee bend when fully crouched. */
export const CROUCH_KNEE = 2.0;
/** Forward lean of the body when fully crouched. */
export const CROUCH_LEAN = 0.35;
/** Speeds (m/s) where the walk starts turning into a run and where the run is full. */
const RUN_FROM = 5;
const RUN_FULL = 6.6;
/** Forward lean of the body at a full run (radians). */
const RUN_LEAN = 0.24;

export interface CrouchOffset {
  /** Body drop (negative) and shift along Z that keep the feet planted at the root. */
  readonly y: number;
  readonly z: number;
}

/**
 * Where the body has to go so that, with the hips leaning `lean` forward and the legs at the
 * given thigh angle and knee bend, the feet stay on the ground under the root. Measured from
 * the rig's own segments, so it fits every build.
 */
export const crouchOffset = (rig: CharacterRig, thigh: number, knee: number, lean: number): CrouchOffset => {
  const hip = rig.legL.position.y;
  const thighLen = -rig.kneeL.position.y;
  const shinLen = thighLen * (0.42 / 0.44);
  const shin = thigh + knee;
  // A leg rotated by θ around X points along (y = -cos θ, z = -sin θ).
  const legHeight = thighLen * Math.cos(thigh) + shinLen * Math.cos(shin);
  const footZ = -thighLen * Math.sin(thigh) - shinLen * Math.sin(shin);
  return {
    y: legHeight - (thighLen + shinLen) - hip * (Math.cos(lean) - 1),
    z: -(hip * Math.sin(lean) + footZ),
  };
};

/** Slight knee bend of the standing pose. */
const KNEE_REST = 0.04;

/** Crouch offset relative to the standing pose (which already has the rest knee bend). */
const crouchDelta = (rig: CharacterRig, thigh: number, knee: number, lean: number): CrouchOffset => {
  const rest = crouchOffset(rig, 0, KNEE_REST, 0);
  const pose = crouchOffset(rig, thigh, knee + KNEE_REST, lean);
  return { y: pose.y - rest.y, z: pose.z - rest.z };
};

/** Aim and guard from the simulation (`Transform.aim`, `Transform.guard`), 0..1. */
export interface RigCombat {
  readonly aim?: number;
  readonly guard?: number;
}

/** Jumps, falls and ladders from the simulation (`Transform.air`, `Transform.climb`, ADR-0021). */
export interface RigMotion {
  /** Vertical speed while airborne, m/s; absent on the ground. */
  readonly air?: number;
  /** Climbing speed on a ladder, m/s; absent off it. */
  readonly climb?: number;
}

/** Take-off speed the jump pose is scaled to (the simulation's JUMP_SPEED). */
const AIR_REF = 7;
/** Blend speeds of the jump and ladder poses, per second. */
const AIR_BLEND_IN = 14;
const AIR_BLEND_OUT = 10;
const CLIMB_BLEND = 8;
/** How long a landing dip lasts (1 / rate), and how deep it goes at full strength (as a crouch amount). */
const LANDING_RECOVER = 3.2;
export const LANDING_DIP = 0.6;
/** A drop landing at this speed (m/s) gives the full dip. */
const LANDING_FULL = 14;

/** Thigh and knee of the jump pose: tucked on the way up, reaching for the ground on the way down. */
export const jumpLegs = (air: number): { thigh: number; knee: number } => {
  const up = Math.max(0, Math.min(1, air / AIR_REF));
  const down = Math.max(0, Math.min(1, -air / AIR_REF));
  return { thigh: -0.75 * up - 0.3 * down, knee: 1.25 * up + 0.35 * down + 0.2 };
};

/** Hand over hand, foot over foot: the ladder pose at phase `p`. */
const climbPose = (rig: CharacterRig, w: number): void => {
  const s = Math.sin(rig.climbPhase);
  const mix = (from: number, to: number) => from + (to - from) * w;
  rig.armL.rotation.x = mix(rig.armL.rotation.x, -2.5 + 0.4 * s);
  rig.armR.rotation.x = mix(rig.armR.rotation.x, -2.5 - 0.4 * s);
  rig.armL.rotation.z = mix(rig.armL.rotation.z, 0.12);
  rig.armR.rotation.z = mix(rig.armR.rotation.z, -0.12);
  rig.elbowL.rotation.x = mix(rig.elbowL.rotation.x, -0.55 - 0.35 * Math.max(0, -s));
  rig.elbowR.rotation.x = mix(rig.elbowR.rotation.x, -0.55 - 0.35 * Math.max(0, s));
  rig.legL.rotation.x = mix(rig.legL.rotation.x, -0.55 - 0.5 * Math.max(0, s));
  rig.legR.rotation.x = mix(rig.legR.rotation.x, -0.55 - 0.5 * Math.max(0, -s));
  rig.kneeL.rotation.x = mix(rig.kneeL.rotation.x, 0.9 + 0.7 * Math.max(0, s));
  rig.kneeR.rotation.x = mix(rig.kneeR.rotation.x, 0.9 + 0.7 * Math.max(0, -s));
};

/**
 * Procedural animation: walk cycle with knees and elbows, crouch, idle breathing, hit flinch,
 * death fall. `crouch` is 0 standing .. 1 fully down (already eased by the simulation): hips
 * and knees bend, the body drops and leans in with the feet planted, the head and arms keep
 * looking and aiming forward. `combat` holds the weapon up while aiming (ADR-0019) and raises
 * a melee guard; melee swings and staggers come from `startSwing` and `startStagger`.
 */
export const animateRig = (rig: CharacterRig, speed: number, dt: number, crouch = 0, combat: RigCombat = {}, motion: RigMotion = {}): void => {
  rig.time += dt;
  if (rig.dying !== null) {
    rig.dying += dt;
    const t = Math.min(1, rig.dying / DEATH_FALL);
    const ease = t * t * (3 - 2 * t);
    // Knees give, then the body drops backwards onto the street.
    rig.kneeL.rotation.x = rig.kneeR.rotation.x = 1.1 * ease;
    rig.legL.rotation.x = rig.legR.rotation.x = -0.5 * ease;
    rig.root.rotation.x = -1.45 * ease * ease;
    rig.armL.rotation.z = 0.9 * ease;
    rig.armR.rotation.z = -0.9 * ease;
    rig.armR.rotation.x = -0.4 * (1 - ease) - 0.2 * ease;
    // After lying still for a while the body sinks out of view.
    const sink = Math.max(0, rig.dying - DEATH_FALL - DEATH_LINGER);
    rig.root.position.y = 0.12 * ease - sink * 0.5;
    return;
  }
  // Airborne and on ladders (ADR-0021): the walk cycle gives way to the jump or ladder pose; a
  // landing dips the knees like a short crouch, deeper after a long drop.
  const air = motion.air;
  const climbing = motion.climb !== undefined;
  if (air === undefined && rig.lastAir !== null && !climbing) rig.landing = Math.min(1, 0.3 + Math.max(0, -rig.lastAir) / LANDING_FULL);
  rig.lastAir = climbing ? null : (air ?? null);
  rig.landing = Math.max(0, rig.landing - dt * LANDING_RECOVER);
  const airTarget = air !== undefined && !climbing ? 1 : 0;
  rig.airBlend += (airTarget - rig.airBlend) * Math.min(1, dt * (airTarget > rig.airBlend ? AIR_BLEND_IN : AIR_BLEND_OUT));
  rig.climbBlend += ((climbing ? 1 : 0) - rig.climbBlend) * Math.min(1, dt * CLIMB_BLEND);
  if (climbing) rig.climbPhase += dt * Math.abs(motion.climb ?? 0) * 3.4;
  const still = Math.max(rig.airBlend, rig.climbBlend);
  speed *= 1 - still;
  const c = smooth(Math.min(1, Math.max(0, Math.max(crouch, rig.landing * LANDING_DIP))));
  // 0 walking .. 1 sprinting: longer stride, forward lean, pumping arms, a flight phase.
  const run = smooth(Math.min(1, Math.max(0, (speed - RUN_FROM) / (RUN_FULL - RUN_FROM)))) * (1 - c);
  const lean = CROUCH_LEAN * c + RUN_LEAN * run;
  const thigh = CROUCH_THIGH * c;
  const knee = CROUCH_KNEE * c;
  const amount = Math.min(1, speed / 4.2);
  rig.phase += dt * (4 + speed * 1.9) * (amount > 0.05 ? 1 : 0);
  // Short, careful steps while crouched.
  const swing = Math.sin(rig.phase) * (0.7 + 0.32 * run) * amount * (1 - 0.55 * c);
  // Leg angles are relative to the leaning body: take the lean back out.
  rig.legL.rotation.x = swing + thigh - lean;
  rig.legR.rotation.x = -swing + thigh - lean;
  // Knees bend on the back swing.
  // Knees bend on the back swing; at a run the heel kicks up high and the front knee stays soft.
  const kick = 1.3 + 1.1 * run;
  rig.kneeL.rotation.x = Math.max(0, -swing) * kick + Math.max(0, swing) * 0.45 * run + KNEE_REST + knee;
  rig.kneeR.rotation.x = Math.max(0, swing) * kick + Math.max(0, -swing) * 0.45 * run + KNEE_REST + knee;
  if (rig.leftHold) {
    rig.armL.rotation.x = rig.leftHold[0];
    rig.elbowL.rotation.x = rig.leftHold[1];
  } else {
    // Walking arms swing loose; running arms pump, bent at the elbow.
    rig.armL.rotation.x = -swing * (0.6 + 0.5 * run);
    rig.elbowL.rotation.x = -0.18 - Math.max(0, swing) * 0.4 * (1 - run) - 1.25 * run;
  }
  rig.armL.rotation.z = rig.armSpread;
  if (rig.aiming && rig.melee) poseMeleeArms(rig, swing, dt, run, combat.guard ?? 0);
  else if (rig.aiming) poseWeaponArms(rig, swing, amount, dt, run, combat.aim ?? 0);
  else {
    rig.armR.rotation.x = swing * (0.6 + 0.5 * run);
    rig.armR.rotation.z = -rig.armSpread;
    rig.elbowR.rotation.x = -0.18 - Math.max(0, -swing) * 0.4 * (1 - run) - 1.25 * run;
  }
  // Arms hang and aim in world terms, so the lean is taken out of them too.
  rig.armL.rotation.x -= lean;
  rig.armR.rotation.x -= lean;
  if (rig.airBlend > 0.001) {
    // One knee leads: the jump reads as a step into the air, not a hop on both feet.
    const legs = jumpLegs(air ?? rig.lastAir ?? 0);
    const w = rig.airBlend;
    rig.legL.rotation.x += w * legs.thigh;
    rig.legR.rotation.x += w * legs.thigh * 0.55;
    rig.kneeL.rotation.x += w * legs.knee;
    rig.kneeR.rotation.x += w * legs.knee * 0.7;
    // Arms out for balance; a weapon arm stays where it aims.
    rig.armL.rotation.x -= w * 0.45;
    rig.armL.rotation.z += w * 0.35;
    if (!rig.aiming) {
      rig.armR.rotation.x -= w * 0.45;
      rig.armR.rotation.z -= w * 0.35;
    }
  }
  if (rig.climbBlend > 0.001) climbPose(rig, rig.climbBlend);
  const offset = c > 0 ? crouchDelta(rig, thigh, knee, lean) : { y: 0, z: 0 };
  const breathe = Math.sin(rig.time * 1.7) * 0.006;
  // Bob: a soft dip at a walk, a push-off and flight at a run.
  const bob = Math.abs(Math.cos(rig.phase)) * (0.04 + 0.05 * run) * amount * (1 - 0.5 * c) - 0.03 * run;
  rig.body.position.y = bob + breathe + offset.y;
  rig.body.position.z = offset.z;
  rig.body.rotation.x = rig.stoop + lean;
  rig.flinch = Math.max(0, rig.flinch - dt * 5);
  rig.body.rotation.z = Math.sin(rig.time * 30) * 0.05 * rig.flinch;
  // The head keeps looking ahead over the lean.
  rig.head.rotation.x = -0.25 * rig.flinch - lean * 0.8;
  rig.body.rotation.y = 0;
  if (rig.aiming && rig.melee) applySwingBody(rig);
  applyStagger(rig, dt);
};

/** Seconds to draw or holster the pistol (matches the simulation's DRAW_TIME). */
export const DRAW_SECONDS = 0.4;
/** Seconds the weapon stays up after a shot before dropping back to low ready. */
const AIM_HOLD = 1.4;

interface ArmPose {
  armX: number;
  armZ: number;
  elbowX: number;
}

const mixPose = (a: ArmPose, b: ArmPose, t: number): ArmPose => ({
  armX: a.armX + (b.armX - a.armX) * t,
  armZ: a.armZ + (b.armZ - a.armZ) * t,
  elbowX: a.elbowX + (b.elbowX - a.elbowX) * t,
});

const smooth = (t: number): number => t * t * (3 - 2 * t);

/**
 * Right arm of an armed character. Holstered it swings like anyone's; drawn it carries the
 * pistol at low ready (muzzle down and forward, the arm loose and swaying with the walk) and
 * comes up to aim after a shot, the left hand joining to support it. Drawing reaches for the
 * hip, then brings the pistol up; holstering plays the same backwards. The pistol swaps from
 * holster to hand at the middle of the move.
 */
const poseWeaponArms = (rig: CharacterRig, swing: number, amount: number, dt: number, run = 0, aiming = 0): void => {
  const target = rig.drawTarget ? 1 : 0;
  rig.drawn += Math.sign(target - rig.drawn) * Math.min(Math.abs(target - rig.drawn), dt / DRAW_SECONDS);
  rig.aimHold = Math.max(0, rig.aimHold - dt);
  const aimTarget = rig.aimHold > 0 && rig.drawTarget ? 1 : 0;
  // Snap up to aim, ease back down.
  rig.aim += (aimTarget - rig.aim) * Math.min(1, dt * (aimTarget > rig.aim ? 14 : 3));
  // Aiming down sights (or an NPC in a fight) holds the weapon up as long as it lasts.
  if (rig.drawTarget) rig.aim = Math.max(rig.aim, Math.min(1, Math.max(0, aiming)));

  const sway = Math.cos(rig.phase) * amount;
  const free: ArmPose = { armX: swing * (0.6 + 0.5 * run), armZ: -rig.armSpread, elbowX: -0.18 - Math.max(0, -swing) * 0.4 * (1 - run) - 1.25 * run };
  const reach: ArmPose = { armX: 0.12, armZ: -0.32, elbowX: -0.55 };
  // At a run the pistol is carried close to the chest, muzzle down, still moving with the stride.
  const lowReady: ArmPose = { armX: -0.32 + swing * (0.22 + 0.12 * run) - 0.1 * run, armZ: -0.06 - 0.12 * run, elbowX: -0.62 + sway * 0.12 - 0.55 * run };
  const aimed: ArmPose = { armX: -1.42 + Math.abs(sway) * 0.05, armZ: 0, elbowX: -0.05 };
  // Reloading: pistol down to the chest, tipped in, while the left hand fetches a magazine.
  rig.reload = Math.max(0, rig.reload - dt);
  const reloading = rig.reloadTotal > 0 && rig.reload > 0 ? Math.sin(Math.PI * (1 - rig.reload / rig.reloadTotal)) : 0;
  if (reloading > 0) rig.aim *= 1 - reloading;
  const chest: ArmPose = { armX: -0.55, armZ: -0.18, elbowX: -1.35 };
  const ready = mixPose(mixPose(lowReady, aimed, smooth(rig.aim)), chest, reloading);
  const d = rig.drawn;
  const pose = d < 0.5 ? mixPose(free, reach, smooth(d / 0.5)) : mixPose(reach, ready, smooth((d - 0.5) / 0.5));
  rig.armR.rotation.x = pose.armX;
  rig.armR.rotation.z = pose.armZ;
  rig.elbowR.rotation.x = pose.elbowX;
  rig.gunHand?.scaling.setAll(d >= 0.5 ? 1 : 0);
  rig.gunHip?.scaling.setAll(d >= 0.5 ? 0 : 1);

  if (reloading > 0 && !rig.leftHold) {
    rig.armL.rotation.x += (-1.05 - rig.armL.rotation.x) * reloading;
    rig.armL.rotation.z += (0.5 - rig.armL.rotation.z) * reloading;
    rig.elbowL.rotation.x += (-1.5 - rig.elbowL.rotation.x) * reloading;
    return;
  }
  // Support hand under the pistol while aiming.
  const support = smooth(rig.aim) * (d >= 0.5 ? 1 : 0);
  if (support > 0 && !rig.leftHold) {
    rig.armL.rotation.x += (-1.3 - rig.armL.rotation.x) * support;
    rig.armL.rotation.z += (0.42 - rig.armL.rotation.z) * support;
    rig.elbowL.rotation.x += (-0.42 - rig.elbowL.rotation.x) * support;
  }
};

/** Seconds from the end of the windup to the end of the follow-through. */
export const SWING_STRIKE = 0.09;

/**
 * Where a swing is at `elapsed` seconds: `cock` takes the arm from ready to the wound-up pose
 * over the windup, `through` carries it on to the follow-through in SWING_STRIKE, and both
 * fall back to 0 over the rest of the recovery. 0/0 is the ready pose.
 */
export const swingPhase = (elapsed: number, windup: number, recovery: number): { cock: number; through: number } => {
  if (elapsed < windup) return { cock: smooth(elapsed / Math.max(1e-3, windup)), through: 0 };
  const strike = elapsed - windup;
  if (strike < SWING_STRIKE) return { cock: 1, through: smooth(strike / SWING_STRIKE) };
  const back = 1 - smooth(Math.min(1, (strike - SWING_STRIKE) / Math.max(1e-3, recovery - SWING_STRIKE)));
  return { cock: back, through: back };
};

interface SwingPose extends ArmPose {
  /** Turn of the body around Y (positive to the right). */
  twist: number;
  /** Extra forward lean of the body. */
  bend: number;
}

/** Wound-up and follow-through poses of the right arm per strike of a combo. */
const SWING_POSES: readonly { readonly cocked: SwingPose; readonly through: SwingPose }[] = [
  // Forehand, right to left at chest height.
  { cocked: { armX: -1.35, armZ: -1.15, elbowX: -0.7, twist: 0.45, bend: 0 }, through: { armX: -1.2, armZ: 0.75, elbowX: -0.2, twist: -0.4, bend: 0.06 } },
  // Backhand, left to right.
  { cocked: { armX: -1.25, armZ: 0.85, elbowX: -1.45, twist: -0.4, bend: 0 }, through: { armX: -1.3, armZ: -1.2, elbowX: -0.15, twist: 0.45, bend: 0.06 } },
  // Overhead finisher, straight down.
  { cocked: { armX: -2.85, armZ: -0.25, elbowX: -0.95, twist: 0.1, bend: -0.12 }, through: { armX: -0.55, armZ: 0.05, elbowX: -0.1, twist: -0.05, bend: 0.22 } },
];

/** Melee weapon held low and forward, the tip up: the stance between swings. */
const MELEE_READY: SwingPose = { armX: -0.62, armZ: -0.14, elbowX: -0.95, twist: 0, bend: 0 };
/** Guard: the forearm (and the weapon along it) across the face, the left hand bracing it. */
const MELEE_GUARD: SwingPose = { armX: -1.55, armZ: 0.55, elbowX: -1.35, twist: -0.12, bend: 0 };

/** The current swing pose of a melee rig, from the ready (or guard) stance. */
export const meleePose = (rig: CharacterRig): SwingPose => {
  const base = mixSwing(MELEE_READY, MELEE_GUARD, smooth(rig.guard));
  const sw = rig.swing;
  if (!sw) return base;
  const poses = SWING_POSES[((sw.strike % SWING_POSES.length) + SWING_POSES.length) % SWING_POSES.length] ?? SWING_POSES[0]!;
  const { cock, through } = swingPhase(sw.elapsed, sw.windup, sw.recovery);
  const cocked = mixSwing(base, poses.cocked, cock);
  return mixSwing(cocked, poses.through, through);
};

const mixSwing = (a: SwingPose, b: SwingPose, t: number): SwingPose => ({ ...mixPose(a, b, t), twist: a.twist + (b.twist - a.twist) * t, bend: a.bend + (b.bend - a.bend) * t });

/**
 * Right arm of a character with a melee weapon: drawn it holds the weapon at the ready, swings
 * through the combo's poses and raises the guard; holstered it swings free like the pistol arm.
 */
const poseMeleeArms = (rig: CharacterRig, swing: number, dt: number, run: number, guard: number): void => {
  const target = rig.drawTarget ? 1 : 0;
  rig.drawn += Math.sign(target - rig.drawn) * Math.min(Math.abs(target - rig.drawn), dt / DRAW_SECONDS);
  rig.aim = 0;
  const wantGuard = guard > 0.5 && rig.drawTarget && !rig.swing ? 1 : 0;
  rig.guard += (wantGuard - rig.guard) * Math.min(1, dt * (wantGuard > rig.guard ? 16 : 8));
  if (rig.swing) {
    rig.swing.elapsed += dt;
    if (rig.swing.elapsed >= rig.swing.windup + Math.max(SWING_STRIKE, rig.swing.recovery)) rig.swing = null;
  }
  const free: ArmPose = { armX: swing * (0.6 + 0.5 * run), armZ: -rig.armSpread, elbowX: -0.18 - Math.max(0, -swing) * 0.4 * (1 - run) - 1.25 * run };
  const pose = meleePose(rig);
  // The weapon still moves a little with the stride.
  const held: ArmPose = { armX: pose.armX + swing * 0.12 * (1 - rig.guard), armZ: pose.armZ, elbowX: pose.elbowX };
  const out = mixPose(free, held, smooth(rig.drawn));
  rig.armR.rotation.x = out.armX;
  rig.armR.rotation.z = out.armZ;
  rig.elbowR.rotation.x = out.elbowX;
  rig.gunHand?.scaling.setAll(rig.drawn >= 0.5 ? 1 : 0);
  rig.gunHip?.scaling.setAll(rig.drawn >= 0.5 ? 0 : 1);
  // The left hand braces the guard and swings out for balance on a blow.
  if (!rig.leftHold) {
    const g = smooth(rig.guard) * (rig.drawn >= 0.5 ? 1 : 0);
    rig.armL.rotation.x += (-1.35 - rig.armL.rotation.x) * g;
    rig.armL.rotation.z += (-0.45 - rig.armL.rotation.z) * g;
    rig.elbowL.rotation.x += (-1.25 - rig.elbowL.rotation.x) * g;
    const blow = rig.swing ? swingPhase(rig.swing.elapsed, rig.swing.windup, rig.swing.recovery).cock : 0;
    rig.armL.rotation.z += 0.35 * blow * (1 - g);
  }
};

/** Body turn and lean of the swing in progress, after the walk and crouch set the body. */
const applySwingBody = (rig: CharacterRig): void => {
  if (rig.drawn < 0.5) return;
  const pose = meleePose(rig);
  rig.body.rotation.y = pose.twist;
  rig.body.rotation.x += pose.bend;
};

/** Knocked off balance: the body rocks back, the head snaps, the arms fly out, then it recovers. */
const applyStagger = (rig: CharacterRig, dt: number): void => {
  if (rig.stagger <= 0) return;
  rig.stagger = Math.max(0, rig.stagger - dt);
  const t = 1 - rig.stagger / Math.max(1e-3, rig.staggerTotal);
  // Quick to hit, slow to recover.
  const k = t < 0.15 ? smooth(t / 0.15) : 1 - smooth((t - 0.15) / 0.85);
  rig.body.rotation.x -= 0.32 * k;
  rig.body.rotation.z += 0.12 * k * Math.sin(rig.time * 9);
  rig.head.rotation.x -= 0.35 * k;
  rig.armR.rotation.z -= 0.5 * k;
  rig.armL.rotation.z += 0.5 * k;
  rig.armR.rotation.x += 0.4 * k;
  rig.armL.rotation.x += 0.3 * k;
};

/** Plays a melee swing (strike `strike` of the combo) over the simulation's windup and recovery. */
export const startSwing = (rig: CharacterRig, strike: number, windup: number, recovery: number): void => {
  rig.swing = { strike, windup: Math.max(0, windup), recovery: Math.max(0, recovery), elapsed: 0 };
  rig.guard = 0;
};

/** Plays a stagger for `seconds`; it also cuts a swing short. */
export const startStagger = (rig: CharacterRig, seconds: number): void => {
  rig.stagger = rig.staggerTotal = Math.max(0.1, seconds);
  rig.swing = null;
};

/** Holsters or draws the pistol (animated). */
export const setWeaponDrawn = (rig: CharacterRig, drawn: boolean): void => {
  rig.drawTarget = drawn;
};

/** Plays the reload for `seconds`. */
export const startReload = (rig: CharacterRig, seconds: number): void => {
  rig.reload = rig.reloadTotal = Math.max(0.1, seconds);
};

/** Brings the weapon up to aim for a moment, e.g. on a shot. */
export const raiseWeapon = (rig: CharacterRig): void => {
  rig.aimHold = AIM_HOLD;
};

/** Starts the death fall; the renderer disposes the rig when `deathFinished` says so. */
export const startDeath = (rig: CharacterRig): void => {
  if (rig.dying === null) rig.dying = 0;
};

export const deathFinished = (rig: CharacterRig): boolean => rig.dying !== null && rig.dying > DEATH_FALL + DEATH_LINGER + 1.2;
