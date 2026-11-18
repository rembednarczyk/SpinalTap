import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { ARM_POINTS, type ArmPoint, type BodyClip, type BodyMode, type HipsFrom, type Quat, bodyClipsModule, toBodyClip } from "./body-math.ts";
import { LEG_JOINTS, type LegClip, type LegJoint, legClipsModule, mirrored, toLegClip } from "./clip-math.ts";

/*
 * `node tools/animations/src/import.ts <dir>`: reads the clips of `manifest.json` from `<dir>` (the
 * packs unzipped under their names) and writes the engine's leg and body tables. Mixamo's frame is
 * right handed with the character facing +Z and its left at +X; the rig's left is -X, so x turns
 * over, and a rotation's y and z with it.
 */

const POINTS: Readonly<Record<LegJoint | ArmPoint | "hips" | "neck", string>> = {
  hips: "Hips",
  neck: "Neck",
  hipL: "LeftUpLeg",
  kneeL: "LeftLeg",
  ankleL: "LeftFoot",
  toeL: "LeftToeBase",
  hipR: "RightUpLeg",
  kneeR: "RightLeg",
  ankleR: "RightFoot",
  toeR: "RightToeBase",
  shoulderL: "LeftArm",
  elbowL: "LeftForeArm",
  wristL: "LeftHand",
  fingerL: "LeftHandMiddle1",
  shoulderR: "RightArm",
  elbowR: "RightForeArm",
  wristR: "RightHand",
  fingerR: "RightHandMiddle1",
};
const TURNS = { head: "Head" } as const;

interface Sampled {
  readonly cycle: number;
  readonly frames: number;
  readonly paths: ReadonlyMap<string, readonly number[]>;
  readonly turns: Readonly<Record<keyof typeof TURNS, readonly number[]>>;
  readonly hipsEnd: readonly [number, number, number];
  /** Each point in the bind pose. */
  readonly bind: ReadonlyMap<string, readonly number[]>;
}

const sample = (file: string, fps: number, turned = false): Sampled => {
  const buf = readFileSync(file);
  const group = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "");
  const clip = group.animations[0];
  if (!clip) throw new Error(`no animation in ${file}`);
  const nodes = new Map<string, THREE.Object3D>();
  const names = { ...POINTS, ...TURNS };
  group.traverse((o) => {
    for (const [k, n] of Object.entries(names)) if (o.name === `mixamorig${n}`) nodes.set(k, o);
  });
  const node = (k: string): THREE.Object3D => {
    const n = nodes.get(k);
    if (!n) throw new Error(`no ${k} in ${file}`);
    return n;
  };
  // Loaded, the skeleton stands in the bind pose; its rotations are what a turn is counted from.
  group.updateMatrixWorld(true);
  const q = new THREE.Quaternion();
  const bind = Object.fromEntries(Object.keys(TURNS).map((k) => [k, node(k).getWorldQuaternion(new THREE.Quaternion()).invert()])) as Record<keyof typeof TURNS, THREE.Quaternion>;
  const mixer = new THREE.AnimationMixer(group);
  mixer.clipAction(clip).play();
  const frames = Math.max(1, Math.round(clip.duration * fps));
  const paths = new Map<string, number[]>(Object.keys(POINTS).map((k) => [k, []]));
  const turns = { head: [] as number[] };
  const v = new THREE.Vector3();
  const pose = (t: number) => {
    mixer.setTime(t);
    group.updateMatrixWorld(true);
  };
  // Turned round, x and z both change sign: with the mirror, only z.
  const where = (k: string): [number, number, number] => {
    node(k).getWorldPosition(v);
    return turned ? [v.x, v.y, -v.z] : [-v.x, v.y, v.z];
  };
  // The bind pose faces +Z in every file: it is not turned.
  const bindAt = new Map<string, readonly number[]>(Object.keys(POINTS).map((k) => {
    node(k).getWorldPosition(v);
    return [k, [-v.x, v.y, v.z]];
  }));
  const turn = (k: keyof typeof TURNS): Quat => {
    node(k).getWorldQuaternion(q).multiply(bind[k]);
    // Turned round: half a turn about +Y before (y, w) = (w, -y) and the rest likewise.
    if (turned) q.premultiply(new THREE.Quaternion(0, 1, 0, 0));
    return [q.x, -q.y, -q.z, q.w];
  };
  for (let f = 0; f < frames; f++) {
    pose((f * clip.duration) / frames);
    for (const k of Object.keys(POINTS)) paths.get(k)!.push(...where(k));
    for (const k of Object.keys(TURNS) as (keyof typeof TURNS)[]) turns[k].push(...turn(k));
  }
  pose(clip.duration - 1e-4);
  return { cycle: clip.duration, frames, paths, turns, hipsEnd: where("hips"), bind: bindAt };
};

const pick = <K extends string>(s: Sampled, keys: readonly K[]): Record<K, readonly number[]> => Object.fromEntries(keys.map((k) => [k, s.paths.get(k)!])) as Record<K, readonly number[]>;

const dir = process.argv[2];
if (!dir) throw new Error("usage: node tools/animations/src/import.ts <dir with the unzipped packs>");
type Source = string | { readonly file: string; readonly mirror: boolean };
type BodySource = { readonly file: string; readonly mode: BodyMode; readonly fps?: number; readonly turn?: boolean; readonly hipsFrom?: HipsFrom };
const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8")) as { clips: Record<string, Source>; body: Record<string, BodySource> };

const legs: Record<string, LegClip> = {};
const legSources: Record<string, string> = {};
for (const [name, src] of Object.entries(manifest.clips)) {
  const file = typeof src === "string" ? src : src.file;
  const s = sample(join(dir, file), 30);
  const raw = { cycle: s.cycle, frames: s.frames, hips: s.paths.get("hips")!, joints: pick(s, LEG_JOINTS), hipsEnd: s.hipsEnd };
  const mirror = typeof src !== "string" && src.mirror;
  legs[name] = toLegClip(mirror ? mirrored(raw) : raw);
  legSources[name] = mirror ? `${file} (mirrored)` : file;
}
const body: Record<string, BodyClip> = {};
const bodySources: Record<string, string> = {};
for (const [name, src] of Object.entries(manifest.body)) {
  const s = sample(join(dir, src.file), src.fps ?? 30, src.turn ?? false);
  const bind = { hips: s.bind.get("hips")!, neck: s.bind.get("neck")!, shoulderL: s.bind.get("shoulderL")!, shoulderR: s.bind.get("shoulderR")! };
  const raw = { cycle: s.cycle, frames: s.frames, hips: s.paths.get("hips")!, neck: s.paths.get("neck")!, bind, head: s.turns.head, arms: pick(s, ARM_POINTS), legs: pick(s, LEG_JOINTS) };
  body[name] = toBodyClip(raw, src.mode, src.hipsFrom);
  bodySources[name] = src.file;
}
const out = (f: string) => new URL(`../../../packages/engine/src/renderer/clips/${f}`, import.meta.url);
writeFileSync(out("leg-clips.generated.ts"), legClipsModule(legs, legSources));
writeFileSync(out("body-clips.generated.ts"), bodyClipsModule(body, bodySources));
console.log(Object.entries(legs).map(([k, c]) => `${k}: ${c.frames} frames, ${c.cycle} s, stride ${c.stride.x},${c.stride.z}`).join("\n"));
console.log(Object.entries(body).map(([k, c]) => `${k}: ${c.frames} frames, ${c.cycle} s`).join("\n"));
