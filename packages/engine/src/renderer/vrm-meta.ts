/**
 * Spring bone data authored in a VRM file, read straight from the GLB JSON chunk (Babylon's
 * glTF loader skips the VRM extensions). Node references become node names, so they survive
 * instantiation with a name prefix. Coordinates are glTF's.
 */
export interface VrmSpringGroup {
  readonly stiffness: number;
  readonly gravity: number;
  readonly drag: number;
  /** Radius of each joint's tail when colliding (model units). */
  readonly hitRadius: number;
  /** Root joints; every secondary joint below them belongs to the group. */
  readonly roots: readonly string[];
  /** Indices into `colliderGroups`. */
  readonly colliderGroups: readonly number[];
}

export interface VrmCollider {
  readonly node: string;
  readonly offset: readonly [number, number, number];
  readonly radius: number;
}

export interface VrmSprings {
  readonly groups: readonly VrmSpringGroup[];
  readonly colliderGroups: readonly (readonly VrmCollider[])[];
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (typeof v === "object" && v !== null ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** The JSON chunk of a GLB, or null if the bytes are not a GLB. */
export const readGlbJson = (bytes: ArrayBuffer): Json | null => {
  if (bytes.byteLength < 20) return null;
  const view = new DataView(bytes);
  if (view.getUint32(0, true) !== 0x46546c67) return null; // "glTF"
  const length = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || 20 + length > bytes.byteLength) return null; // "JSON"
  try {
    return obj(JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, length))));
  } catch {
    return null;
  }
};

/** Spring bones from VRM 0.x (`VRM.secondaryAnimation`) or VRM 1.0 (`VRMC_springBone`). */
export const readVrmSprings = (gltf: Json): VrmSprings | null => {
  const nodes = arr(gltf.nodes).map((n) => String(obj(n).name ?? ""));
  const nodeName = (i: unknown): string | null => (typeof i === "number" ? (nodes[i] ?? null) : null);
  const ext = obj(gltf.extensions);

  const v0 = obj(obj(ext.VRM).secondaryAnimation);
  if (Array.isArray(v0.boneGroups)) {
    // VRM 0.x stores collider offsets in Unity's left-handed space; like three-vrm, flip z.
    const colliderGroups = arr(v0.colliderGroups).map((g) => {
      const node = nodeName(obj(g).node);
      return node
        ? arr(obj(g).colliders).map((c): VrmCollider => {
            const o = obj(obj(c).offset);
            return { node, offset: [num(o.x, 0), num(o.y, 0), -num(o.z, 0)], radius: num(obj(c).radius, 0) };
          })
        : [];
    });
    const groups = arr(v0.boneGroups).map((g): VrmSpringGroup => {
      const b = obj(g);
      return {
        stiffness: num(b.stiffiness ?? b.stiffness, 1),
        gravity: num(b.gravityPower, 0),
        drag: num(b.dragForce, 0.4),
        hitRadius: num(b.hitRadius, 0.02),
        roots: arr(b.bones).map(nodeName).filter((n): n is string => n !== null),
        colliderGroups: arr(b.colliderGroups).filter((i): i is number => typeof i === "number"),
      };
    });
    return { groups, colliderGroups };
  }

  const v1 = obj(ext.VRMC_springBone);
  if (Array.isArray(v1.springs)) {
    const colliders = arr(v1.colliders).map((c): VrmCollider | null => {
      const node = nodeName(obj(c).node);
      const sphere = obj(obj(obj(c).shape).sphere);
      const o = arr(sphere.offset);
      return node ? { node, offset: [num(o[0], 0), num(o[1], 0), num(o[2], 0)], radius: num(sphere.radius, 0) } : null;
    });
    const colliderGroups = arr(v1.colliderGroups).map((g) =>
      arr(obj(g).colliders)
        .map((i) => (typeof i === "number" ? colliders[i] : null))
        .filter((c): c is VrmCollider => !!c),
    );
    // VRM 1.0 sets parameters per joint; the first joint of a spring stands for the chain.
    const groups = arr(v1.springs).map((s): VrmSpringGroup => {
      const joints = arr(obj(s).joints).map(obj);
      const first = joints[0] ?? {};
      return {
        stiffness: num(first.stiffness, 1),
        gravity: num(first.gravityPower, 0),
        drag: num(first.dragForce, 0.5),
        hitRadius: num(first.hitRadius, 0.02),
        roots: [nodeName(first.node)].filter((n): n is string => n !== null),
        colliderGroups: arr(obj(s).colliderGroups).filter((i): i is number => typeof i === "number"),
      };
    });
    return { groups, colliderGroups };
  }
  return null;
};

/** Facial expressions the game drives: blinking and the five vowel mouth shapes. */
export const FACE_SHAPES = ["blink", "a", "i", "u", "e", "o"] as const;
export type FaceShape = (typeof FACE_SHAPES)[number];

/** One morph target an expression moves: on the meshes of a node, at `weight` 0..1. */
export interface MorphBind {
  readonly node: string;
  readonly index: number;
  readonly weight: number;
}

export type VrmExpressions = Partial<Record<FaceShape, readonly MorphBind[]>>;

const isFaceShape = (v: string): v is FaceShape => (FACE_SHAPES as readonly string[]).includes(v);

/**
 * Blink and vowel expressions from VRM 0.x (`blendShapeMaster`, binds by mesh, weight 0..100)
 * or VRM 1.0 (`VRMC_vrm.expressions.preset`, binds by node, weight 0..1, names "aa", "ih"...).
 * Mesh references become the names of the nodes that use the mesh.
 */
export const readVrmExpressions = (gltf: Json): VrmExpressions | null => {
  const nodes = arr(gltf.nodes).map(obj);
  const nodesOfMesh = (mesh: unknown): string[] =>
    typeof mesh === "number" ? nodes.filter((n) => n.mesh === mesh).map((n) => String(n.name ?? "")) : [];
  const out: Partial<Record<FaceShape, MorphBind[]>> = {};
  const ext = obj(gltf.extensions);

  const v0 = arr(obj(obj(ext.VRM).blendShapeMaster).blendShapeGroups);
  for (const g of v0.map(obj)) {
    const preset = String(g.presetName ?? "");
    if (!isFaceShape(preset)) continue;
    const binds = arr(g.binds)
      .map(obj)
      .flatMap((b) => nodesOfMesh(b.mesh).map((node): MorphBind => ({ node, index: num(b.index, -1), weight: num(b.weight, 100) / 100 })))
      .filter((b) => b.index >= 0);
    if (binds.length > 0) out[preset] = binds;
  }

  const V1_NAMES: Readonly<Record<string, FaceShape>> = { blink: "blink", aa: "a", ih: "i", ou: "u", ee: "e", oh: "o" };
  const v1 = obj(obj(obj(ext.VRMC_vrm).expressions).preset);
  for (const [name, e] of Object.entries(v1)) {
    const shape = V1_NAMES[name];
    if (!shape) continue;
    const binds = arr(obj(e).morphTargetBinds)
      .map(obj)
      .map((b): MorphBind | null => {
        const n = typeof b.node === "number" ? nodes[b.node] : undefined;
        return n ? { node: String(n.name ?? ""), index: num(b.index, -1), weight: num(b.weight, 1) } : null;
      })
      .filter((b): b is MorphBind => b !== null && b.index >= 0);
    if (binds.length > 0) out[shape] = binds;
  }
  return Object.keys(out).length > 0 ? out : null;
};
