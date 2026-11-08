import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { animateRig, buildHeroine } from "../src/renderer/characters";
import { CHOKE_TIME, KILL_TIME, holderPose } from "../src/renderer/grab-pose";
import { applyPose } from "../src/renderer/joint-pose";
import { ModelLibrary } from "../src/renderer/model-library";
import { HumanoidRetarget } from "../src/renderer/model-rig";
import { SpringBones, humanoidColliders } from "../src/renderer/spring-bones";
import { serveModels } from "./game-models";
import { SkirtProbe } from "./skirt-probe";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** How far a leg may show through the skirt for a frame (metres): under the toon line's width. */
const SLACK = 0.01;
const DT = 1 / 60;

/**
 * Seki's legs stay inside her skirt (prośba użytkownika 7.11): `seki.vrm` as the game dresses the
 * heroine (scale 1.15, the retarget over the procedural rig and the spring bones), stepped through
 * whole strides. Before, the running heel folded up behind a raised thigh and went through the
 * back of the skirt by up to 3.7 cm, and the crouched thighs through its front by up to 5.1 cm.
 */
describe("Seki's legs and skirt (seki.vrm)", () => {
  const dress = async () => {
    serveModels();
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const model = await new ModelLibrary(scene, materials).instantiate({ url: "seki.vrm", scale: 1.15 }, "seki");
    const probe = SkirtProbe.create(model)!;
    const rig = buildHeroine(scene, materials, "h");
    const retarget = HumanoidRetarget.create(rig, model.root, model.prefix)!;
    const springs = SpringBones.create(model.root, { vrm: model.springs, prefix: model.prefix, colliders: humanoidColliders(model.root, model.prefix) });
    return { probe, rig, retarget, springs };
  };

  it("finds the skirt and the legs clear of it in the bind pose", async () => {
    const { probe } = await dress();
    expect(probe).not.toBeNull();
    expect(probe.crossings(0)).toEqual([]);
  });

  const cases = [
    { name: "sprint", speed: 6.93, crouch: 0, frames: 26 },
    { name: "fast sprint (cyberware)", speed: 9, crouch: 0, frames: 22 },
    { name: "walk", speed: 4.2, crouch: 0, frames: 32 },
    { name: "crouch", speed: 0, crouch: 1, frames: 2 },
    { name: "crouched walk", speed: 2.1, crouch: 1, frames: 48 },
    { name: "fast crouched walk (shadow_prowler, cyberware)", speed: 3.9, crouch: 1, frames: 30 },
    // A body on the shoulder (ADR-0065): the walk with the weapon away (G-459).
    { name: "carrying a body", speed: 4.2, crouch: 0, frames: 32, busy: true },
  ];
  for (const c of cases) {
    it(`${c.name}: no leg through the skirt by more than ${SLACK * 100} cm over a whole stride`, async () => {
      const { probe, rig, retarget, springs } = await dress();
      rig.handsBusy = c.busy ?? false;
      const worst = new Map<string, number>();
      // Half a second to settle the crouch and the springs, then a whole stride, frame by frame.
      for (let f = 0; f < 30 + c.frames; f++) {
        rig.root.position.z += c.speed * DT;
        animateRig(rig, c.speed, DT, c.crouch);
        retarget.update();
        springs?.update(DT);
        if (f < 30) continue;
        for (const x of probe.crossings(SLACK)) worst.set(x.leg, Math.max(worst.get(x.leg) ?? 0, Math.round(x.depth * 1000) / 1000));
      }
      expect(Object.fromEntries(worst)).toEqual({});
    });
  }

  // The takedown grab (ADR-0075): the player's clip laid over her standing or crouched (she sneaks
  // up crouched, and the clip leaves her knees out), as `grab-clip` does at full weight, from the
  // hold down onto one knee in the choke and the kill (G-514).
  const grabs = [
    { phase: "hold", seconds: 1 },
    { phase: "choke", seconds: CHOKE_TIME + 0.5 },
    { phase: "kill", seconds: KILL_TIME + 0.5 },
  ] as const;
  for (const g of grabs)
    for (const crouch of [0, 1]) {
      it(`takedown ${g.phase}${crouch ? " from a crouch" : ""}: no leg through the skirt by more than ${SLACK * 100} cm over the whole clip`, async () => {
        const { probe, rig, retarget, springs } = await dress();
        rig.handsBusy = true;
        const worst = new Map<string, number>();
        for (let f = 0; f < 30 + Math.round(g.seconds / DT); f++) {
          animateRig(rig, 0, DT, crouch);
          if (f >= 30) applyPose(rig, holderPose(rig, g.phase, (f - 30) * DT), 1, 1);
          retarget.update();
          springs?.update(DT);
          if (f < 30) continue;
          for (const x of probe.crossings(SLACK)) worst.set(x.leg, Math.max(worst.get(x.leg) ?? 0, Math.round(x.depth * 1000) / 1000));
        }
        expect(Object.fromEntries(worst)).toEqual({});
      });
    }
});
