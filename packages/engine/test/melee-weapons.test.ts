import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { type AppearanceDescriptor, WEAPON_CATALOG } from "@seki/core";
import { describe, expect, it, vi } from "vitest";
import { type AbstractMesh, Scene, TransformNode, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { animateRig, buildHeroine, setWeaponDrawn, startSwing } from "../src/renderer/characters";
import { Loadouts } from "../src/renderer/loadout";
import { ModelLibrary } from "../src/renderer/model-library";
import { meleeWrist } from "../src/renderer/melee-poses";
import { SWING_STRIKE, moveOf, swingEnd, swingPhase } from "../src/renderer/melee-timing";
import { GRIP, MELEE_HOLD, type MeleeKind, VIEW_MELEE_TILT, WeaponMounts } from "../src/renderer/weapon-mount";
import { allWeaponUrls } from "./weapon-files";

const DT = 1 / 60;

/** The melee weapon of each look in the catalog (ADR-0019): its combo's timing. */
const PROFILE = { baton: WEAPON_CATALOG.baton.melee, blade: WEAPON_CATALOG.shirasaya.melee } as const;

const look = (melee: MeleeKind, active: "melee" | "secondary"): AppearanceDescriptor => ({
  weapons: { primary: "rifle", secondary: "pistol", melee, active },
  garments: {},
  implants: [],
});

/** A heroine with the melee weapon `kind` in hand (or stowed), its model mounted. */
const armed = async (kind: MeleeKind, active: "melee" | "secondary" = "melee") => {
  const scene = new Scene(new NullEngine());
  const materials = new ToonMaterials(scene);
  const loadouts = new Loadouts(scene, materials, new WeaponMounts(new ModelLibrary(scene, materials), allWeaponUrls()), () => {});
  const rig = buildHeroine(scene, materials, "hero");
  rig.melee = active === "melee";
  loadouts.set(rig, look(kind, active), "hero");
  setWeaponDrawn(rig, active === "melee");
  const holder = scene.getTransformNodeByName(`hero-${active === "melee" ? "hand" : "hipL"}-${kind}`)!;
  const model = (): AbstractMesh | undefined => holder.getChildMeshes(false).find((m) => m.getTotalVertices() > 0);
  await vi.waitFor(() => expect(model()).toBeDefined());
  const mesh = model()!;
  const play = (seconds: number, guard = 0) => {
    for (let t = 0; t < seconds - 1e-9; t += DT) {
      animateRig(rig, 0, DT, 0, { guard });
      loadouts.update(rig);
    }
  };
  /** Points of the model in the rig's own frame (it faces +Z, its right hand is at +X). */
  const pose = () => {
    for (let n: TransformNode | null = mesh; n; n = n.parent as TransformNode | null) n.computeWorldMatrix(true);
    const toRig = rig.root.computeWorldMatrix(true).clone().invert();
    const world = mesh.computeWorldMatrix(true);
    const at = (x: number, y: number) => Vector3.TransformCoordinates(Vector3.TransformCoordinates(new Vector3(x, y, 0), world), toRig);
    const grip = at(GRIP[kind].x, GRIP[kind].y);
    const tip = at(mesh.getBoundingInfo().boundingBox.maximum.x, 0);
    return { grip, tip, dir: tip.subtract(grip).normalize() };
  };
  return { scene, rig, loadouts, play, pose };
};

describe("melee weapon models (ADR-0019)", () => {
  it.each(["baton", "blade"] as const)("%s: the handle runs along the forearm in a hand and up and forward in the viewmodel", async (kind) => {
    const scene = new Scene(new NullEngine());
    const mounts = new WeaponMounts(new ModelLibrary(scene, new ToonMaterials(scene)), allWeaponUrls());
    const h = MELEE_HOLD[kind].handle;
    for (const space of ["hand", "view"] as const) {
      const holder = new TransformNode(space, scene);
      const pivot = (await mounts.mount(holder, kind, `${kind}-${space}`, space))!;
      const mesh = pivot.getChildMeshes(false).find((m) => m.getTotalVertices() > 0)!;
      const world = mesh.computeWorldMatrix(true);
      const at = (x: number, y: number) => Vector3.TransformCoordinates(new Vector3(x, y, 0), world);
      const grip = at(GRIP[kind].x, GRIP[kind].y);
      // A point 10 cm up the handle from the fist, towards the guard.
      const handle = at(GRIP[kind].x + 0.1 * Math.cos(h), GRIP[kind].y + 0.1 * Math.sin(h)).subtract(grip).normalize();
      expect(grip.length(), `${space} grip`).toBeLessThan(1e-6);
      const along = space === "hand" ? new Vector3(0, -1, 0) : new Vector3(0, Math.cos(VIEW_MELEE_TILT), Math.sin(VIEW_MELEE_TILT));
      // A wrong turn of the curved blade's handle shows as a skew here.
      expect(Vector3.Dot(handle, along), `${space} handle`).toBeGreaterThan(0.999);
    }
  });
});

describe("melee weapon in hand (ADR-0019)", () => {
  it.each(["baton", "blade"] as const)("%s: held at the ready tip up and forward, the guard slanting across the face to the left", async (kind) => {
    const { play, pose } = await armed(kind);
    play(0.6);
    const ready = pose();
    expect(ready.dir.y).toBeGreaterThan(0.6);
    expect(ready.dir.z).toBeGreaterThan(0.3);
    play(0.4, 1);
    const guard = pose();
    expect(guard.dir.x).toBeLessThan(-0.5);
    expect(guard.dir.y).toBeGreaterThan(0.4);
    expect(guard.grip.y).toBeGreaterThan(ready.grip.y + 0.1);
    // Not the old pose: the forearm up, the weapon pointing back at the face.
    expect(guard.dir.z).toBeGreaterThan(-0.3);
  });

  it.each(["baton", "blade"] as const)("%s: every strike of the combo points at the target when the simulation lands it", async (kind) => {
    const { rig, play, pose } = await armed(kind);
    play(0.6);
    for (const [strike, s] of PROFILE[kind].combo.entries()) {
      startSwing(rig, strike, s.windup, s.recovery);
      play(s.windup - SWING_STRIKE / 2);
      // Wound up: the weapon back over a shoulder or behind the head.
      expect(pose().dir.z, `${strike} cocked`).toBeLessThan(0);
      play(SWING_STRIKE / 2);
      // The simulation lands the blow at the end of the windup: the weapon points ahead, level.
      expect(pose().dir.z, `${strike} landing`).toBeGreaterThan(0.85);
      play(SWING_STRIKE / 2);
      // Followed through low: a diagonal cut, or straight down for the heavy overhead.
      expect(pose().dir.y, `${strike} through`).toBeLessThan(moveOf(strike) === "heavy" ? -0.6 : -0.2);
      // Back at the ready when the recovery ends, the next action's moment in the simulation.
      play(s.recovery - SWING_STRIKE / 2 + DT);
      expect(rig.swing, `${strike} over`).toBeNull();
      play(0.3);
    }
  });

  it("times the swing on the simulation's: half way at the windup's end, done at the recovery's", () => {
    for (const profile of Object.values(PROFILE)) {
      for (const s of [...profile.combo, { windup: profile.npcWindup, recovery: profile.combo[0].recovery }]) {
        expect(swingPhase(s.windup, s.windup, s.recovery).through).toBeCloseTo(0.5);
        expect(swingPhase(0, s.windup, s.recovery)).toEqual({ cock: 0, through: 0 });
        expect(swingEnd(s.windup, s.recovery)).toBeCloseTo(s.windup + s.recovery);
        expect(swingPhase(s.windup + s.recovery, s.windup, s.recovery)).toEqual({ cock: 0, through: 0 });
      }
    }
    expect(PROFILE.blade.combo.map((_, i) => moveOf(i))).toEqual(["light", "light", "heavy"]);
  });

  it("cocks the weapon across the fist while drawn, and lays it along the forearm when put away", async () => {
    const { rig, scene, play } = await armed("baton");
    play(0.6);
    const hand = scene.getTransformNodeByName("hero-hand-baton")!;
    expect(meleeWrist(rig)).toBeGreaterThan(0.5);
    expect(hand.rotation.x).toBeCloseTo(-meleeWrist(rig));
    setWeaponDrawn(rig, false);
    play(0.6);
    expect(meleeWrist(rig)).toBe(0);
  });
});

describe("melee weapon put away (ADR-0019)", () => {
  it("hangs the baton tip down on the left hip", async () => {
    const { play, pose } = await armed("baton", "secondary");
    play(0.3);
    const p = pose();
    expect(p.grip.x).toBeLessThan(-0.1);
    expect(p.grip.y).toBeGreaterThan(0.8);
    expect(p.grip.y).toBeLessThan(1.1);
    expect(p.dir.y).toBeLessThan(-0.9);
  });

  it("carries the blade on the back, crossing the rifle, the handle over the right shoulder", async () => {
    const { scene, rig, play, pose } = await armed("blade", "secondary");
    play(0.3);
    const p = pose();
    expect(p.grip.z).toBeLessThan(-0.15);
    // The fist's place on the handle by the shoulder, the tip at the hip (before the lift: at 0.64 m, the knee).
    expect(p.grip.y).toBeGreaterThan(1.35);
    expect(p.tip.y).toBeGreaterThan(0.72);
    // Tip down to the left, so the handle stands up to the right.
    expect(p.dir.y).toBeLessThan(-0.7);
    expect(p.dir.x).toBeLessThan(-0.2);
    const rifle = scene.getTransformNodeByName("hero-back-rifle")!.getChildMeshes(false).find((m) => m.getTotalVertices() > 0);
    await vi.waitFor(() => expect(rifle).toBeDefined());
    const toRig = rig.root.computeWorldMatrix(true).clone().invert();
    const w = rifle!.computeWorldMatrix(true);
    const box = rifle!.getBoundingInfo().boundingBox;
    const muzzle = Vector3.TransformCoordinates(Vector3.TransformCoordinates(new Vector3(box.maximum.x, 0, 0), w), toRig);
    const butt = Vector3.TransformCoordinates(Vector3.TransformCoordinates(new Vector3(box.minimum.x, 0, 0), w), toRig);
    // The rifle's muzzle points down the other way, so the two cross on the back.
    expect(muzzle.subtract(butt).normalize().x).toBeGreaterThan(0.2);
  });
});
