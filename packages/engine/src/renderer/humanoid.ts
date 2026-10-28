import type { TransformNode } from "../babylon";
import type { PresetName } from "../npr/presets";
import type { RigBuilder } from "./rig-builder";

/** Body measurements in metres. Defaults describe Seki: tall, long-legged, anime proportions. */
export interface Build {
  readonly height: number;
  readonly shoulder: number;
  readonly hip: number;
  readonly chest: number;
  readonly waist: number;
  readonly limb: number;
  readonly female: boolean;
}

export interface Look {
  readonly skin: PresetName;
  readonly top: PresetName;
  readonly bottom: PresetName;
  readonly shoes: PresetName;
  /** Upper arm / forearm material; cyber arms add joints. */
  readonly arms: PresetName | "cyber";
  /** Long coat from chest to knees, in this material. */
  readonly coat?: PresetName;
  readonly face?: boolean;
}

export interface Joints {
  body: TransformNode;
  head: TransformNode;
  legL: TransformNode;
  legR: TransformNode;
  kneeL: TransformNode;
  kneeR: TransformNode;
  armL: TransformNode;
  armR: TransformNode;
  elbowL: TransformNode;
  elbowR: TransformNode;
  /** Scale factor relative to the 1.74 m reference build. */
  s: number;
}


interface Leg {
  readonly leg: TransformNode;
  readonly knee: TransformNode;
}
interface Arm {
  readonly arm: TransformNode;
  readonly elbow: TransformNode;
}

/** Legs: thigh on the hip pivot, shin on the knee pivot. */
const buildLegs = (b: RigBuilder, body: TransformNode, build: Build, look: Look, s: number): Leg[] => {
  const hipY = 0.92 * s;
  const thigh = 0.44 * s;
  const shin = 0.42 * s;
  const lr = build.limb;
  return ([-1, 1] as const).map((side) => {
    const leg = b.node(side < 0 ? "legL" : "legR", body, side * build.hip * 0.55, hipY, 0);
    b.lathe([[0.001, -thigh], [0.058 * lr, -thigh], [0.07 * lr, -thigh * 0.5], [0.082 * lr, -0.02], [0.001, 0.02]], look.bottom, leg, { depth: 0.95 });
    const knee = b.node(side < 0 ? "kneeL" : "kneeR", leg, 0, -thigh, 0);
    b.lathe([[0.001, -shin], [0.05 * lr, -shin], [0.056 * lr, -shin * 0.45], [0.06 * lr, 0], [0.001, 0.02]], look.bottom, knee, { depth: 0.95 });
    b.box(0.085 * lr, 0.07, 0.22 * s, look.shoes, knee, 0, -shin - 0.02, 0.045);
    return { leg, knee };
  });
};

/** Pelvis and torso: one profile from hips to the base of the neck, flattened front-to-back. */
const buildTorso = (b: RigBuilder, body: TransformNode, build: Build, look: Look, s: number): void => {
  const chestBump = build.female ? 1.08 : 1;
  b.lathe(
    [
      [0.001, 0.86 * s],
      [build.hip * 0.86, 0.88 * s],
      [build.hip, 0.95 * s],
      [build.waist, 1.08 * s],
      [build.chest * chestBump, 1.26 * s],
      [build.chest, 1.34 * s],
      [build.shoulder * 0.86, 1.42 * s],
      [build.shoulder * 0.55, 1.445 * s],
      [0.001, 1.45 * s],
    ],
    look.top,
    body,
    { depth: 0.68, tessellation: 20 },
  );
  // High-waisted trousers over the pelvis.
  b.lathe(
    [
      [0.001, 0.85 * s],
      [build.hip * 0.9, 0.86 * s],
      [build.hip * 1.04, 0.95 * s],
      [build.waist * 1.04, 1.1 * s],
      [0.001, 1.11 * s],
    ],
    look.bottom,
    body,
    { depth: 0.72, tessellation: 20 },
  );
  if (look.coat) {
    b.lathe(
      [
        [0.001, 0.46 * s],
        [build.hip * 1.35, 0.46 * s],
        [build.hip * 1.18, 0.9 * s],
        [build.waist * 1.12, 1.1 * s],
        [build.chest * 1.1, 1.3 * s],
        [build.shoulder * 0.92, 1.42 * s],
        [0.075, 1.5 * s],
        [0.001, 1.51 * s],
      ],
      look.coat,
      body,
      { depth: 0.74, tessellation: 20 },
    );
  }
};

/** Neck and head: egg-shaped skull, narrow jaw. */
const buildHead = (b: RigBuilder, body: TransformNode, look: Look, s: number): TransformNode => {
  b.cylinder(0.14 * s, 0.062, 0.078, look.skin, body, 0, 1.5 * s, 0);
  const head = b.node("head", body, 0, 1.6 * s, 0);
  b.lathe(
    [
      [0.001, -0.085],
      [0.035, -0.08],
      [0.062, -0.04],
      [0.074, 0.01],
      [0.072, 0.06],
      [0.05, 0.1],
      [0.001, 0.115],
    ].map(([r, y]) => [(r as number) * s, (y as number) * s] as const),
    look.skin,
    head,
    { depth: 0.92, tessellation: 18 },
  );
  if (look.face !== false) {
    // Anime face read at distance: two dark almond eyes, brows, small mouth.
    for (const side of [-1, 1]) {
      // Large almond eye tilted up at the outer corner, heavy upper lid line, thin brow.
      const eye = b.sphere(0.034 * s, "eyes", head, side * 0.03 * s, 0.01 * s, 0.063 * s, [1, 0.5, 0.18]);
      eye.rotation.z = side * 0.18;
      const lid = b.box(0.036 * s, 0.006 * s, 0.006, "eyes", head, side * 0.031 * s, 0.019 * s, 0.066 * s);
      lid.rotation.z = side * 0.2;
      const brow = b.box(0.03 * s, 0.004 * s, 0.005, "eyes", head, side * 0.031 * s, 0.042 * s, 0.066 * s);
      brow.rotation.z = -side * 0.12;
    }
    b.box(0.018 * s, 0.005 * s, 0.006, "lips", head, 0, -0.045 * s, 0.062 * s);
  }
  return head;
};

/** Ivory plates, copper joints, dark mechanical hands (see the clinic reference). */
const buildCyberArm = (b: RigBuilder, arm: TransformNode, elbow: TransformNode, upper: number, fore: number, lr: number, s: number): void => {
  b.sphere(0.1 * s, "cyberCopper", arm, 0, 0, 0);
  b.lathe([[0.001, -upper], [0.034 * lr, -upper], [0.043 * lr, -upper * 0.4], [0.047 * lr, -0.03], [0.001, 0]], "cyberIvory", arm);
  b.torus(0.075 * lr, 0.012, "cyberDark", arm, 0, -upper * 0.55, 0);
  b.sphere(0.07 * s, "cyberCopper", elbow, 0, 0, 0);
  b.lathe([[0.001, -fore], [0.028 * lr, -fore], [0.038 * lr, -fore * 0.35], [0.034 * lr, -0.02], [0.001, 0]], "cyberIvory", elbow);
  b.torus(0.06 * lr, 0.01, "cyberDark", elbow, 0, -fore * 0.5, 0);
  b.torus(0.058 * lr, 0.014, "cyberCopper", elbow, 0, -fore, 0);
  b.box(0.05 * lr, 0.085 * s, 0.03, "cyberDark", elbow, 0, -fore - 0.05 * s, 0);
};

/** Arms: upper arm on the shoulder, forearm on the elbow. */
const buildArms = (b: RigBuilder, body: TransformNode, build: Build, look: Look, s: number): Arm[] => {
  const lr = build.limb;
  const upper = 0.28 * s;
  const fore = 0.26 * s;
  return ([-1, 1] as const).map((side) => {
    const arm = b.node(side < 0 ? "armL" : "armR", body, side * build.shoulder * 1.02, 1.42 * s, 0);
    const elbow = b.node(side < 0 ? "elbowL" : "elbowR", arm, 0, -upper, 0);
    if (look.arms === "cyber") {
      buildCyberArm(b, arm, elbow, upper, fore, lr, s);
    } else {
      b.lathe([[0.001, -upper], [0.034 * lr, -upper], [0.042 * lr, -upper * 0.4], [0.048 * lr, -0.02], [0.001, 0.02]], look.arms, arm);
      b.lathe([[0.001, -fore], [0.028 * lr, -fore], [0.036 * lr, -fore * 0.4], [0.036 * lr, 0], [0.001, 0.01]], look.arms, elbow);
      b.box(0.048 * lr, 0.08 * s, 0.028, look.skin, elbow, 0, -fore - 0.045 * s, 0);
    }
    return { arm, elbow };
  });
};

/**
 * Jointed humanoid from surfaces of revolution: hips/knees and shoulders/elbows are separate
 * pivots so walking bends knees and aiming straightens the gun arm.
 */
export const humanoid = (b: RigBuilder, root: TransformNode, build: Build, look: Look): Joints => {
  const s = build.height / 1.74;
  const body = b.node("body", root);
  const [l, r] = buildLegs(b, body, build, look, s) as [Leg, Leg];
  buildTorso(b, body, build, look, s);
  const head = buildHead(b, body, look, s);
  const [al, ar] = buildArms(b, body, build, look, s) as [Arm, Arm];
  return { body, head, legL: l.leg, legR: r.leg, kneeL: l.knee, kneeR: r.knee, armL: al.arm, armR: ar.arm, elbowL: al.elbow, elbowR: ar.elbow, s };
};
