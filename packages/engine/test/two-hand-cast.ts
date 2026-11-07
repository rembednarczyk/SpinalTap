import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { AppearanceDescriptor, WeaponLook } from "@seki/core";
import { type AbstractMesh, Scene, type TransformNode, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterModels } from "../src/renderer/character-models";
import { type CharacterRig, animateRig, buildGanger, buildHeroine, setWeaponDrawn } from "../src/renderer/characters";
import { Loadouts } from "../src/renderer/loadout";
import type { CharacterModelKey } from "../src/renderer/model-library";
import { ModelLibrary } from "../src/renderer/model-library";
import { WeaponMounts } from "../src/renderer/weapon-mount";
import { characterUrl } from "./body-geometry";
import { worldOf } from "./t-pose";
import { allWeaponUrls } from "./weapon-files";

/* A character dressed in a real VRM (or the bare rig) with a gun drawn, for the two-handed hold tests (G-282). */

export type Long = "rifle" | "shotgun" | "smg";

/**
 * Points of each long gun's file (metres, muzzle +X, top +Y), read off the meshes' cross-sections:
 * the bottom of the fore-end where the left palm goes, the middle of the grip the right hand
 * closes on, and the middle of the butt plate (the SMG has no stock).
 */
export const POINTS: Readonly<Record<Long, { fore: [number, number]; grip: [number, number]; butt: [number, number] | null }>> = {
  rifle: { fore: [0.085, 0.048], grip: [-0.15, -0.045], butt: [-0.4, 0.03] },
  shotgun: { fore: [0.17, 0.003], grip: [-0.19, -0.005], butt: [-0.37, -0.05] },
  smg: { fore: [0.07, 0.057], grip: [-0.15, -0.04], butt: null },
};
export const LONG: readonly Long[] = ["rifle", "shotgun", "smg"];

/** Middle of each gun's grip (file frame), where a closed hand's fingers end up round it. */
export const GRIP_MIDDLE: Readonly<Record<Long | "pistol" | "revolver", [number, number]>> = {
  pistol: [-0.085, -0.03],
  revolver: [-0.115, -0.04],
  rifle: POINTS.rifle.grip,
  shotgun: POINTS.shotgun.grip,
  smg: POINTS.smg.grip,
};

/** The models of the cast that carry long guns, at the game's manifest scale. */
const MODELS: Readonly<Partial<Record<CharacterModelKey, { file: string; scale: number }>>> = {
  heroine: { file: "seki.vrm", scale: 1.15 },
  ganger: { file: "ganger.vrm", scale: 1.07 },
};

const look = (active: WeaponLook): AppearanceDescriptor => ({
  weapons: { primary: active === "pistol" ? "rifle" : active, secondary: "pistol", melee: null, active: active === "pistol" ? "secondary" : "primary" },
  garments: {},
  implants: [],
});

export interface Cast {
  readonly scene: Scene;
  readonly rig: CharacterRig;
  readonly loadouts: Loadouts;
  readonly models: CharacterModels;
  /** The dressed model's meshes and bones, or null for the bare procedural rig. */
  readonly meshes: readonly AbstractMesh[] | null;
  bone(name: string): TransformNode;
}

export const until = async (done: () => boolean): Promise<void> => {
  for (let i = 0; i < 400 && !done(); i++) await new Promise((r) => setTimeout(r, 5));
  if (!done()) throw new Error("timed out");
};

export const cast = async (who: CharacterModelKey | null): Promise<Cast> => {
  const scene = new Scene(new NullEngine());
  const materials = new ToonMaterials(scene);
  const library = new ModelLibrary(scene, materials);
  const loadouts = new Loadouts(scene, materials, new WeaponMounts(library, allWeaponUrls()), () => {});
  const models = new CharacterModels({ library, loadouts, addCaster: () => {} });
  const rig = who === "ganger" ? buildGanger(scene, materials, "c") : buildHeroine(scene, materials, "c");
  const spec = who ? MODELS[who] : undefined;
  if (who && spec) {
    models.setManifest({ [who]: { url: characterUrl(spec.file), scale: spec.scale } });
    models.dress(rig, { fallback: who }, "c");
    await until(() => models.loadingCount === 0);
  }
  const dressed = models.of(rig);
  const nodes = (dressed?.model.root.getDescendants(false) ?? []) as TransformNode[];
  const bone = (name: string) => {
    const n = nodes.find((x) => x.name.endsWith(`J_Bip_${name}`));
    if (!n) throw new Error(`no bone ${name}`);
    return n;
  };
  return { scene, rig, loadouts, models, meshes: dressed?.model.meshes ?? null, bone };
};

/** The drawn gun in the character's hands (whatever node it hangs from). */
export const heldGun = (c: Cast, kind: WeaponLook): AbstractMesh | undefined =>
  c.scene.meshes.find((m) => m.getTotalVertices() > 0 && m.isEnabled() && m.name.startsWith("c-") && m.name.includes(`-${kind}-`) && !/-(back|hip|hipL)-/.test(m.name));

export const arm = async (c: Cast, kind: WeaponLook): Promise<void> => {
  c.loadouts.set(c.rig, look(kind), "c");
  setWeaponDrawn(c.rig, true);
  c.rig.drawn = 1;
  c.loadouts.update(c.rig);
  await until(() => {
    c.loadouts.update(c.rig);
    return heldGun(c, kind) !== undefined;
  });
};

/** Plays a second of the pose, then lays the model over the rig and the gun where it is held. */
export const pose = (c: Cast, aim: number, crouch = 0, speed = 0): void => {
  for (let i = 0; i < 30; i++) {
    animateRig(c.rig, speed, 1 / 30, crouch, { aim });
    c.models.update(1 / 30, i / 30);
    c.loadouts.update(c.rig);
  }
};

/** Centre of a hand: halfway from the wrist to the middle knuckle (on the rig, the box hand). */
export const palmOf = (c: Cast, side: "L" | "R"): Vector3 => {
  if (c.meshes) return worldOf(c.bone(`${side}_Hand`)).add(worldOf(c.bone(`${side}_Middle1`))).scale(0.5);
  // The box hand hangs 0.045 m (at the reference size) past the wrist, on the wrist or else the elbow.
  const s = c.rig.head.position.y / 1.6;
  const wrist = (c.rig as { wristL?: TransformNode; wristR?: TransformNode })[`wrist${side}`];
  const holder = wrist ?? (side === "L" ? c.rig.elbowL : c.rig.elbowR);
  worldOf(holder);
  return Vector3.TransformCoordinates(new Vector3(0, -(wrist ? 0.045 : 0.305) * s, 0), holder.getWorldMatrix());
};

/** Face, torso, shoulders and arms down to the wrists: what a held gun must not pass through. */
export const BODY = /(Hips|Spine|Chest|Neck|Head|Shoulder|UpperArm|LowerArm)/;
