import { Matrix, Quaternion, type TransformNode, Vector3 } from "../babylon";
import type { CharacterRig } from "./characters";

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

const RIGHT_HAND = ["rhand", "righthand", "handr"];

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

  private constructor(private readonly root: TransformNode) {}

  /** Returns null when the model has no recognisable legs and arms. */
  static create(rig: CharacterRig, root: TransformNode, prefix = ""): HumanoidRetarget | null {
    const found = findHumanoidBones(root.getDescendants(false).filter((n): n is TransformNode => "rotation" in n), prefix);
    if (!DRIVEN.every((k) => found[k])) return null;
    const self = new HumanoidRetarget(root);
    self.rightHand = found.lowerArmR!.getChildren((n): n is TransformNode => RIGHT_HAND.includes(normaliseBoneName(n.name, prefix)), true)[0] ?? null;
    self.rightForearm = [rig.armR, rig.elbowR];
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
