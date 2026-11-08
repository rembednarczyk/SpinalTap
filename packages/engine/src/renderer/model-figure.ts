import { Matrix, Quaternion, type TransformNode, Vector3 } from "../babylon";
import { normaliseBoneName } from "./model-rig";

/**
 * The figure of a dressed model (ADR-0076 decision 7): how the years show in the body. A bent
 * back (the spine, chest and neck bones turned forward, the head still looking ahead because the
 * retarget drives it in the model's space), a heavier or slighter build (the model widened or
 * narrowed against its height) and shorter steps. Pure data here; `wearFigure` puts it on a model.
 */
export interface Figure {
  /** Forward bend of the back in radians, spread over the spine, chest and neck (0: upright). */
  readonly stoop: number;
  /** Width and depth of the body against its height: above 1 heavier, below 1 slighter. */
  readonly build: number;
  /** Stride of the walk against the rig's: below 1 shorter, shuffling steps and a smaller arm swing. */
  readonly pace: number;
}

export const UPRIGHT: Figure = { stoop: 0, build: 1, pace: 1 };

/** A figure as text, for telling two looks apart. */
export const figureText = (f: Figure): string => (f.stoop === 0 && f.build === 1 && f.pace === 1 ? "" : `f${f.stoop}/${f.build}/${f.pace}`);

/** Keeps a figure within what still reads as a person: a bent back, not a broken one. */
export const clampFigure = (f: Partial<Figure>): Figure => ({
  stoop: Math.min(0.7, Math.max(0, f.stoop ?? 0)),
  build: Math.min(1.25, Math.max(0.8, f.build ?? 1)),
  pace: Math.min(1, Math.max(0.4, f.pace ?? 1)),
});

/**
 * Bones of the back, top-down order of the hierarchy, with their share of the stoop. VRoid's
 * `J_Bip_C_*` and Mixamo's names; a missing bone's share is simply not bent.
 */
const BACK: readonly (readonly [readonly string[], number])[] = [
  [["cspine", "spine"], 0.3],
  [["cchest", "spine1"], 0.25],
  [["cupperchest", "spine2"], 0.15],
  [["cneck", "neck"], 0.3],
];

/** Recomputes the world matrices from the root down to `node`, so the node's frame is current. */
export const freshWorld = (node: TransformNode): Matrix => {
  const chain: TransformNode[] = [];
  for (let n: TransformNode | null = node; n; n = n.parent as TransformNode | null) chain.unshift(n);
  for (const n of chain) n.computeWorldMatrix(true);
  return node.getWorldMatrix();
};

/** Turns `bone` about a world axis through its own origin by `angle` (its children follow). */
const turnInWorld = (bone: TransformNode, axis: Vector3, angle: number): void => {
  const parent = bone.parent as TransformNode | null;
  const p = parent ? freshWorld(parent).clone() : Matrix.Identity();
  p.setTranslationFromFloats(0, 0, 0);
  const local = bone.rotationQuaternion ?? Quaternion.FromEulerAngles(bone.rotation.x, bone.rotation.y, bone.rotation.z);
  const m = Matrix.FromQuaternionToRef(local, new Matrix()).multiply(p).multiply(Matrix.RotationAxis(axis, angle)).multiply(Matrix.Invert(p));
  bone.rotationQuaternion = Quaternion.FromRotationMatrix(m);
};

/** What `wearFigure` changed, to give back. */
export interface WornFigure {
  undo(): void;
}

/**
 * Puts `figure` on a model instance at rest under the rig body `body` (the rig faces +Z, its
 * right is +X): bends the back forward about the body's right and scales the model's width and
 * depth. The model must be in its bind pose (as the retarget leaves the back bones).
 */
export const wearFigure = (root: TransformNode, prefix: string, body: TransformNode, figure: Figure): WornFigure => {
  const bent: { bone: TransformNode; q: Quaternion | null; r: Vector3 }[] = [];
  if (figure.stoop > 0) {
    const nodes = root.getDescendants(false).filter((n): n is TransformNode => "rotation" in n);
    body.computeWorldMatrix(true);
    const right = Vector3.TransformNormal(Vector3.Right(), body.getWorldMatrix()).normalize();
    for (const [names, share] of BACK) {
      const bone = nodes.find((n) => names.includes(normaliseBoneName(n.name, prefix)));
      if (!bone) continue;
      bent.push({ bone, q: bone.rotationQuaternion?.clone() ?? null, r: bone.rotation.clone() });
      turnInWorld(bone, right, figure.stoop * share);
    }
  }
  const scaling = root.scaling.clone();
  if (figure.build !== 1) root.scaling.set(scaling.x * figure.build, scaling.y, scaling.z * figure.build);
  return {
    undo: () => {
      root.scaling.copyFrom(scaling);
      for (const b of bent) {
        b.bone.rotation.copyFrom(b.r);
        b.bone.rotationQuaternion = b.q ? b.q.clone() : null;
      }
    },
  };
};
