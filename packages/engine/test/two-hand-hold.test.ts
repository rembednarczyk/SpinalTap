import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { AppearanceDescriptor, WeaponLook } from "@seki/core";
import { beforeAll, describe, expect, it } from "vitest";
import { type AbstractMesh, Matrix, Scene, type TransformNode, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterModels } from "../src/renderer/character-models";
import { type CharacterRig, animateRig, buildGanger, buildHeroine, setWeaponDrawn } from "../src/renderer/characters";
import { Loadouts } from "../src/renderer/loadout";
import type { CharacterModelKey } from "../src/renderer/model-library";
import { ModelLibrary } from "../src/renderer/model-library";
import { WeaponMounts } from "../src/renderer/weapon-mount";
import { type BodyVertex, characterUrl, gunShape, insideGun, onGun, skinnedBody } from "./body-geometry";
import { worldOf } from "./t-pose";
import { allWeaponUrls } from "./weapon-files";

type Long = "rifle" | "shotgun" | "smg";

/**
 * Points of each long gun's file (metres, muzzle +X, top +Y), read off the meshes' cross-sections:
 * the bottom of the fore-end where the left palm goes, the middle of the grip the right hand
 * closes on, and the middle of the butt plate (the SMG has no stock).
 */
const POINTS: Readonly<Record<Long, { fore: [number, number]; grip: [number, number]; butt: [number, number] | null }>> = {
  rifle: { fore: [0.085, 0.048], grip: [-0.15, -0.045], butt: [-0.4, 0.03] },
  shotgun: { fore: [0.17, 0.003], grip: [-0.19, -0.005], butt: [-0.37, -0.05] },
  smg: { fore: [0.07, 0.057], grip: [-0.15, -0.04], butt: null },
};
const LONG: readonly Long[] = ["rifle", "shotgun", "smg"];

/** Middle of each gun's grip (file frame), where a closed hand's fingers end up round it. */
const GRIP_MIDDLE: Readonly<Record<Long | "pistol" | "revolver", [number, number]>> = {
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

interface Cast {
  readonly scene: Scene;
  readonly rig: CharacterRig;
  readonly loadouts: Loadouts;
  readonly models: CharacterModels;
  /** The dressed model's meshes and bones, or null for the bare procedural rig. */
  readonly meshes: readonly AbstractMesh[] | null;
  bone(name: string): TransformNode;
}

const until = async (done: () => boolean): Promise<void> => {
  for (let i = 0; i < 400 && !done(); i++) await new Promise((r) => setTimeout(r, 5));
  if (!done()) throw new Error("timed out");
};

const cast = async (who: CharacterModelKey | null): Promise<Cast> => {
  const scene = new Scene(new NullEngine());
  const materials = new ToonMaterials(scene);
  const library = new ModelLibrary(scene, materials);
  const loadouts = new Loadouts(scene, materials, new WeaponMounts(library, allWeaponUrls()), () => {});
  const models = new CharacterModels({ library, loadouts, addCaster: () => {} });
  const rig = who === "ganger" ? buildGanger(scene, materials, "c") : buildHeroine(scene, materials, "c");
  const spec = who ? MODELS[who] : undefined;
  if (who && spec) {
    models.setManifest({ [who]: { url: characterUrl(spec.file), scale: spec.scale } });
    models.dress(rig, who, "c");
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
const heldGun = (c: Cast, kind: WeaponLook): AbstractMesh | undefined =>
  c.scene.meshes.find((m) => m.getTotalVertices() > 0 && m.isEnabled() && m.name.startsWith("c-") && m.name.includes(`-${kind}-`) && !/-(back|hip|hipL)-/.test(m.name));

const arm = async (c: Cast, kind: WeaponLook): Promise<void> => {
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
const pose = (c: Cast, aim: number, crouch = 0, speed = 0): void => {
  for (let i = 0; i < 30; i++) {
    animateRig(c.rig, speed, 1 / 30, crouch, { aim });
    c.models.update(1 / 30, i / 30);
    c.loadouts.update(c.rig);
  }
};

/** Centre of a hand: halfway from the wrist to the middle knuckle (on the rig, the box hand). */
const palmOf = (c: Cast, side: "L" | "R"): Vector3 => {
  if (c.meshes) return worldOf(c.bone(`${side}_Hand`)).add(worldOf(c.bone(`${side}_Middle1`))).scale(0.5);
  // The box hand hangs 0.045 m (at the reference size) past the wrist, on the wrist or else the elbow.
  const s = c.rig.head.position.y / 1.6;
  const wrist = (c.rig as { wristL?: TransformNode; wristR?: TransformNode })[`wrist${side}`];
  const holder = wrist ?? (side === "L" ? c.rig.elbowL : c.rig.elbowR);
  worldOf(holder);
  return Vector3.TransformCoordinates(new Vector3(0, -(wrist ? 0.045 : 0.305) * s, 0), holder.getWorldMatrix());
};

const STANCES = [
  { name: "from the hip", aim: 0, crouch: 0, speed: 0 },
  { name: "aimed", aim: 1, crouch: 0, speed: 0 },
  { name: "walking from the hip", aim: 0, crouch: 0, speed: 2 },
  { name: "aimed in a crouch", aim: 1, crouch: 1, speed: 0 },
] as const;

/** Face, torso, shoulders and arms down to the wrists: what a held gun must not pass through. */
const BODY = /(Hips|Spine|Chest|Neck|Head|Shoulder|UpperArm|LowerArm)/;

describe.each([["heroine"], ["ganger"], [null]] as const)("long guns held in both hands (G-282): %s", (who) => {
  let c: Cast;
  beforeAll(async () => {
    c = await cast(who);
  }, 60_000);

  it.each(LONG)("%s: the left hand lies on the fore-end and the right on the grip", async (kind) => {
    await arm(c, kind);
    for (const st of STANCES) {
      pose(c, st.aim, st.crouch, st.speed);
      const gun = gunShape(heldGun(c, kind)!);
      const p = POINTS[kind];
      const left = Vector3.Distance(palmOf(c, "L"), onGun(gun, ...p.fore));
      const right = Vector3.Distance(palmOf(c, "R"), onGun(gun, ...p.grip));
      // Before: one hand held every gun; the left hung at the side, 0.4-0.6 m off the fore-end.
      expect(left, `${st.name}: left palm to fore-end`).toBeLessThan(0.05);
      expect(right, `${st.name}: right palm to grip`).toBeLessThan(0.05);
    }
  });

  it.each(["rifle", "shotgun"] as const)("%s: aimed, the butt sits at the right shoulder and the barrel points ahead", async (kind) => {
    await arm(c, kind);
    pose(c, 1);
    const gun = gunShape(heldGun(c, kind)!);
    const [bx, by] = POINTS[kind].butt!;
    const butt = onGun(gun, bx, by);
    const muzzle = onGun(gun, gun.max.x, 0);
    const shoulder = c.meshes ? worldOf(c.bone("R_UpperArm")) : worldOf(c.rig.armR);
    // Before: the butt hung 0.3-0.4 m ahead of the shoulder on a straight arm.
    expect(Vector3.Distance(butt, shoulder), "butt to shoulder joint").toBeLessThan(0.14);
    expect(butt.z, "butt in front of the shoulder").toBeGreaterThan(shoulder.z);
    expect(Math.abs(butt.y - shoulder.y), "butt at shoulder height").toBeLessThan(0.08);
    const barrel = muzzle.subtract(butt).normalize();
    expect(barrel.z, "barrel forward").toBeGreaterThan(0.95);
    if (c.meshes) {
      // In contact: the skin or cloth of the shoulder within a few centimetres of the butt plate.
      const near = Math.min(...skinnedBody(c.meshes).filter((v) => /UpperChest|Shoulder|UpperArm|Chest/.test(v.bone) && /_R_|_C_/.test(v.bone)).map((v) => Vector3.Distance(v.at, butt)));
      expect(near, "butt to the shoulder's surface").toBeLessThan(0.05);
    }
  });

  // Imported models only: the procedural rig has no skin to measure.
  if (who === null) return;

  it.each(LONG)("%s: the gun passes through neither the torso nor the arms", async (kind) => {
    await arm(c, kind);
    for (const st of STANCES) {
      pose(c, st.aim, st.crouch, st.speed);
      const gun = gunShape(heldGun(c, kind)!);
      const inverse = Matrix.Invert(gun.world);
      const body = skinnedBody(c.meshes!, /body|face/i).filter((v) => BODY.test(v.bone));
      const inside: BodyVertex[] = body.filter((v) => insideGun(gun, v.at, inverse, 0.004));
      expect(body.length).toBeGreaterThan(1000);
      const where = inside.slice(0, 8).map((v) => {
        const q = Vector3.TransformCoordinates(v.at, inverse);
        return `${v.bone}@${q.x.toFixed(3)},${q.y.toFixed(3)},${q.z.toFixed(3)}`;
      });
      expect([inside.length, ...where], `${st.name}: body vertices inside the gun`).toEqual([0]);
    }
  });

  it.each(["pistol", "revolver", ...LONG] as const)("%s: the right hand's fingers close round the grip", async (kind) => {
    await arm(c, kind);
    for (const aim of [0, 1]) {
      pose(c, aim);
      const grip = onGun(gunShape(heldGun(c, kind)!), ...GRIP_MIDDLE[kind]);
      const palm = palmOf(c, "R");
      // The way the right palm faces: across the knuckles (little to index) and along the hand.
      const along = worldOf(c.bone("R_Middle1")).subtract(worldOf(c.bone("R_Hand")));
      const across = worldOf(c.bone("R_Index1")).subtract(worldOf(c.bone("R_Little1")));
      const palmSide = Vector3.Cross(along, across).normalize();
      for (const finger of ["Thumb", "Index", "Middle", "Ring"]) {
        const tip = worldOf(c.bone(`R_${finger}3_end`));
        // Open (the model's bind pose) the tips stood 0.1-0.14 m off the grip.
        expect(Vector3.Distance(tip, grip), `aim ${aim}: ${finger} tip to the middle of the grip`).toBeLessThan(0.07);
        // Curled the wrong way they end up round the back of the hand.
        expect(Vector3.Dot(tip.subtract(palm), palmSide), `aim ${aim}: ${finger} tip on the palm side`).toBeGreaterThan(0);
      }
    }
  });
});
