import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { AppearanceDescriptor, EntityId, Transform } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AbstractMesh, Scene, Vector3, VertexBuffer } from "../src/babylon";
import type { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { setWeaponDrawn } from "../src/renderer/character-animation";
import { type CharacterDescriptor, CharacterViews } from "../src/renderer/character-views";
import { type CharacterModelManifest, toonSourceOf } from "../src/renderer/model-library";
import { readModelFile, serveModels } from "./game-models";

const GAME = JSON.parse(new TextDecoder().decode(readModelFile("manifest.json"))) as CharacterModelManifest;

const STAND: Transform = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 };

const VEST: AppearanceDescriptor = {
  weapons: { primary: "rifle", secondary: "pistol", melee: null, active: "secondary" },
  garments: { torso: { tint: "vest", attachments: [{ point: "chest", mesh: "vest-plate" }] } },
  implants: [],
};

const viewsOn = (scene: Scene) =>
  new CharacterViews({
    scene,
    materials: new ToonMaterials(scene),
    shadow: { addCaster: () => undefined } as unknown as MoonShadow,
    camera: { camera: { position: new Vector3(2, 1.6, 2) }, handsBusy: false, setHeldWeapon: () => undefined, setPlaceholders: () => undefined } as unknown as CameraRig,
    cameraTarget: () => 1,
    lift: () => 0,
  });

const settled = async (views: CharacterViews) => {
  for (let i = 0; i < 4000 && views.modelCounts.loading > 0; i++) await new Promise((ok) => setTimeout(ok, 0));
  expect(views.modelCounts.loading).toBe(0);
};

/** World positions of a mesh's vertices as the GPU skins them now. */
const skinned = (m: AbstractMesh): Vector3[] => {
  m.skeleton?.prepare(true);
  const data = m.getPositionData(true, true) ?? [];
  const world = m.computeWorldMatrix(true);
  const out: Vector3[] = [];
  for (let i = 0; i < data.length; i += 3) out.push(Vector3.TransformCoordinates(new Vector3(data[i]!, data[i + 1]!, data[i + 2]!), world));
  return out;
};

/** A triangle of the vest in the character's frame: across (u), up (v) and out from the vest's middle (d). */
type Tri = readonly (readonly [number, number, number])[];

/** How far out the vest's outermost face over (u, v) lies, or null where it does not cover. */
const depthAt = (tris: readonly Tri[], u: number, v: number): number | null => {
  let best: number | null = null;
  for (const [[u0, v0, d0], [u1, v1, d1], [u2, v2, d2]] of tris as [Tri[0], Tri[0], Tri[0]][]) {
    const det = (v1 - v2) * (u0 - u2) + (u2 - u1) * (v0 - v2);
    if (Math.abs(det) < 1e-12) continue;
    const l0 = ((v1 - v2) * (u - u2) + (u2 - u1) * (v - v2)) / det;
    const l1 = ((v2 - v0) * (u - u2) + (u0 - u2) * (v - v2)) / det;
    const l2 = 1 - l0 - l1;
    if (l0 < 0 || l1 < 0 || l2 < 0) continue;
    const d = l0 * d0 + l1 * d1 + l2 * d2;
    if (best === null || d > best) best = d;
  }
  return best;
};

/**
 * Bones of the chest, the shoulders and the neck, under the vest. Not the arms, which may lie ahead
 * of the chest in a pose, nor the hips, which a crouch leaning forward puts behind the back plate.
 */
const TRUNK = /spine|chest|bust|shoulder|neck/i;

/**
 * Vertices of the model's skin and top on the trunk's bones that stand out of the vest's front, or
 * of its back, where the vest covers them, 2 mm or more; `covered` counts all that it covers, front and back.
 */
const piercing = (scene: Scene, id: EntityId, views: CharacterViews): { count: number; worst: number; covered: number[] } => {
  const vest = scene.getMeshByName(`e${id}-vest-plate`)!;
  const body = views.rigOf(id)!.body;
  body.computeWorldMatrix(true);
  const fwd = body.getDirection(Vector3.Forward());
  fwd.y = 0;
  fwd.normalize();
  const right = Vector3.Cross(Vector3.Up(), fwd).normalize();
  const vp = skinned(vest);
  const centre = vp.reduce((a, p) => a.addInPlace(p), Vector3.Zero()).scaleInPlace(1 / vp.length);
  const at = (p: Vector3): [number, number, number] => [Vector3.Dot(p.subtract(centre), right), p.y, Vector3.Dot(p.subtract(centre), fwd)];
  const sides: Tri[][] = [[], []];
  const vi = vest.getIndices()!;
  for (let t = 0; t + 2 < vi.length; t += 3) {
    const [a, b, c] = [vp[vi[t]!]!, vp[vi[t + 1]!]!, vp[vi[t + 2]!]!];
    const n = Vector3.Cross(b.subtract(a), c.subtract(a));
    if (n.length() < 1e-12 || Math.abs(Vector3.Dot(n.normalize(), fwd)) < 0.3) continue;
    const tri = [at(a), at(b), at(c)];
    const back = tri[0]![2] + tri[1]![2] + tri[2]![2] < 0;
    sides[back ? 1 : 0]!.push(back ? tri.map(([u, v, d]) => [u, v, -d] as const) : tri);
  }
  let count = 0;
  let worst = 0;
  const covered = [0, 0];
  const meshes = scene.meshes.filter((m) => m.name.startsWith(`e${id}-m-`) && ["skin", "torso"].includes(toonSourceOf(m)?.source.part ?? ""));
  for (const m of meshes) {
    const pos = skinned(m);
    const bones = m.skeleton!.bones;
    const mi = m.getVerticesData(VertexBuffer.MatricesIndicesKind)!;
    const mw = m.getVerticesData(VertexBuffer.MatricesWeightsKind)!;
    for (const i of new Set(m.getIndices() ?? [])) {
      let top = 0;
      for (let k = 1; k < 4; k++) if (mw[i * 4 + k]! > mw[i * 4 + top]!) top = k;
      if (!TRUNK.test(bones[mi[i * 4 + top]!]?.name ?? "")) continue;
      const [u, v, d] = at(pos[i]!);
      const side = d > 0 ? 0 : 1;
      const dv = depthAt(sides[side]!, u, v);
      if (dv === null) continue;
      covered[side]!++;
      const out = Math.abs(d) - dv;
      if (out > 0.002) count++;
      worst = Math.max(worst, out);
    }
  }
  return { count, worst, covered };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the ballistic vest on a model (G-870)", () => {
  it("is a plate carrier of the model's own top, over the bust and the cloth at rest, aiming, running and crouched", async () => {
    serveModels();
    const scene = new Scene(new NullEngine());
    const views = viewsOn(scene);
    // Seki (a VRoid woman), and two men of other files: a ganger, and a guard on Kaito's file.
    views.setCharacterModels({ ...GAME, pools: { ...GAME.pools, corpo: [{ url: "kaito.vrm", scale: 1.03 }] } });
    const who: [EntityId, CharacterDescriptor][] = [
      [1, { kind: "heroine" }],
      [2, { kind: "enemy", preset: "ganger" }],
      [3, { kind: "enemy", preset: "corpo", look: 1 }],
    ];
    for (const [id, d] of who) {
      views.spawn(id, d, STAND);
      views.setAppearance(id, VEST);
    }
    await settled(views);
    const poses: [string, Transform][] = [
      ["rest", STAND],
      ["aim", { ...STAND, aim: 1 }],
      ["run", { ...STAND, speed: 5 }],
      ["crouch", { ...STAND, crouch: 1, speed: 1.5 }],
    ];
    for (const [name, t] of poses) {
      for (const [id] of who) {
        setWeaponDrawn(views.rigOf(id)!, name === "aim");
        views.move(id, t);
      }
      for (let i = 0; i < 40; i++) views.update(1 / 60);
      for (const [id] of who) {
        const p = piercing(scene, id, views);
        // A box on the chest bone: 272 of Seki's 505 covered vertices out by up to 3.3 cm.
        expect(p.count, `e${id} ${name}: ${p.count} through, up to ${(p.worst * 100).toFixed(1)} cm`).toBe(0);
        expect(Math.min(...p.covered), `e${id} ${name}: front and back`).toBeGreaterThan(100);
      }
    }
    // Skinned with the model, not hung on a bone.
    for (const [id] of who) expect(scene.getMeshByName(`e${id}-vest-plate`)!.skeleton, `e${id}`).not.toBeNull();
  });
});
