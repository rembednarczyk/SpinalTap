import { Matrix, Quaternion, TransformNode, Vector3 } from "../babylon";
import type { CharacterRig } from "./characters";
import { FingerCurl } from "./finger-curl";
import type { ArmReach } from "./two-hand-grip";

const IDENTITY = Matrix.Identity();

/** Humanoid bones driven by the procedural rig. Upper limbs come before their lower limbs. */
const DRIVEN = ["head", "upperLegL", "lowerLegL", "upperLegR", "lowerLegR", "upperArmL", "lowerArmL", "upperArmR", "lowerArmR"] as const;
type Driven = (typeof DRIVEN)[number];

/** Normalised bone names of VRoid/VRM, Mixamo and Blender (Rigify-like) exports. */
const ALIASES: Record<Driven, readonly string[]> = {
  head: ["head", "chead"],
  upperLegL: ["lupperleg", "leftupleg", "leftupperleg", "thighl", "lthigh", "upperlegl"],
  lowerLegL: ["llowerleg", "leftleg", "leftlowerleg", "shinl", "calfl", "lcalf", "lowerlegl"],
  upperLegR: ["rupperleg", "rightupleg", "rightupperleg", "thighr", "rthigh", "upperlegr"],
  lowerLegR: ["rlowerleg", "rightleg", "rightlowerleg", "shinr", "calfr", "rcalf", "lowerlegr"],
  upperArmL: ["lupperarm", "leftarm", "leftupperarm", "upperarml"],
  lowerArmL: ["llowerarm", "leftforearm", "leftlowerarm", "forearml", "lowerarml"],
  upperArmR: ["rupperarm", "rightarm", "rightupperarm", "upperarmr"],
  lowerArmR: ["rlowerarm", "rightforearm", "rightlowerarm", "forearmr", "lowerarmr"],
};

const HAND = { L: ["lhand", "lefthand", "handl"], R: ["rhand", "righthand", "handr"] } as const;
/** The right middle finger's knuckle under the hand: where the palm ends. */
const RIGHT_MIDDLE_KNUCKLE = ["rmiddle1", "righthandmiddle1"];

/** Upper torso bones, best first: garment add-ons on the chest hang from the first one found. */
const CHEST = ["cupperchest", "upperchest", "spine2", "cchest", "chest", "spine1"];

/** Bones that carry garment add-ons (ADR-0015 E7): the head and the upper chest. */
export type AnchorBone = "head" | "chest";

/** Strips the instance prefix, exporter prefixes and separators: "e3-J_Bip_L_UpperLeg" -> "lupperleg". */
export const normaliseBoneName = (name: string, prefix = ""): string =>
  (name.startsWith(prefix) ? name.slice(prefix.length) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/^(jbip|mixamorig\d*|def|bip0?1|armature)/, "");

export const findHumanoidBones = (nodes: readonly TransformNode[], prefix = ""): Partial<Record<Driven, TransformNode>> => {
  const out: Partial<Record<Driven, TransformNode>> = {};
  for (const node of nodes) {
    const n = normaliseBoneName(node.name, prefix);
    for (const key of DRIVEN) if (!out[key] && ALIASES[key].includes(n)) out[key] = node;
  }
  return out;
};

/** Rig joint (relative to the rig body) that drives each bone. */
const jointsOf = (rig: CharacterRig): Record<Driven, TransformNode[]> => ({
  head: [rig.head],
  upperLegL: [rig.legL],
  lowerLegL: [rig.legL, rig.kneeL],
  upperLegR: [rig.legR],
  lowerLegR: [rig.legR, rig.kneeR],
  upperArmL: [rig.armL],
  lowerArmL: [rig.armL, rig.elbowL],
  upperArmR: [rig.armR],
  lowerArmR: [rig.armR, rig.elbowR],
});

const localRotation = (node: TransformNode, out: Matrix): Matrix => {
  const q = node.rotationQuaternion ?? Quaternion.FromEulerAngles(node.rotation.x, node.rotation.y, node.rotation.z);
  Matrix.FromQuaternionToRef(q, out);
  return out;
};

interface DrivenBone {
  readonly node: TransformNode;
  readonly joints: TransformNode[];
  /** Bind rotation in model (glTF) space, already turned from T/A-pose to arms and legs down. */
  readonly rest: Matrix;
}

/**
 * Poses an imported humanoid from the procedural rig: every frame the rotation of each rig
 * joint (walk, aim, flinch, death fall) is moved into model space and applied on top of the
 * bone's bind rotation. Works on the model's own bone frames, so VRoid, Mixamo and Blender
 * skeletons need no per-model setup. The model is parented to the rig body.
 */
export class HumanoidRetarget {
  private readonly bones: DrivenBone[] = [];
  /** Model space -> body space (rotation, possibly mirrored by the glTF handedness flip). */
  private readonly toBody = new Matrix();
  private readonly memo = new Map<TransformNode, Matrix>();
  private readonly held: { node: TransformNode; hand: TransformNode; joints: TransformNode[]; offset: Vector3 }[] = [];
  private rightHand: TransformNode | null = null;
  private rightForearm: TransformNode[] = [];
  private readonly fingers: { side: 0 | 1; curl: FingerCurl }[] = [];
  private armReach: ArmReach | null = null;
  /** Head and chest bones with their model-space rotation at rest (rig joint at identity). */
  private readonly anchors = new Map<AnchorBone, { bone: TransformNode; rest: Matrix }>();
  /** Height of the head bone over the rig body's origin (the feet), in metres. */
  private headY = 0;

  private constructor(
    private readonly root: TransformNode,
    private readonly rig: CharacterRig,
  ) {}

  /** Returns null when the model has no recognisable legs and arms. */
  static create(rig: CharacterRig, root: TransformNode, prefix = ""): HumanoidRetarget | null {
    const found = findHumanoidBones(root.getDescendants(false).filter((n): n is TransformNode => "rotation" in n), prefix);
    if (!DRIVEN.every((k) => found[k])) return null;
    const self = new HumanoidRetarget(root, rig);
    const handOf = (side: "L" | "R") =>
      found[`lowerArm${side}`]!.getChildren((n): n is TransformNode => (HAND[side] as readonly string[]).includes(normaliseBoneName(n.name, prefix)), true)[0] ?? null;
    const hands = { L: handOf("L"), R: handOf("R") };
    self.rightHand = hands.R;
    self.rightForearm = [rig.armR, rig.elbowR, rig.wristR];
    root.parent = rig.body;
    root.position.setAll(0);
    self.updateFrame();
    // Rig convention: the character faces +Z, its left side is -X. Turn models that face the other way (VRM 0.x).
    if (self.bodyPosition(found.upperLegL!).x > self.bodyPosition(found.upperLegR!).x) {
      if (root.rotationQuaternion) root.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), Math.PI).multiply(root.rotationQuaternion);
      else root.rotation.y += Math.PI;
      self.updateFrame();
    }
    const down = Vector3.TransformNormal(new Vector3(0, -1, 0), self.toBody.transpose()).normalize();
    const joints = jointsOf(rig);
    const restOf = new Map<Driven, Matrix>();
    for (const key of DRIVEN) {
      const node = found[key]!;
      const bind = self.modelRotation(node).clone();
      let rest: Matrix;
      if (key.startsWith("upper")) {
        // Turn the limb so it points down like the procedural rig's bind pose.
        const child = found[key.replace("upper", "lower") as Driven]!;
        const dir = Vector3.TransformNormal(child.position, bind).normalize();
        const turn = new Quaternion();
        Quaternion.FromUnitVectorsToRef(dir, down, turn);
        rest = bind.multiply(Matrix.FromQuaternionToRef(turn, new Matrix()));
      } else if (key.startsWith("lower")) {
        // The lower limb keeps its bind rotation relative to the upper one.
        const upper = found[key.replace("lower", "upper") as Driven]!;
        const upperBind = self.modelRotation(upper);
        rest = bind.multiply(upperBind.transpose()).multiply(restOf.get(key.replace("lower", "upper") as Driven)!);
      } else {
        rest = bind;
      }
      restOf.set(key, rest);
      self.bones.push({ node, joints: joints[key], rest });
    }
    // Hands turn at the rig's wrists (a long gun's grip, G-282) and keep their bind turn against the forearm.
    for (const side of ["L", "R"] as const) {
      const hand = hands[side];
      if (!hand) continue;
      const lower = found[`lowerArm${side}`]!;
      const rest = self.modelRotation(hand).multiply(self.modelRotation(lower).transpose()).multiply(restOf.get(`lowerArm${side}`)!);
      const wrist = side === "L" ? [rig.armL, rig.elbowL, rig.wristL] : [rig.armR, rig.elbowR, rig.wristR];
      self.bones.push({ node: hand, joints: wrist, rest });
      const curl = FingerCurl.create(hand, side === "L" ? "l" : "r", (n) => self.modelRotation(n), down, (name) => normaliseBoneName(name, prefix));
      if (curl) self.fingers.push({ side: side === "L" ? 0 : 1, curl });
    }
    const scale = Math.abs(root.scaling.x) || 1;
    const length = (n: TransformNode | null | undefined) => (n ? n.position.length() * scale : 0);
    const upper = length(found.lowerArmR);
    const knuckle = hands.R?.getChildren((n): n is TransformNode => RIGHT_MIDDLE_KNUCKLE.includes(normaliseBoneName(n.name, prefix)), true)[0];
    // The hand's middle, a little short of the knuckles, in the rig wrist's frame: at rest the
    // hand bone turns from the model's frame by its rest rotation, then into the body's.
    const handRest = hands.R ? self.bones.find((b) => b.node === hands.R)?.rest : undefined;
    const palm =
      knuckle && handRest
        ? Vector3.TransformNormal(Vector3.TransformNormal(knuckle.position, handRest), self.toBody).scale(0.85 * scale)
        : new Vector3(0, -0.07 * scale, 0);
    self.armReach = {
      shoulderL: self.bodyPosition(found.upperArmL!).scale(scale),
      shoulderR: self.bodyPosition(found.upperArmR!).scale(scale),
      upper,
      fore: length(hands.R) || upper,
      palm,
    };
    self.anchors.set("head", { bone: found.head!, rest: restOf.get("head")! });
    const nodes = root.getDescendants(false).filter((n): n is TransformNode => "rotation" in n);
    const chest = CHEST.map((alias) => nodes.find((n) => normaliseBoneName(n.name, prefix) === alias)).find((n) => n !== undefined);
    if (chest) self.anchors.set("chest", { bone: chest, rest: self.modelRotation(chest).clone() });
    self.headY = self.bodyPosition(found.head!).y * (Math.abs(root.scaling.y) || 1);
    self.update();
    return self;
  }

  /** Applies the rig's current joint rotations. Call after `animateRig`. */
  update(): void {
    this.updateFrame();
    this.memo.clear();
    const joint = new Matrix();
    const tmp = new Matrix();
    const delta = new Matrix();
    const local = new Matrix();
    const q = new Quaternion();
    for (const b of this.bones) {
      // Joint rotation relative to the body: child local first, then its parents.
      Matrix.IdentityToRef(delta);
      for (let i = b.joints.length - 1; i >= 0; i--) delta.multiplyToRef(localRotation(b.joints[i]!, joint), delta);
      // Body space -> model space: conjugate by the model frame.
      this.toBody.multiplyToRef(delta, tmp);
      tmp.multiplyToRef(this.toBody.transpose(), delta);
      const parent = b.node.parent ? this.modelRotation(b.node.parent as TransformNode) : IDENTITY;
      b.rest.multiplyToRef(delta, tmp);
      tmp.multiplyToRef(parent.transpose(), local);
      q.copyFrom(Quaternion.FromRotationMatrix(local));
      if (b.node.rotationQuaternion) b.node.rotationQuaternion.copyFrom(q);
      else b.node.rotationQuaternion = q.clone();
      this.memo.delete(b.node);
    }
    for (const f of this.fingers) f.curl.apply(this.rig.fist[f.side]);
    for (const h of this.held) {
      // The prop follows the rig's forearm (gun along the aim) and sits at the model's hand:
      // world = D (forearm turn in body space) = S * R * handRot * toBody, where S undoes the
      // model's scale and glTF mirror so that R stays a proper rotation.
      Matrix.IdentityToRef(delta);
      for (let i = h.joints.length - 1; i >= 0; i--) delta.multiplyToRef(localRotation(h.joints[i]!, joint), delta);
      delta.multiplyToRef(this.toBody.transpose(), tmp);
      const hand = this.modelRotation(h.hand).transpose();
      const rs = this.root.scaling;
      const scale = Math.abs(rs.x) || 1;
      const flip = Matrix.Scaling(Math.sign(rs.x) || 1, Math.sign(rs.y) || 1, Math.sign(rs.z) || 1);
      flip.multiply(tmp).multiplyToRef(hand, local);
      q.copyFrom(Quaternion.FromRotationMatrix(local));
      if (h.node.rotationQuaternion) h.node.rotationQuaternion.copyFrom(q);
      else h.node.rotationQuaternion = q.clone();
      Vector3.TransformNormalToRef(Vector3.TransformNormal(h.offset, tmp), hand, h.node.position);
      h.node.position.scaleInPlace(1 / scale);
      h.node.scaling.set((Math.sign(rs.x) || 1) / scale, (Math.sign(rs.y) || 1) / scale, (Math.sign(rs.z) || 1) / scale);
    }
  }

  /**
   * Puts a prop (the heroine's gun) in the model's right hand. The prop's axes are the rig
   * forearm's: -Y runs from the elbow to the fingers, so along the aim. `offset` is in them. Returns false if the model has no hand bone.
   */
  holdInRightHand(node: TransformNode, offset: Vector3): boolean {
    if (!this.rightHand) return false;
    node.parent = this.rightHand;
    this.held.push({ node, hand: this.rightHand, joints: this.rightForearm, offset });
    this.update();
    return true;
  }

  /** The model's shoulders and arm lengths in the rig body's frame, for a hold the rig solves for them (G-282). */
  get reach(): ArmReach {
    return this.armReach!;
  }

  /** Height of the model's head bone over its feet, in metres (to fit add-ons to the model's size). */
  get headHeight(): number {
    return this.headY;
  }

  /**
   * A node on the model's head or chest bone whose frame is the rig's: at rest its axes are
   * the rig body's (+Y up, +Z forward, the character's left at -X) and its unit is a metre, so
   * a garment add-on authored for the rig only needs its offset from the bone. The head node
   * turns with the head, the chest one with the torso. The caller owns and disposes the node.
   * Null when the model has no such bone.
   */
  anchor(bone: AnchorBone, name: string): TransformNode | null {
    const a = this.anchors.get(bone);
    if (!a) return null;
    // Wanted: anchor -> body = the rig joint's turn. The bone -> body is rest * toBody * turn, so
    // anchor -> bone = (rest * toBody)^-1, split into the model's scale and mirror and a rotation.
    const rs = this.root.scaling;
    const sx = Math.sign(rs.x) || 1;
    const sy = Math.sign(rs.y) || 1;
    const sz = Math.sign(rs.z) || 1;
    const scale = Math.abs(rs.x) || 1;
    const local = Matrix.Scaling(sx, sy, sz).multiply(this.toBody.transpose()).multiply(a.rest.transpose());
    const node = new TransformNode(name, this.root.getScene());
    node.parent = a.bone;
    node.rotationQuaternion = Quaternion.FromRotationMatrix(local);
    node.scaling.set(sx / scale, sy / scale, sz / scale);
    return node;
  }

  /** Stops driving a prop given to `holdInRightHand`, e.g. before it is disposed. */
  release(node: TransformNode): void {
    const i = this.held.findIndex((h) => h.node === node);
    if (i >= 0) this.held.splice(i, 1);
  }

  private updateFrame(): void {
    const r = this.root;
    const s = r.scaling;
    const rot = localRotation(r, new Matrix());
    Matrix.ScalingToRef(Math.sign(s.x) || 1, Math.sign(s.y) || 1, Math.sign(s.z) || 1, this.toBody);
    this.toBody.multiplyToRef(rot, this.toBody);
  }

  /** Rotation of a node in model space (relative to the model root). */
  private modelRotation(node: TransformNode): Matrix {
    if (node === this.root) return IDENTITY;
    const cached = this.memo.get(node);
    if (cached) return cached;
    const own = localRotation(node, new Matrix());
    const parent = node.parent ? this.modelRotation(node.parent as TransformNode) : IDENTITY;
    const out = own.multiply(parent);
    this.memo.set(node, out);
    return out;
  }

  /** Bind position of a node in body space (direction only matters, scale is ignored). */
  private bodyPosition(node: TransformNode): Vector3 {
    let p = Vector3.Zero();
    for (let n: TransformNode | null = node; n && n !== this.root; n = n.parent as TransformNode | null) {
      const parent = n.parent && n.parent !== this.root ? this.modelRotation(n.parent as TransformNode) : IDENTITY;
      p = p.add(Vector3.TransformNormal(n.position, parent));
    }
    return Vector3.TransformNormal(p, this.toBody);
  }
}
