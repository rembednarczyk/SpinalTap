import { type Scene, TransformNode } from "../babylon";
import type { PresetName } from "../npr/presets";
import type { ToonMaterials } from "../npr/toon-material";
import type { CharacterRig } from "./character-rig";
import { skinCharacter } from "./character-skin";
import { type Joints, humanoid } from "./humanoid";
import { RigBuilder } from "./rig-builder";

interface Pistol {
  readonly hand: TransformNode;
  readonly hip: TransformNode;
  readonly boxes: readonly [TransformNode, TransformNode];
}

/**
 * A pistol twice over: one in the right hand (barrel along the forearm, grip towards the palm
 * side, so it points where the arm aims) and one in a holster on the right hip. Each sits on
 * its own bone; animation shows one and scales the other to zero.
 */
const pistol = (b: RigBuilder, sk: Joints, hipX: number, holster: PresetName, big = 1): Pistol => {
  const s = sk.s;
  const hand = b.node("gunHand", sk.elbowR, 0, -0.29 * s, 0.015);
  const hip = b.node("gunHip", sk.body, hipX, 0.9 * s, 0.025);
  // The boxes sit on their own bones so a mounted weapon model can hide them.
  const boxes = [b.node("gunHandBox", hand), b.node("gunHipBox", hip)] as const;
  for (const n of boxes) {
    b.box(0.034 * big, 0.17 * big, 0.05 * big, "gun", n, 0, -0.07 * big, 0);
    b.box(0.03 * big, 0.045 * big, 0.065 * big, "gun", n, 0, 0.005, -0.04 * big);
  }
  // Grip faces forward in the holster.
  hip.rotation.y = Math.PI;
  b.box(0.05 * big, 0.13 * big, 0.075 * big, holster, sk.body, hipX, 0.86 * s, 0.02);
  return { hand, hip, boxes };
};

const finish = (
  root: TransformNode,
  b: RigBuilder,
  sk: Joints,
  opts: { aiming: boolean; armSpread: number; leftHold?: [number, number]; gun?: Pistol },
): CharacterRig => {
  const { s: _s, ...joints } = sk;
  const order = [joints.body, joints.legL, joints.kneeL, joints.legR, joints.kneeR, joints.head, joints.armL, joints.elbowL, joints.armR, joints.elbowR];
  if (opts.gun) order.push(opts.gun.hand, opts.gun.hip, ...opts.gun.boxes);
  const meshes = skinCharacter(b, root, order);
  // After skinning: a zero scale in the bind pose would make the bind matrix singular.
  opts.gun?.hip.scaling.setAll(0);
  return {
    root,
    meshes,
    gunHand: opts.gun?.hand ?? null,
    gunHip: opts.gun?.hip ?? null,
    gunBoxes: opts.gun?.boxes ?? [],
    drawn: 1,
    drawTarget: true,
    aim: 0,
    aimHold: 0,
    reload: 0,
    reloadTotal: 0,
    melee: false,
    swing: null,
    guard: 0,
    stagger: 0,
    staggerTotal: 0,
    aiming: opts.aiming,
    armSpread: opts.armSpread,
    leftHold: opts.leftHold ?? null,
    phase: 0,
    stoop: 0,
    time: 0,
    flinch: 0,
    dying: null,
    lastAir: null,
    airBlend: 0,
    landing: 0,
    climbBlend: 0,
    climbPhase: 0,
    ...joints,
  };
};

/** Rotation that turns a lathe arc (or its opening) to face +Z. */
const arcFacingForward = (arc: number, opening: boolean): number => {
  const centre = opening ? (1 + arc) * Math.PI : arc * Math.PI;
  return centre - Math.PI / 2;
};

/** Seki: black wavy bob, black tank top, grey high-waisted trousers, cybernetic arms. */
export const buildHeroine = (scene: Scene, materials: ToonMaterials, name: string): CharacterRig => {
  const root = new TransformNode(name, scene);
  const b = new RigBuilder(scene, materials, name);
  const sk = humanoid(
    b,
    root,
    { height: 1.74, shoulder: 0.165, hip: 0.15, chest: 0.135, waist: 0.1, limb: 1, female: true },
    { skin: "skin", top: "sekiTop", bottom: "sekiPants", shoes: "sekiShoes", arms: "cyber" },
  );
  const s = sk.s;
  // Bob: a shell open at the face, then pointed locks around the hairline (sides and back)
  // and a few heavy bangs across the forehead. Pointed cones give the hand-drawn silhouette.
  const bob = b.lathe(
    [
      [0.001, 0.13],
      [0.06, 0.125],
      [0.092, 0.08],
      [0.098, 0.02],
      [0.1, -0.03],
      [0.098, -0.06],
    ].map(([r, y]) => [(r as number) * s, (y as number) * s] as const),
    "sekiHair",
    sk.head,
    { arc: 0.62, depth: 1.02, tessellation: 22 },
  );
  // A lathe arc covers angles [0, arc·2π] from +X towards +Z, and rotation.y by θ moves an
  // angle φ to φ − θ. The opening is centred at (1 + arc)·π; turn it to face forward (+Z, 90°).
  bob.rotation.y = arcFacingForward(0.62, true);
  const lockCount = 11;
  for (let i = 0; i < lockCount; i++) {
    // Angle measured from the face (+Z); locks cover 75°..285°, i.e. sides and back only.
    const fromFront = ((75 + (i / (lockCount - 1)) * 210) * Math.PI) / 180;
    const dx = Math.sin(fromFront);
    const dz = Math.cos(fromFront);
    const len = (0.1 + ((i * 37) % 5) * 0.012) * s;
    const lock = b.cylinder(len, 0, 0.055 * s, "sekiHair", sk.head, dx * 0.088 * s, -0.06 * s - len / 2 + 0.02 * s, dz * 0.09 * s);
    // Tip points down and slightly outwards; alternate a little twist so the edge reads uneven.
    lock.rotation.set(-dz * 0.25, 0, dx * 0.25 + (i % 2 ? 0.08 : -0.08));
  }
  for (const [x, len, tilt] of [
    [-0.045, 0.06, 0.25],
    [-0.012, 0.07, 0.05],
    [0.025, 0.065, -0.2],
    [0.055, 0.05, -0.4],
  ] as const) {
    // Tips stop at the brows (y ≈ 0.045) so the eyes stay visible.
    const bang = b.cylinder(len * s, 0, 0.05 * s, "sekiHair", sk.head, x * s, (0.11 - len / 2) * s, 0.068 * s);
    bang.rotation.set(-0.3, 0, tilt);
  }
  // Optic line: the cybernetic eye glint.
  b.box(0.012, 0.012, 0.012, "heroineVisor", sk.head, 0.032 * s, 0.014 * s, 0.07 * s);
  const gun = pistol(b, sk, 0.165 * s, "cyberDark");
  return finish(root, b, sk, { aiming: true, armSpread: 0.07, gun });
};

export const buildFixer = (scene: Scene, materials: ToonMaterials, name: string): CharacterRig => {
  const root = new TransformNode(name, scene);
  const b = new RigBuilder(scene, materials, name);
  const sk = humanoid(
    b,
    root,
    { height: 1.88, shoulder: 0.23, hip: 0.17, chest: 0.19, waist: 0.17, limb: 1.25, female: false },
    { skin: "fixerSkin", top: "fixerJacket", bottom: "fixerPants", shoes: "shades", arms: "fixerJacket", face: false },
  );
  b.box(0.15, 0.035, 0.03, "shades", sk.head, 0, 0.015 * sk.s, 0.068 * sk.s);
  b.box(0.03, 0.006, 0.006, "lips", sk.head, 0, -0.045 * sk.s, 0.066 * sk.s);
  const chain = b.torus(0.26, 0.018, "gold", sk.body, 0, 1.44 * sk.s, 0.05);
  chain.rotation.x = 1.25;
  return finish(root, b, sk, { aiming: false, armSpread: 0.16 });
};

export const buildGanger = (scene: Scene, materials: ToonMaterials, name: string): CharacterRig => {
  const root = new TransformNode(name, scene);
  const b = new RigBuilder(scene, materials, name);
  const sk = humanoid(
    b,
    root,
    { height: 1.8, shoulder: 0.19, hip: 0.15, chest: 0.16, waist: 0.14, limb: 1.1, female: false },
    { skin: "skin", top: "gangerHood", bottom: "gangerPants", shoes: "gangerPants", arms: "gangerHood", face: false },
  );
  // Hood up, LED mask across the lower face.
  const hood = b.sphere(0.2 * sk.s, "gangerHood", sk.head, 0, 0.015, -0.015, [1, 1.05, 1.08]);
  hood.scaling.z = 1.05;
  b.box(0.13, 0.03, 0.03, "gangerMask", sk.head, 0, -0.02 * sk.s, 0.07 * sk.s);
  const gun = pistol(b, sk, 0.18 * sk.s, "gangerPants", 1.25);
  return finish(root, b, sk, { aiming: true, armSpread: 0.12, gun });
};

/** Tessen security (ADR-0024): broader, navy uniform, chest plate, helmet with a cyan visor strip. */
export const buildCorpo = (scene: Scene, materials: ToonMaterials, name: string): CharacterRig => {
  const root = new TransformNode(name, scene);
  const b = new RigBuilder(scene, materials, name);
  const sk = humanoid(
    b,
    root,
    { height: 1.84, shoulder: 0.22, hip: 0.16, chest: 0.19, waist: 0.16, limb: 1.12, female: false },
    { skin: "skin", top: "corpoUniform", bottom: "corpoUniform", shoes: "gangerPants", arms: "corpoUniform", face: false },
  );
  const helmet = b.sphere(0.205 * sk.s, "corpoPlate", sk.head, 0, 0.03, -0.01, [1, 0.9, 1.05]);
  helmet.scaling.z = 1.05;
  b.box(0.15, 0.028, 0.03, "corpoVisor", sk.head, 0, 0.02 * sk.s, 0.075 * sk.s);
  b.box(0.3, 0.26, 0.06, "corpoPlate", sk.body, 0, 1.36 * sk.s, 0.1);
  const gun = pistol(b, sk, 0.18 * sk.s, "corpoPlate", 1.25);
  return finish(root, b, sk, { aiming: true, armSpread: 0.14, gun });
};

/** Babcia Ume: small, long beige coat, grey bun, red umbrella (left at home indoors, ADR-0041). */
export const buildCivilian = (scene: Scene, materials: ToonMaterials, name: string, umbrella = true): CharacterRig => {
  const root = new TransformNode(name, scene);
  const b = new RigBuilder(scene, materials, name);
  const sk = humanoid(
    b,
    root,
    { height: 1.5, shoulder: 0.15, hip: 0.16, chest: 0.15, waist: 0.15, limb: 1.05, female: true },
    { skin: "skin", top: "umeCoat", bottom: "umeCoat", shoes: "sekiShoes", arms: "umeCoat", coat: "umeCoat" },
  );
  b.sphere(0.17 * sk.s, "umeHair", sk.head, 0, 0.03, -0.012, [1, 0.9, 1]);
  b.sphere(0.07, "umeHair", sk.head, 0, 0.1 * sk.s, -0.07 * sk.s);
  // Built in the neutral pose (forearm hanging): the pole runs down the forearm's axis and
  // the canopy sits above the hand once the hold pose raises the arm.
  // The pole continues the forearm past the hand (local -Y), the canopy's apex points the same
  // way. The hold pose bends the elbow up, which turns local -Y skywards.
  const fore = 0.26 * sk.s;
  if (umbrella) {
    b.cylinder(0.95, 0.02, 0.02, "pole", sk.elbowL, 0, -fore - 0.42, 0);
    b.cylinder(0.28, 1.15, 0, "umbrella", sk.elbowL, 0, -fore - 0.95, 0);
  }
  const rig = finish(root, b, sk, umbrella ? { aiming: false, armSpread: 0.1, leftHold: [-0.45, -2.35] } : { aiming: false, armSpread: 0.1 });
  rig.stoop = rig.body.rotation.x = 0.08;
  return rig;
};

/** Doktor Mori: cream surgical coat, white hair combed back, magnifier goggles. */
export const buildRipperdoc = (scene: Scene, materials: ToonMaterials, name: string): CharacterRig => {
  const root = new TransformNode(name, scene);
  const b = new RigBuilder(scene, materials, name);
  const sk = humanoid(
    b,
    root,
    { height: 1.72, shoulder: 0.18, hip: 0.15, chest: 0.16, waist: 0.15, limb: 1.05, female: false },
    { skin: "fixerSkin", top: "moriCoat", bottom: "fixerPants", shoes: "shades", arms: "moriCoat", coat: "moriCoat", face: false },
  );
  b.lathe(
    [
      [0.001, -0.02],
      [0.07, 0.0],
      [0.08, 0.06],
      [0.06, 0.11],
      [0.001, 0.125],
    ].map(([r, y]) => [(r as number) * sk.s, (y as number) * sk.s] as const),
    "moriHair",
    sk.head,
    { z: -0.012, depth: 1.05 },
  );
  b.box(0.13, 0.03, 0.03, "docGoggles", sk.head, 0, 0.018 * sk.s, 0.07 * sk.s);
  const rig = finish(root, b, sk, { aiming: false, armSpread: 0.12 });
  // Poses go on after skinning: the bind pose must stay neutral.
  rig.stoop = rig.body.rotation.x = 0.1;
  return rig;
};
