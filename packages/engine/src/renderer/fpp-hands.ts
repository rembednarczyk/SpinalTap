import { type AbstractMesh, Matrix, type Mesh, Quaternion, type Scene, type Skeleton, TransformNode, Vector3 } from "../babylon";
import type { CameraRig } from "../camera/camera-rig";
import type { ViewArms, ViewArmsFrame } from "../camera/view-arms";
import { armMesh } from "./arm-mesh";
import { FingerCurl } from "./finger-curl";
import { type ArmsTarget, type HandTarget, chokeHands, weaponHands } from "./fpp-hand-poses";
import type { CharacterModelSpec, ModelInstance, ModelLibrary } from "./model-library";
import { findHumanoidBones, normaliseBoneName } from "./model-rig";

type Side = "l" | "r";

const HAND_NAMES: Readonly<Record<Side, readonly string[]>> = { l: ["lhand", "lefthand", "handl"], r: ["rhand", "righthand", "handr"] };
const MIDDLE_KNUCKLE: Readonly<Record<Side, readonly string[]>> = { l: ["lmiddle1", "lefthandmiddle1"], r: ["rmiddle1", "righthandmiddle1"] };
/**
 * Where the upper arms come from, in the viewmodel's space (`CameraRig.viewSpace`: the camera's
 * frame, drawn with the viewmodel's own field of view). They are not drawn (only the forearms and
 * hands are), so this only turns the elbows; the shoulders follow the forearms wherever the
 * viewmodel puts them, as the procedural forearm did.
 */
const SHOULDER: Readonly<Record<Side, Vector3>> = { l: new Vector3(-0.2, -0.34, -0.02), r: new Vector3(0.2, -0.34, -0.02) };
const DOWN = new Vector3(0, -1, 0);

/** A bone's frame at bind in the camera's: its linear part, and the rows along it, palm side and across. */
interface BoneRest {
  readonly node: TransformNode;
  readonly rest: Matrix;
  /** Transposed basis at bind: camera frame -> (along, palm normal, across). */
  readonly basisT: Matrix;
}

interface Arm {
  readonly side: Side;
  readonly upper: BoneRest;
  readonly lower: BoneRest;
  readonly hand: BoneRest;
  readonly upperLen: number;
  readonly foreLen: number;
  /** The model's nodes from its root down to the shoulder, refreshed top-down before the arm is posed. */
  readonly chain: readonly TransformNode[];
  readonly curl: FingerCurl | null;
}

/** Rows `along`, the part of `hint` across it (the palm's side), and their cross product. */
const basis = (along: Vector3, hint: Vector3, out: Matrix): Matrix => {
  const a = along.normalizeToNew();
  const pick = (h: Vector3) => h.subtract(a.scale(Vector3.Dot(h, a)));
  let n = pick(hint);
  if (n.lengthSquared() < 1e-6) n = pick(DOWN);
  if (n.lengthSquared() < 1e-6) n = pick(Vector3.Forward());
  n.normalize();
  return Matrix.FromXYZAxesToRef(a, n, Vector3.Cross(a, n), out);
};

const linear = (m: Matrix): Matrix => {
  const out = m.clone();
  out.setTranslationFromFloats(0, 0, 0);
  return out;
};

/** Rotation of a node relative to the model root (`FingerCurl`'s model space). */
const modelRotation = (node: TransformNode, root: TransformNode): Matrix => {
  const out = Matrix.Identity();
  for (let n: TransformNode | null = node; n && n !== root; n = n.parent as TransformNode | null) {
    const q = n.rotationQuaternion ?? Quaternion.FromEulerAngles(n.rotation.x, n.rotation.y, n.rotation.z);
    out.multiplyToRef(Matrix.FromQuaternionToRef(q, new Matrix()), out);
  }
  return out;
};

/** Bones whose skin makes the forearms and hands: the forearm bones and everything under them. */
const armBones = (lower: readonly TransformNode[], nodes: readonly TransformNode[], prefix: string): Set<TransformNode> => {
  const out = new Set<TransformNode>();
  for (const l of lower) for (const n of [l, ...l.getDescendants(false)]) out.add(n as TransformNode);
  // VRoid's twist bones of the forearm hang beside it, under the upper arm.
  for (const n of nodes) if (normaliseBoneName(n.name, prefix).includes("lowerarm")) out.add(n);
  return out;
};

const boneIndices = (skeleton: Skeleton, nodes: ReadonlySet<TransformNode>): Set<number> => {
  const out = new Set<number>();
  for (const b of skeleton.bones) {
    const n = b.getTransformNode();
    if (n && nodes.has(n)) out.add(b.getIndex());
  }
  return out;
};

/**
 * Seki's own forearms and hands in first person (the user's wish of 13.11), instead of the
 * camera's procedural forearm. A second instance of her model file (the one the start has loaded,
 * so nothing more is fetched) hangs in the viewmodel's space under the camera with every mesh
 * off; a new skinned mesh of the triangles her forearm and hand bones move (`armMesh`) draws them:
 * one mesh in her skin
 * material, one draw call. Each frame the arm bones are set straight from the viewmodel's pose
 * (`fpp-hand-poses`), static, with the walk sway the viewmodel already has: the right hand round
 * the grip, the left under the fore-end, the pistol or the right fist, and both on the neck in a
 * takedown grab. Until the model is in, and with `?models=off`, the procedural forearm stays.
 */
export class FppHands implements ViewArms {
  private readonly holder: TransformNode;
  private model: ModelInstance | null = null;
  private meshes: Mesh[] = [];
  private arms: Arm[] = [];
  private key: string | null = null;
  private spec: CharacterModelSpec | null = null;
  /** Her instance is on its way from the library. */
  private pending = false;
  private generation = 0;
  private readonly b1 = new Matrix();
  private readonly q = new Matrix();
  private readonly m = new Matrix();
  private readonly w = new Matrix();
  private readonly inv = new Matrix();
  private readonly local = new Matrix();
  private readonly rotation = new Quaternion();
  private readonly translation = new Vector3();
  private readonly scale = new Vector3();

  constructor(
    scene: Scene,
    private readonly library: ModelLibrary,
    private readonly camera: CameraRig,
  ) {
    this.holder = new TransformNode("vm-arms", scene);
    this.holder.setEnabled(false);
    camera.arms = this;
  }

  /** The arm meshes drawn now (none until the model is in). */
  get drawn(): readonly AbstractMesh[] {
    return this.holder.isEnabled(false) ? this.meshes : [];
  }

  /** The bone of the right (`r`) or left hand, once the model is in. */
  handBone(side: Side): TransformNode | null {
    return this.arms.find((a) => a.side === side)?.hand.node ?? null;
  }

  /** Her model (the manifest's heroine); undefined drops the arms back to the procedural forearm. */
  setModel(spec: CharacterModelSpec | undefined): void {
    const key = spec ? `${spec.url}|${spec.scale ?? 1}` : null;
    if (key === this.key) return;
    this.key = key;
    this.spec = spec ?? null;
    this.generation++;
    this.clear();
  }

  /**
   * Makes the arms once her file is in the library: the start loads it behind the loading screen
   * (`startFiles`), so they never fetch it themselves nor wait on it; until then the stand-in shows.
   */
  private start(): void {
    const spec = this.spec;
    if (!spec || this.model || this.pending || !this.library.isLoaded(spec.url)) return;
    const generation = this.generation;
    this.pending = true;
    this.library
      .instantiate(spec, "vm-arms")
      .then((model) => {
        if (generation !== this.generation || !this.build(model)) model.dispose();
      })
      .catch((err: unknown) => console.warn(`[fpp-hands] ${spec.url} failed to load`, err))
      .finally(() => {
        if (generation === this.generation) this.pending = false;
      });
  }

  pose(frame: ViewArmsFrame | null): boolean {
    this.start();
    if (this.meshes.length === 0) return false;
    const target = this.targetOf(frame);
    if (this.holder.isEnabled(false) !== (target !== null)) this.holder.setEnabled(target !== null);
    if (!target) return true;
    // The viewmodel's space has its scale for this frame's field of view (`CameraRig.viewSpace`).
    this.camera.viewSpace.computeWorldMatrix(true);
    this.holder.computeWorldMatrix(true);
    for (const arm of this.arms) this.place(arm, arm.side === "r" ? target.right : target.left);
    return true;
  }

  private targetOf(frame: ViewArmsFrame | null): ArmsTarget | null {
    if (!frame) return null;
    if (frame.choke) return chokeHands(frame.choke);
    const vm = frame.viewmodel;
    if (!vm) return null;
    const turn = vm.rotationQuaternion ?? Quaternion.RotationYawPitchRoll(vm.rotation.y, vm.rotation.x, vm.rotation.z);
    return weaponHands(frame.look, { position: vm.position, turn: (d) => d.applyRotationQuaternion(turn) });
  }

  private place(arm: Arm, t: HandTarget): void {
    const elbow = t.wrist.subtract(t.fore.scale(arm.foreLen));
    const up = elbow.subtract(SHOULDER[arm.side]).normalize();
    for (const n of arm.chain) n.computeWorldMatrix(true);
    this.setBone(arm.upper, up, t.palm, elbow.subtract(up.scale(arm.upperLen)));
    this.setBone(arm.lower, t.fore, t.palm, null);
    this.setBone(arm.hand, t.fingers, t.palm, null);
    arm.curl?.apply(t.curl, t.index ?? t.curl, t.thumb ?? t.curl);
  }

  /** Turns a bone so that it runs along `along` with its palm side to `hint` (camera frame), at `at` if given. */
  private setBone(b: BoneRest, along: Vector3, hint: Vector3, at: Vector3 | null): void {
    basis(along, hint, this.b1);
    b.basisT.multiplyToRef(this.b1, this.q);
    b.rest.multiplyToRef(this.q, this.m);
    if (at) this.m.setTranslation(at);
    this.m.multiplyToRef(this.camera.viewSpace.getWorldMatrix(), this.w);
    (b.node.parent as TransformNode).computeWorldMatrix(true).invertToRef(this.inv);
    this.w.multiplyToRef(this.inv, this.local);
    this.local.decompose(this.scale, this.rotation, this.translation);
    if (b.node.rotationQuaternion) b.node.rotationQuaternion.copyFrom(this.rotation);
    else b.node.rotationQuaternion = this.rotation.clone();
    if (at) b.node.position.copyFrom(this.translation);
    b.node.computeWorldMatrix(true);
  }

  private build(model: ModelInstance): boolean {
    const { root, prefix } = model;
    this.holder.parent = this.camera.viewSpace;
    root.parent = this.holder;
    root.position.setAll(0);
    const nodes = root.getDescendants(false).filter((n): n is TransformNode => "rotation" in n);
    const found = findHumanoidBones(nodes, prefix);
    const camInv = () => this.camera.viewSpace.computeWorldMatrix(true).clone().invert();
    const refresh = () => {
      this.holder.computeWorldMatrix(true);
      root.computeWorldMatrix(true);
      for (const n of nodes) n.computeWorldMatrix(true);
    };
    const at = (n: TransformNode) => Vector3.TransformCoordinates(n.getAbsolutePosition(), camInv());
    const { upperArmL, upperArmR, lowerArmL, lowerArmR } = found;
    if (!upperArmL || !upperArmR || !lowerArmL || !lowerArmR) return false;
    refresh();
    // The rig's convention: she faces +Z with her left at -X (VRM 0.x files face the other way).
    if (at(upperArmL).x > at(upperArmR).x) {
      root.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), Math.PI).multiply(root.rotationQuaternion ?? Quaternion.FromEulerVector(root.rotation));
      refresh();
    }
    const inv = camInv();
    const rest = (node: TransformNode, child: TransformNode): BoneRest => {
      const m = node.getWorldMatrix().multiply(inv);
      return { node, rest: linear(m), basisT: basis(at(child).subtract(at(node)), DOWN, new Matrix()).transpose() };
    };
    const arms: Arm[] = [];
    for (const [side, upper, lower] of [["l", upperArmL, lowerArmL], ["r", upperArmR, lowerArmR]] as const) {
      const names = (list: readonly string[]) => (n: TransformNode) => list.includes(normaliseBoneName(n.name, prefix));
      const hand = lower.getChildren((n): n is TransformNode => "rotation" in n && names(HAND_NAMES[side])(n as TransformNode), true)[0];
      const knuckle = hand?.getChildren((n): n is TransformNode => "rotation" in n && names(MIDDLE_KNUCKLE[side])(n as TransformNode), true)[0];
      if (!hand || !knuckle) return false;
      const chain: TransformNode[] = [];
      for (let n = upper.parent as TransformNode | null; n && n !== this.holder; n = n.parent as TransformNode | null) chain.unshift(n);
      const curl = FingerCurl.create(hand, side, (n) => modelRotation(n, root), DOWN, (name) => normaliseBoneName(name, prefix));
      arms.push({
        side,
        upper: rest(upper, lower),
        lower: rest(lower, hand),
        hand: rest(hand, knuckle),
        upperLen: Vector3.Distance(at(upper), at(lower)),
        foreLen: Vector3.Distance(at(lower), at(hand)),
        chain,
        curl,
      });
    }
    const kept = armBones([lowerArmL, lowerArmR], nodes, prefix);
    const meshes: Mesh[] = [];
    for (const m of model.meshes) {
      const arm = m.skeleton && m.getTotalVertices() > 0 ? armMesh(m as Mesh, boneIndices(m.skeleton, kept), `vm-arms-${m.name}`) : null;
      m.setEnabled(false);
      if (!arm) continue;
      // Skinned, its bounds are those of the T-pose far round the camera: never culled.
      arm.alwaysSelectAsActiveMesh = true;
      meshes.push(arm);
    }
    if (meshes.length === 0) return false;
    this.model = model;
    this.meshes = meshes;
    this.arms = arms;
    return true;
  }

  private clear(): void {
    for (const m of this.meshes) m.dispose(false, false);
    this.meshes = [];
    this.arms = [];
    this.model?.dispose();
    this.model = null;
    this.pending = false;
    this.holder.setEnabled(false);
  }
}
