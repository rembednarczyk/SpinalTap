import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { LEG_JOINTS, type LegClip, type LegJoint, type RawClip, legClipsModule, mirrored, toLegClip } from "./clip-math.ts";

/*
 * `node tools/animations/src/import.ts <dir>`: reads the clips of `manifest.json` from `<dir>` (the
 * packs unzipped under their names) and writes the engine's leg table. Mixamo's frame is right
 * handed with the character facing +Z and its left at +X; the rig's left is -X, so x turns over.
 */

const MIXAMO: Readonly<Record<LegJoint | "hips", string>> = {
  hips: "Hips",
  hipL: "LeftUpLeg",
  kneeL: "LeftLeg",
  ankleL: "LeftFoot",
  toeL: "LeftToeBase",
  hipR: "RightUpLeg",
  kneeR: "RightLeg",
  ankleR: "RightFoot",
  toeR: "RightToeBase",
};
const FPS = 30;

const sample = (file: string): RawClip => {
  const buf = readFileSync(file);
  const group = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "");
  const clip = group.animations[0];
  if (!clip) throw new Error(`no animation in ${file}`);
  const nodes = new Map<string, THREE.Object3D>();
  group.traverse((o) => {
    for (const [k, n] of Object.entries(MIXAMO)) if (o.name === `mixamorig${n}`) nodes.set(k, o);
  });
  const mixer = new THREE.AnimationMixer(group);
  mixer.clipAction(clip).play();
  const frames = Math.max(1, Math.round(clip.duration * FPS));
  const paths = new Map<string, number[]>(Object.keys(MIXAMO).map((k) => [k, []]));
  const v = new THREE.Vector3();
  const pose = (t: number) => {
    mixer.setTime(t);
    group.updateMatrixWorld(true);
  };
  const where = (k: string): [number, number, number] => {
    const n = nodes.get(k);
    if (!n) throw new Error(`no ${k} in ${file}`);
    n.getWorldPosition(v);
    return [-v.x, v.y, v.z];
  };
  for (let f = 0; f < frames; f++) {
    pose((f * clip.duration) / frames);
    for (const k of Object.keys(MIXAMO)) paths.get(k)!.push(...where(k));
  }
  pose(clip.duration - 1e-4);
  const hipsEnd = where("hips");
  const joints = Object.fromEntries(LEG_JOINTS.map((j) => [j, paths.get(j)!])) as Record<LegJoint, number[]>;
  return { cycle: clip.duration, frames, hips: paths.get("hips")!, joints, hipsEnd };
};

const dir = process.argv[2];
if (!dir) throw new Error("usage: node tools/animations/src/import.ts <dir with the unzipped packs>");
type Source = string | { readonly file: string; readonly mirror: boolean };
const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8")) as { clips: Record<string, Source> };
const clips: Record<string, LegClip> = {};
const sources: Record<string, string> = {};
for (const [name, src] of Object.entries(manifest.clips)) {
  const file = typeof src === "string" ? src : src.file;
  const raw = sample(join(dir, file));
  const mirror = typeof src !== "string" && src.mirror;
  clips[name] = toLegClip(mirror ? mirrored(raw) : raw);
  sources[name] = mirror ? `${file} (mirrored)` : file;
}
const out = new URL("../../../packages/engine/src/renderer/clips/leg-clips.generated.ts", import.meta.url);
writeFileSync(out, legClipsModule(clips, sources));
console.log(Object.entries(clips).map(([k, c]) => `${k}: ${c.frames} frames, ${c.cycle} s, stride ${c.stride.x},${c.stride.z}`).join("\n"));
