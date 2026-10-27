import { Quaternion, type Scene, TransformNode, type Vector3 } from "../src/babylon";

/** VRM 0.x-like T-pose skeleton facing -Z, under a glTF handedness root (mirror + 180°). */
export const tPose = (scene: Scene, prefix = ""): { root: TransformNode; bone: (n: string) => TransformNode } => {
  const root = new TransformNode(`${prefix}__root__`, scene);
  root.rotationQuaternion = new Quaternion(0, 1, 0, 0);
  root.scaling.set(1, 1, -1);
  const nodes = new Map<string, TransformNode>();
  const add = (name: string, parent: TransformNode, x: number, y: number, z = 0): TransformNode => {
    const n = new TransformNode(`${prefix}${name}`, scene);
    n.parent = parent;
    n.position.set(x, y, z);
    n.rotationQuaternion = Quaternion.Identity();
    nodes.set(name, n);
    return n;
  };
  const hips = add("J_Bip_C_Hips", root, 0, 0.9);
  const chest = add("J_Bip_C_Chest", hips, 0, 0.3);
  add("J_Bip_C_Head", chest, 0, 0.25);
  // VRM 0.x faces -Z, so the character's left is +X in glTF space.
  for (const [side, sx] of [["L", 1], ["R", -1]] as const) {
    const ul = add(`J_Bip_${side}_UpperLeg`, hips, 0.09 * sx, -0.05);
    const ll = add(`J_Bip_${side}_LowerLeg`, ul, 0, -0.4);
    add(`J_Bip_${side}_Foot`, ll, 0, -0.4);
    const ua = add(`J_Bip_${side}_UpperArm`, chest, 0.18 * sx, 0.15);
    const la = add(`J_Bip_${side}_LowerArm`, ua, 0.27 * sx, 0);
    add(`J_Bip_${side}_Hand`, la, 0.25 * sx, 0);
  }
  return { root, bone: (n) => nodes.get(n)! };
};

const refresh = (node: TransformNode): void => {
  const chain: TransformNode[] = [];
  for (let n: TransformNode | null = node; n; n = n.parent as TransformNode | null) chain.unshift(n);
  for (const n of chain) n.computeWorldMatrix(true);
};

export const worldOf = (node: TransformNode): Vector3 => {
  refresh(node);
  return node.getAbsolutePosition().clone();
};

/** World matrix with the whole parent chain brought up to date. */
export const worldMatrixOf = (node: TransformNode) => {
  refresh(node);
  return node.getWorldMatrix();
};
