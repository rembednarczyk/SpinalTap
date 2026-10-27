import { Matrix, Quaternion, type TransformNode, Vector3 } from "../babylon";
import { normaliseBoneName } from "./model-rig";

/** Secondary-motion bones: VRoid hair (`HairJoint-*`) and cloth (`J_Sec_*`). */
const SECONDARY = /(^|-)(j_sec_|hairjoint)/i;

export interface SpringSettings {
  /** Pull back towards the bind direction, per second. */
  readonly stiffness: number;
  /** 0..1 share of velocity lost per step. */
  readonly drag: number;
  /** Pull along world down, per second. */
  readonly gravity: number;
  /**
   * 0..1 share of the character's own movement the tails follow outright. Pure world-space
   * inertia (0) streams hair straight back at a run; 1 ignores movement entirely.
   */
  readonly follow: number;
  /** Largest swing away from the bind direction (radians). */
  readonly maxAngle: number;
}

export const DEFAULT_SPRING: SpringSettings = { stiffness: 1.4, drag: 0.45, gravity: 0.15, follow: 0.75, maxAngle: 1.1 };

interface Joint {
  readonly node: TransformNode;
  /** Bind rotation of the joint, relative to its parent. */
  readonly bind: Quaternion;
  /** Unit direction to the child in the joint's bind frame, and its length (model units). */
  readonly axis: Vector3;
  readonly length: number;
  /** Tail position in world space, now and one step ago. */
  tail: Vector3;
  prevTail: Vector3;
  /** Colliders the bind pose is clear of; one the bone starts inside would fling it. */
  hits: SpringCollider[];
}

/** Sphere in model space that hair and cloth tails are pushed out of. */
export interface SpringCollider {
  readonly node: TransformNode;
  readonly offset: Vector3;
  readonly radius: number;
}

const rotationOf = (node: TransformNode): Quaternion =>
  node.rotationQuaternion?.clone() ?? Quaternion.FromEulerAngles(node.rotation.x, node.rotation.y, node.rotation.z);

/**
 * Spring bones after the VRM 0.x algorithm: every secondary joint chases its bind direction
 * with inertia, drag and a little gravity, keeps its length, and is turned to point at its
 * simulated tail. Works in the model's own (glTF) space, so the handedness mirror on the glTF
 * root needs no special care; tails live in world space so moving and turning the character
 * swings hair and skirts.
 */
export class SpringBones {
  private readonly joints: Joint[] = [];
  private readonly toModel = new Matrix();
  private readonly fromModel = new Matrix();
  private readonly memo = new Map<TransformNode, Quaternion>();
  private readonly lastRoot = new Vector3();
  private primed = false;

  private constructor(
    private readonly root: TransformNode,
    private readonly settings: SpringSettings,
    private readonly colliders: readonly SpringCollider[],
  ) {}

  /** Null when the model has no secondary bones. */
  static create(root: TransformNode, colliders: readonly SpringCollider[] = [], settings = DEFAULT_SPRING): SpringBones | null {
    const self = new SpringBones(root, settings, colliders);
    // Parents before children, so a chain is solved from its root outwards.
    for (const node of root.getDescendants(false) as TransformNode[]) {
      if (!SECONDARY.test(node.name) || !("rotation" in node)) continue;
      const child = node.getChildren((n): n is TransformNode => "position" in n, true)[0];
      if (!child || child.position.length() < 1e-4) continue;
      self.joints.push({
        node,
        bind: rotationOf(node),
        axis: child.position.normalizeToNew(),
        length: child.position.length(),
        tail: Vector3.Zero(),
        prevTail: Vector3.Zero(),
        hits: [],
      });
    }
    return self.joints.length > 0 ? self : null;
  }

  get count(): number {
    return this.joints.length;
  }

  /** Call after the body pose is final for the frame (after the humanoid retarget). */
  update(dt: number): void {
    const step = Math.min(dt, 1 / 30);
    this.root.computeWorldMatrix(true).invertToRef(this.toModel);
    this.fromModel.copyFrom(this.root.getWorldMatrix());
    this.memo.clear();
    const gravity = Vector3.TransformNormal(new Vector3(0, -1, 0), this.toModel).normalize();
    if (!this.primed || step <= 0) {
      this.prime();
      return;
    }
    // Carry the tails along with most of the character's own movement.
    const rootPos = this.root.getAbsolutePosition();
    const carried = rootPos.subtract(this.lastRoot).scale(this.settings.follow);
    this.lastRoot.copyFrom(rootPos);
    for (const j of this.joints) {
      j.tail.addInPlace(carried);
      j.prevTail.addInPlace(carried);
    }
    for (const j of this.joints) {
      const parent = this.modelRotation(j.node.parent as TransformNode);
      const head = this.modelPosition(j.node);
      // Bind direction of the bone in model space, given the parent's current pose.
      const rest = j.axis.applyRotationQuaternion(parent.multiply(j.bind));
      const tail = Vector3.TransformCoordinates(j.tail, this.toModel);
      const prev = Vector3.TransformCoordinates(j.prevTail, this.toModel);
      // A teleport (respawn, load) would fling the hair across the map: re-prime instead.
      if (Vector3.Distance(tail, head) > j.length * 4) {
        this.prime();
        return;
      }
      const next = tail
        .add(tail.subtract(prev).scale(1 - this.settings.drag))
        .add(rest.scale(this.settings.stiffness * step))
        .add(gravity.scale(this.settings.gravity * step));
      let dir = next.subtract(head).normalize();
      const swing = Math.acos(Math.min(1, Math.max(-1, Vector3.Dot(dir, rest))));
      if (swing > this.settings.maxAngle) {
        // Pull back onto the cone around the rest direction.
        const axis = Vector3.Cross(rest, dir);
        if (axis.lengthSquared() > 1e-10) dir = rest.applyRotationQuaternion(Quaternion.RotationAxis(axis.normalize(), this.settings.maxAngle));
      }
      for (const c of j.hits) dir = this.collide(c, head, dir, j.length);
      dir.normalize();
      const solved = head.add(dir.scale(j.length));
      j.prevTail = j.tail;
      j.tail = Vector3.TransformCoordinates(solved, this.fromModel);
      // Turn the joint from its bind direction to the solved one, in the parent's frame.
      const local = dir.applyRotationQuaternion(Quaternion.Inverse(parent));
      const bindDir = j.axis.applyRotationQuaternion(j.bind);
      const turn = new Quaternion();
      Quaternion.FromUnitVectorsToRef(bindDir, local.normalize(), turn);
      const q = turn.multiply(j.bind);
      if (j.node.rotationQuaternion) j.node.rotationQuaternion.copyFrom(q);
      else j.node.rotationQuaternion = q;
      this.memo.delete(j.node);
    }
  }

  private prime(): void {
    for (const j of this.joints) {
      if (j.node.rotationQuaternion) j.node.rotationQuaternion.copyFrom(j.bind);
      else j.node.rotationQuaternion = j.bind.clone();
    }
    this.memo.clear();
    for (const j of this.joints) {
      const head = this.modelPosition(j.node);
      const tail = head.add(j.axis.applyRotationQuaternion(this.modelRotation(j.node)).scale(j.length));
      j.tail = Vector3.TransformCoordinates(tail, this.fromModel);
      j.prevTail = j.tail.clone();
      j.hits = this.colliders.filter((c) => Vector3.Distance(tail, this.colliderCentre(c)) >= c.radius);
    }
    this.lastRoot.copyFrom(this.root.getAbsolutePosition());
    this.primed = true;
  }

  private colliderCentre(c: SpringCollider): Vector3 {
    return this.modelPosition(c.node).add(c.offset.applyRotationQuaternion(this.modelRotation(c.node)));
  }

  private collide(c: SpringCollider, head: Vector3, dir: Vector3, length: number): Vector3 {
    const centre = this.colliderCentre(c);
    const tail = head.add(dir.normalizeToNew().scale(length));
    const away = tail.subtract(centre);
    const d = away.length();
    if (d >= c.radius || d < 1e-6) return dir;
    return centre.add(away.scale(c.radius / d)).subtract(head);
  }

  /** Rotation of a node relative to the model root. */
  private modelRotation(node: TransformNode | null): Quaternion {
    if (!node || node === this.root) return Quaternion.Identity();
    const cached = this.memo.get(node);
    if (cached) return cached;
    const out = this.modelRotation(node.parent as TransformNode | null).multiply(rotationOf(node));
    this.memo.set(node, out);
    return out;
  }

  /** Position of a node relative to the model root (glTF units, no root scale). */
  private modelPosition(node: TransformNode): Vector3 {
    let p = Vector3.Zero();
    for (let n: TransformNode | null = node; n && n !== this.root; n = n.parent as TransformNode | null) {
      p = p.add(n.position.applyRotationQuaternion(this.modelRotation(n.parent as TransformNode | null)));
    }
    return p;
  }
}

/** Head, chest and thigh spheres for a humanoid, so hair stays out of the face and skirts out of the legs. */
export const humanoidColliders = (root: TransformNode, prefix = ""): SpringCollider[] => {
  const nodes = root.getDescendants(false) as TransformNode[];
  const byName = (names: readonly string[]): TransformNode | undefined =>
    nodes.find((n) => names.includes(normaliseBoneName(n.name, prefix)));
  const out: SpringCollider[] = [];
  const head = byName(["head", "chead"]);
  if (head) out.push({ node: head, offset: new Vector3(0, 0.07, 0), radius: 0.095 });
  const chest = byName(["cupperchest", "upperchest", "spine2", "cchest", "chest"]);
  if (chest) out.push({ node: chest, offset: new Vector3(0, 0.02, 0), radius: 0.1 });
  for (const side of ["l", "r"] as const) {
    const names = side === "l" ? ["lupperleg", "leftupleg", "thighl"] : ["rupperleg", "rightupleg", "thighr"];
    const thigh = byName(names);
    const knee = thigh?.getChildren((n): n is TransformNode => "position" in n, true)[0];
    if (thigh && knee) out.push({ node: thigh, offset: knee.position.scale(0.45), radius: 0.075 });
  }
  return out;
};
