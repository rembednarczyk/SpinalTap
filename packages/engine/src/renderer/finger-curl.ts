import { Matrix, Quaternion, type TransformNode, Vector3 } from "../babylon";

const FINGERS = ["thumb", "index", "middle", "ring", "little"] as const;

/** Bend of each joint at a full fist (radians), knuckle to tip; the thumb folds over less. */
const BEND: Readonly<Record<(typeof FINGERS)[number], readonly [number, number, number]>> = {
  thumb: [0.55, 0.45, 0.5],
  index: [1.2, 1.45, 0.9],
  middle: [1.3, 1.5, 0.95],
  ring: [1.35, 1.5, 0.95],
  little: [1.4, 1.5, 0.95],
};

interface Joint {
  readonly finger: (typeof FINGERS)[number];
  /** 1 the knuckle .. 3 the last joint. */
  readonly at: number;
  readonly node: TransformNode;
  /** The next joint (or the tip's end bone): where this one points. */
  readonly child: TransformNode;
  /** Bind rotation against the parent. */
  readonly bind: Matrix;
  /** Axis the joint bends about, in the parent's frame. */
  readonly axis: Vector3;
  readonly bend: number;
}

/** Normalised names of a finger joint in VRoid/VRM ("J_Bip_R_Index1") and Mixamo ("RightHandIndex1") exports. */
const namesOf = (side: "l" | "r", finger: string, i: number): string[] => [`${side}${finger}${i}`, `${side === "r" ? "right" : "left"}hand${finger}${i}`];

/**
 * Closes an imported model's fingers into a fist (G-282). Each finger joint bends towards the
 * palm about the axis across the finger, found from the bind pose: VRoid and Mixamo models are
 * bound with the palms down, so the palm faces the model's down. The thumb folds across the
 * palm, towards the middle finger's knuckle, so it wraps a grip instead of sticking up. Models
 * without finger bones keep their open hands.
 */
export class FingerCurl {
  private readonly rotation = new Matrix();
  private readonly turn = new Matrix();
  private readonly parentBack = new Matrix();
  private last = "";

  private constructor(private readonly joints: readonly Joint[]) {}

  /**
   * `rotationOf` gives a node's bind rotation in model space, `down` the model's down there,
   * `normalise` the exporter-free bone name.
   */
  static create(hand: TransformNode, side: "l" | "r", rotationOf: (n: TransformNode) => Matrix, down: Vector3, normalise: (name: string) => string): FingerCurl | null {
    const nodes = hand.getDescendants(false).filter((n): n is TransformNode => "rotation" in n);
    const joints: Joint[] = [];
    const find = (finger: string, i: number) => nodes.find((n) => namesOf(side, finger, i).includes(normalise(n.name)));
    // Where the thumb folds to: across the palm to the middle knuckle, and down into it.
    const thumb = find("thumb", 1);
    const middle = find("middle", 1);
    const across =
      thumb && middle && thumb.parent === hand && middle.parent === hand ? Vector3.TransformNormal(middle.position.subtract(thumb.position), rotationOf(hand)).normalize() : down;
    const thumbTo = across.add(down.scale(0.6)).normalize();
    for (const finger of FINGERS) {
      for (let i = 1; i <= 3; i++) {
        const node = find(finger, i);
        const child = node?.getChildren((n): n is TransformNode => "position" in n, true)[0];
        const parent = node?.parent as TransformNode | null | undefined;
        if (!node || !child || !parent || child.position.lengthSquared() < 1e-12) continue;
        const along = Vector3.TransformNormal(child.position, rotationOf(node)).normalize();
        const turn = Vector3.Cross(along, finger === "thumb" ? thumbTo : down);
        if (turn.lengthSquared() < 1e-8) continue;
        const axis = Vector3.TransformNormal(turn.normalize(), rotationOf(parent).transpose());
        const bind = Matrix.Identity();
        (node.rotationQuaternion ?? Quaternion.FromEulerAngles(node.rotation.x, node.rotation.y, node.rotation.z)).toRotationMatrix(bind);
        joints.push({ finger, at: i, node, child, bind, axis, bend: BEND[finger][i - 1]! });
      }
    }
    return joints.length > 0 ? new FingerCurl(joints) : null;
  }

  /**
   * 0 the bind pose (open) .. 1 a fist. `index` and `thumb` close those two apart (a trigger
   * finger laid along the frame, a thumb along the other side); by default as the rest.
   * `thumbRoot` turns the thumb's root and its first knuckle apart, its last joint as `thumb`
   * has it: a thumb swung round the back of a pistol's grip and laid straight along its other side.
   */
  apply(amount: number, index = amount, thumb = amount, thumbRoot = thumb): void {
    const key = `${amount}|${index}|${thumb}|${thumbRoot}`;
    if (key === this.last) return;
    this.last = key;
    for (const j of this.joints) {
      const a = j.finger === "index" ? index : j.finger === "thumb" ? (j.at < 3 ? thumbRoot : thumb) : amount;
      Matrix.RotationAxisToRef(j.axis, j.bend * a, this.turn);
      j.bind.multiplyToRef(this.turn, this.rotation);
      const q = j.node.rotationQuaternion ?? new Quaternion();
      Quaternion.FromRotationMatrixToRef(this.rotation, q);
      j.node.rotationQuaternion = q;
    }
  }

  /**
   * Turns the thumb's joints, knuckle to tip, so that each points at its point of `points` (world
   * space: the next joint's, the tip's), after `apply`: a thumb laid along a path round a grip
   * that the curl's one bend per joint cannot follow. The shortest turn from where the joint
   * points; the next `apply` starts again from the bind pose.
   */
  aimThumb(points: readonly Vector3[]): void {
    this.last = "";
    const thumb = this.joints.filter((j) => j.finger === "thumb").sort((a, b) => a.at - b.at);
    thumb.forEach((j, i) => {
      const to = points[i];
      if (!to) return;
      // In the parent's frame, whatever its scale (the model's root may mirror it).
      (j.node.parent as TransformNode).computeWorldMatrix(true).invertToRef(this.parentBack);
      const from = j.node.position;
      j.node.computeWorldMatrix(true);
      const now = Vector3.TransformCoordinates(j.child.computeWorldMatrix(true).getTranslation(), this.parentBack).subtract(from).normalize();
      const want = Vector3.TransformCoordinates(to, this.parentBack).subtract(from).normalize();
      const axis = Vector3.Cross(now, want);
      if (axis.lengthSquared() < 1e-12) return;
      const angle = Math.atan2(axis.length(), Vector3.Dot(now, want));
      Matrix.RotationAxisToRef(axis.normalize(), angle, this.turn);
      (j.node.rotationQuaternion ?? Quaternion.FromEulerAngles(j.node.rotation.x, j.node.rotation.y, j.node.rotation.z)).toRotationMatrix(this.rotation);
      this.rotation.multiplyToRef(this.turn, this.rotation);
      j.node.rotationQuaternion = Quaternion.FromRotationMatrix(this.rotation);
      j.node.computeWorldMatrix(true);
    });
  }
}
