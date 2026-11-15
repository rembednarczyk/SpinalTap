import { type AbstractMesh, Color3, Matrix, type Mesh, MeshClass, type Scene, type TransformNode, Vector3, VertexBuffer, VertexData } from "../babylon";
import { toonSourceOf } from "./model-library";

/**
 * The work apron of a model variant (ADR-0076 §3): no board hung on a bone, but a shell of the
 * model's own cloth. The front-facing triangles of its top and trousers (or one-piece dress)
 * between the chest and the crotch, narrower than the shoulders, are copied a centimetre out
 * along their normals onto the same skeleton, so the apron lies on the body, bends with it and
 * stays behind the hands. One mesh, painted by vertex colour. The vest of the older characters
 * (ADR-0076 decision 7) is the same shell cut differently: the whole torso of the top, front,
 * sides and back, without the sleeves. The ballistic vest (`vest-plate`, G-870) is a plate carrier
 * cut from it again: a front and a back panel from the breastbone to the waist, open at the sides,
 * joined by straps over the shoulders, standing further off so that the bust and the cloth's folds
 * stay under it in every pose.
 */

/** Which triangles of the cloth a shell copies. */
interface Cut {
  /** Heights as fractions of the model's height, from the feet. */
  readonly hem: number;
  readonly bib: number;
  /** Half its width against the model's height. */
  readonly halfWidth: number;
  /** A triangle must face forward at least this much (-1: any way). */
  readonly facing: number;
  /** The trousers too, or only the top. */
  readonly legs: boolean;
  /** `facing` for the back too: front and back panels, open at the sides. */
  readonly panels?: boolean;
  /** Straps above the bib, over the shoulders up to `top`: their inner and outer edge off the centre line, against the model's height. */
  readonly straps?: { readonly inner: number; readonly outer: number; readonly top: number };
  /** How far it stands off the cloth, in the mesh's units (metres in VRoid files). */
  readonly lift: number;
}

/** Hem just under the crotch (clear of a seated keeper's thighs), bib at the chest, about 15 cm half-width on a 1.7 m figure. */
const APRON: Cut = { hem: 0.48, bib: 0.74, halfWidth: 0.09, facing: 0.35, legs: true, lift: 0.012 };
/** From the waist to the armpits, round the body, narrower than the arms hanging at its sides. */
const VEST: Cut = { hem: 0.53, bib: 0.79, halfWidth: 0.105, facing: -1, legs: false, lift: 0.012 };
/**
 * The plate carrier: waist to breastbone, about 12 cm half-width on a 1.7 m figure (inside the
 * arms when they come forward to aim), straps 5 to 10 cm off the centre line over the shoulders, under the collar.
 * Two and a half centimetres off the cloth: the skin under a VRoid top comes up to it at the bust.
 */
const PLATE: Cut = { hem: 0.575, bib: 0.775, halfWidth: 0.072, facing: 0.4, legs: false, panels: true, straps: { inner: 0.03, outer: 0.058, top: 0.82 }, lift: 0.025 };

const SKIN_KINDS = [VertexBuffer.MatricesIndicesKind, VertexBuffer.MatricesWeightsKind, VertexBuffer.MatricesIndicesExtraKind, VertexBuffer.MatricesWeightsExtraKind] as const;

interface Frame {
  readonly up: number;
  readonly height: number;
  readonly centre: Vector3;
  readonly forward: Vector3;
  readonly right: Vector3;
}

/**
 * The model's feet, height and centre line in the world, from the vertex buffer of its cloth: in
 * VRoid files that is the whole body (skin, cloth, short hair). Other meshes, the face, may sit
 * elsewhere in their bind space and only reach the head through their bones.
 */
const frameOf = (meshes: readonly Mesh[], body: TransformNode): Frame | null => {
  let lo = Infinity;
  let hi = -Infinity;
  const centre = Vector3.Zero();
  let n = 0;
  const p = Vector3.Zero();
  for (const m of meshes) {
    const pos = m.getVerticesData(VertexBuffer.PositionKind);
    if (!pos) continue;
    const w = m.computeWorldMatrix(true);
    for (let i = 0; i < pos.length; i += 3) {
      Vector3.TransformCoordinatesFromFloatsToRef(pos[i]!, pos[i + 1]!, pos[i + 2]!, w, p);
      lo = Math.min(lo, p.y);
      hi = Math.max(hi, p.y);
      centre.addInPlace(p);
      n++;
    }
  }
  if (n === 0 || hi - lo < 0.5) return null;
  centre.scaleInPlace(1 / n);
  body.computeWorldMatrix(true);
  const forward = body.getDirection(Vector3.Forward());
  forward.y = 0;
  forward.normalize();
  return { up: lo, height: hi - lo, centre, forward, right: Vector3.Cross(Vector3.Up(), forward).normalize() };
};

interface Shell {
  readonly positions: number[];
  readonly normals: number[];
  readonly indices: number[];
  readonly skin: Map<string, number[]>;
}

/** Copies the triangles of `src` the cut takes into `out`, in the space of `into` (the first cloth mesh). */
const copyCut = (src: Mesh, into: Mesh, f: Frame, cut: Cut, out: Shell): void => {
  const pos = src.getVerticesData(VertexBuffer.PositionKind);
  const nor = src.getVerticesData(VertexBuffer.NormalKind);
  const idx = src.getIndices();
  if (!pos || !nor || !idx) return;
  const world = src.computeWorldMatrix(true);
  const toInto = world.multiply(Matrix.Invert(into.computeWorldMatrix(true)));
  const skins = SKIN_KINDS.map((k) => [k, src.getVerticesData(k)] as const);
  const wp = (i: number) => Vector3.TransformCoordinatesFromFloatsToRef(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!, world, new Vector3());
  const inside = (p: Vector3): boolean => {
    const h = (p.y - f.up) / f.height;
    const x = Math.abs(Vector3.Dot(p.subtract(f.centre), f.right)) / f.height;
    if (h < cut.hem) return false;
    return h <= cut.bib ? x <= cut.halfWidth : strap(h, x);
  };
  const strap = (h: number, x: number): boolean => cut.straps !== undefined && h > cut.bib && h <= cut.straps.top && x >= cut.straps.inner && x <= cut.straps.outer;
  // Panels face out on their own side, front or back, and the straps up over the shoulders: never
  // the lining of a collar, whose normals point at the neck and would push the shell into it.
  const facesOut = (p: Vector3, n: Vector3): boolean => {
    const ahead = Vector3.Dot(n, f.forward);
    if (!cut.panels) return ahead >= cut.facing;
    const side = Vector3.Dot(p.subtract(f.centre), f.forward) < 0 ? -1 : 1;
    const over = strap((p.y - f.up) / f.height, Math.abs(Vector3.Dot(p.subtract(f.centre), f.right)) / f.height);
    return ahead * side >= cut.facing || (over && n.y >= cut.facing);
  };
  const taken = new Map<number, number>();
  const take = (i: number): number => {
    let j = taken.get(i);
    if (j !== undefined) return j;
    j = out.positions.length / 3;
    taken.set(i, j);
    const n = new Vector3(nor[i * 3]!, nor[i * 3 + 1]!, nor[i * 3 + 2]!);
    const p = new Vector3(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!).addInPlace(n.scale(cut.lift));
    const pi = Vector3.TransformCoordinates(p, toInto);
    const ni = Vector3.TransformNormal(n, toInto).normalize();
    out.positions.push(pi.x, pi.y, pi.z);
    out.normals.push(ni.x, ni.y, ni.z);
    for (const [kind, data] of skins) {
      if (!data) continue;
      const list = out.skin.get(kind) ?? [];
      out.skin.set(kind, list);
      for (let k = 0; k < 4; k++) list.push(data[i * 4 + k] ?? 0);
    }
    return j;
  };
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const [a, b, c] = [idx[t]!, idx[t + 1]!, idx[t + 2]!];
    const [pa, pb, pc] = [wp(a), wp(b), wp(c)];
    if (!inside(pa) || !inside(pb) || !inside(pc)) continue;
    const normal = Vector3.Cross(pb.subtract(pa), pc.subtract(pa));
    const length = normal.length();
    // Degenerate triangles out; facing by the vertex normal (the sense of the winding depends on the mirrored glTF root).
    const facing = Vector3.TransformNormal(new Vector3(nor[a * 3]!, nor[a * 3 + 1]!, nor[a * 3 + 2]!), world).normalize();
    if (length < 1e-9 || !facesOut(pa, facing)) continue;
    // Both windings: the apron takes the shared vertex-colour material, which culls back faces, and the
    // file's cloth may be double-sided under a mirrored root (glTF). The far copy hides in the body.
    out.indices.push(take(a), take(b), take(c), take(a), take(c), take(b));
  }
};

/** The ballistic vest over a dressed model's top in its own material (no vertex colour), or null when the model has none. */
export const buildPlate = (scene: Scene, name: string, meshes: readonly AbstractMesh[], body: TransformNode): Mesh | null =>
  buildShell(scene, name, meshes, body, null, PLATE);

/** The apron over a dressed model's cloth, or null when the model has no cloth to follow. */
export const buildApron = (scene: Scene, name: string, meshes: readonly AbstractMesh[], body: TransformNode, colour: string): Mesh | null =>
  buildShell(scene, name, meshes, body, colour, APRON);

/** The vest over a dressed model's top, or null when the model has none. */
export const buildVest = (scene: Scene, name: string, meshes: readonly AbstractMesh[], body: TransformNode, colour: string): Mesh | null =>
  buildShell(scene, name, meshes, body, colour, VEST);

const buildShell = (scene: Scene, name: string, meshes: readonly AbstractMesh[], body: TransformNode, colour: string | null, cut: Cut): Mesh | null => {
  const all = meshes.filter((m): m is Mesh => m instanceof MeshClass && m.getTotalVertices() > 0);
  const cloth = all.filter((m) => {
    const part = toonSourceOf(m)?.source.part;
    return (part === "torso" || (cut.legs && part === "legs")) && m.skeleton !== null;
  });
  const into = cloth[0];
  const frame = frameOf(cloth.slice(0, 1), body);
  if (!into || !frame) return null;
  const shell: Shell = { positions: [], normals: [], indices: [], skin: new Map() };
  for (const m of cloth) if (m.skeleton === into.skeleton) copyCut(m, into, frame, cut, shell);
  if (shell.indices.length === 0) return null;
  const apron = new MeshClass(name, scene);
  const data = new VertexData();
  data.positions = shell.positions;
  data.normals = shell.normals;
  data.indices = shell.indices;
  data.applyToMesh(apron);
  for (const [kind, list] of shell.skin) apron.setVerticesData(kind, list, false, 4);
  if (colour) {
    const c = Color3.FromHexString(colour);
    const colours: number[] = [];
    for (let i = 0; i < shell.positions.length / 3; i++) colours.push(c.r, c.g, c.b, 1);
    apron.setVerticesData(VertexBuffer.ColorKind, colours);
  }
  apron.skeleton = into.skeleton;
  apron.numBoneInfluencers = into.numBoneInfluencers;
  apron.parent = into.parent;
  apron.position.copyFrom(into.position);
  apron.rotationQuaternion = into.rotationQuaternion?.clone() ?? null;
  apron.rotation.copyFrom(into.rotation);
  apron.scaling.copyFrom(into.scaling);
  apron.isPickable = false;
  return apron;
};
