import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { FreeCamera, PostProcess, Scene, Vector3 } from "../src/babylon";
import { Grading } from "../src/npr/grading";
import { PassGate } from "../src/npr/pass-gate";
import { SpeedLines } from "../src/npr/speed-lines";

const names = (camera: FreeCamera): (string | null)[] => camera._postProcesses.map((p) => p?.name ?? null).filter((n) => n !== null);

/** The renderer's chain on medium and high: the line art first, then speed lines, then grading. */
const chain = (reference = false) => {
  const scene = new Scene(new NullEngine());
  const camera = new FreeCamera("cam", new Vector3(0, 1.6, 0), scene);
  scene.activeCamera = camera;
  const first = new PostProcess("line-art", "pass", [], [], 1, camera);
  const speed = new SpeedLines(scene, camera);
  const grading = new Grading(scene, camera, { reference, sharpen: 0.25, bloom: 0 });
  let builds = 0;
  grading.pipeline.onBuildObservable.add(() => builds++);
  return { scene, camera, first, speed, grading, builds: () => builds };
};

describe("empty full-screen passes stay out of the chain (frame profile 14.11)", () => {
  it("draws no chromatic aberration and no speed lines while neither shows", () => {
    const { camera, grading, speed } = chain();
    grading.update(1 / 60);
    speed.update(1 / 60);
    expect(grading.chromaticDrawing).toBe(false);
    expect(speed.drawing).toBe(false);
    expect(names(camera)).not.toContain("ChromaticAberration");
    expect(names(camera)).not.toContain("speed-lines");
    expect(names(camera)[0]).toBe("line-art");
    expect(names(camera)).toContain("fxaa");
  });

  it("puts the aberration back in its slot for a glitch and takes it out after, without a rebuild", () => {
    const { camera, grading, builds } = chain();
    const before = names(camera);
    grading.glitch();
    grading.update(0.1);
    expect(grading.chromaticDrawing).toBe(true);
    const during = names(camera);
    // Before FXAA, after grain: where the pipeline put it.
    expect(during.indexOf("ChromaticAberration")).toBe(during.indexOf("fxaa") - 1);
    expect(during.indexOf("ChromaticAberration")).toBe(during.indexOf("Grain") + 1);
    for (let i = 0; i < 20; i++) grading.update(0.1);
    expect(grading.chromaticDrawing).toBe(false);
    expect(names(camera)).toEqual(before);
    expect(builds()).toBe(0);
  });

  it("keeps the aberration while the overdrive fringes the edges", () => {
    const { grading } = chain();
    grading.setOverdrive(true);
    grading.update(0.1);
    expect(grading.chromaticDrawing).toBe(true);
    grading.setOverdrive(false);
    for (let i = 0; i < 10; i++) grading.update(0.1);
    expect(grading.chromaticDrawing).toBe(false);
  });

  it("never draws the aberration with reduced flashes, where its amount stays 0", () => {
    const { grading } = chain();
    grading.setReduceFlashes(true);
    grading.glitch();
    grading.update(0.1);
    expect(grading.chromaticDrawing).toBe(false);
  });

  it("draws speed lines from a dash until they fade, in front of the grading", () => {
    const { camera, speed } = chain();
    speed.pulse(1);
    speed.update(1 / 60);
    expect(speed.drawing).toBe(true);
    expect(names(camera).indexOf("speed-lines")).toBe(1);
    for (let i = 0; i < 120; i++) speed.update(1 / 60);
    expect(speed.intensity).toBe(0);
    expect(speed.drawing).toBe(false);
  });

  it("keeps the first pass of the chain, which the scene renders into", () => {
    // Low quality has no line art: the speed lines are first and carry the depth buffer.
    const scene = new Scene(new NullEngine());
    const camera = new FreeCamera("cam", new Vector3(0, 1.6, 0), scene);
    const speed = new SpeedLines(scene, camera);
    speed.update(1 / 60);
    expect(speed.drawing).toBe(true);
    expect(names(camera)[0]).toBe("speed-lines");
  });

  it("does nothing when the pass is already where it should be", () => {
    const calls: string[] = [];
    const slots: (string | null)[] = ["a", "b", "c"];
    const camera = {
      _postProcesses: slots,
      attachPostProcess: (p: string, at?: number | null) => {
        calls.push(`attach ${p} ${at}`);
        slots[at ?? slots.length] = p;
        return at ?? 0;
      },
      detachPostProcess: (p: string) => {
        calls.push(`detach ${p}`);
        slots[slots.indexOf(p)] = null;
      },
    };
    const gate = new PassGate(camera, () => "b");
    gate.set(true);
    gate.set(false);
    gate.set(false);
    gate.set(true);
    gate.set(true);
    expect(calls).toEqual(["detach b", "attach b 1"]);
    expect(slots).toEqual(["a", "b", "c"]);
  });
});
