import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { type AbstractMesh, FreeCamera, MeshBuilder, MeshClass, Scene, Vector3 } from "../src/babylon";
import { NIGHT_RIG } from "../src/npr/lighting";
import { MoonShadow } from "../src/npr/moon-shadow";
import { SETTLE_FRAMES } from "../src/npr/shadow-maps";

/** Seen only by the moon camera: the main view does not count in the meshes' render counters. */
const SHADOW_ONLY = 0x10000000;

const setup = () => {
  const scene = new Scene(new NullEngine({ renderWidth: 320, renderHeight: 200, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 1 }));
  const view = new FreeCamera("view", new Vector3(0, 30, -30), scene);
  view.setTarget(Vector3.Zero());
  scene.activeCamera = view;
  const shadow = new MoonShadow(scene, NIGHT_RIG, 28, 256);
  const building = MeshBuilder.CreateBox("building", { size: 4 }, scene);
  building.position.set(3, 2, 3);
  shadow.addStaticCaster(building);
  const walker = MeshBuilder.CreateBox("walker", { width: 0.5, height: 1.8, depth: 0.5 }, scene);
  walker.layerMask = SHADOW_ONLY;
  shadow.addCaster(walker);
  let walkerDraws = 0;
  walker.onBeforeRenderObservable.add(() => walkerDraws++);
  // The static casters render as the merged proxy; its draws are counted per frame drawn.
  let staticDraws = 0;
  let watched: AbstractMesh | null = null;
  const watch = (): void => {
    const proxy = scene.getMeshByName("moon-static-casters");
    if (!(proxy instanceof MeshClass) || proxy === watched) return;
    watched = proxy;
    proxy.onBeforeRenderObservable.add(() => staticDraws++);
  };
  const frame = (focus: Vector3): void => {
    shadow.update(focus);
    watch();
    scene.render();
  };
  return { scene, shadow, walker, frame, statics: () => staticDraws, dynamics: () => walkerDraws };
};

describe("moon shadow keeps the static casters between frames (plan 14.11, step 6)", () => {
  it("with the square still, the statics are drawn a few times at the start and then not at all", () => {
    const t = setup();
    const at = new Vector3(0, 0, 0);
    for (let i = 0; i < 10; i++) t.frame(at);
    const settled = t.statics();
    expect(settled).toBeGreaterThan(0);
    expect(settled).toBeLessThanOrEqual(5);
    for (let i = 0; i < 30; i++) t.frame(at);
    expect(t.statics()).toBe(settled);
  });

  it("the moving casters are drawn every frame, cached statics or not", () => {
    const t = setup();
    const at = new Vector3(0, 0, 0);
    for (let i = 0; i < 40; i++) {
      t.walker.position.x = i * 0.01;
      t.frame(at);
    }
    expect(t.dynamics()).toBe(40);
  });

  it("moving the square by a texel draws the statics again, every frame it moves", () => {
    const t = setup();
    for (let i = 0; i < 10; i++) t.frame(new Vector3(0, 0, 0));
    const before = t.statics();
    // 0.5 m a frame: two texels and more of the 56 m square at 256 px (0.22 m each).
    for (let i = 1; i <= 5; i++) t.frame(new Vector3(i * 0.5, 0, 0));
    expect(t.statics()).toBe(before + 5);
    expect(t.dynamics()).toBe(15);
    // Standing again: drawn with every caster until it settles, then once alone, then kept.
    for (let i = 0; i < 20; i++) t.frame(new Vector3(2.5, 0, 0));
    expect(t.statics()).toBe(before + 5 + SETTLE_FRAMES);
    expect(t.dynamics()).toBe(35);
  });

  it("a static caster built or released while the square is still draws the statics once more", () => {
    const t = setup();
    const at = new Vector3(0, 0, 0);
    for (let i = 0; i < 10; i++) t.frame(at);
    const before = t.statics();
    const kiosk = MeshBuilder.CreateBox("kiosk", { size: 2 }, t.scene);
    kiosk.position.set(-4, 1, 2);
    t.shadow.addStaticCaster(kiosk);
    for (let i = 0; i < 10; i++) t.frame(at);
    expect(t.statics()).toBe(before + 1);
    kiosk.dispose();
    for (let i = 0; i < 10; i++) t.frame(at);
    expect(t.statics()).toBe(before + 2);
  });

  it("walking again clears the moving casters' map once: no shadow left where a figure stood", () => {
    const t = setup();
    for (let i = 0; i < 10; i++) t.frame(new Vector3(0, 0, 0));
    let passes = 0;
    let drawn = -1;
    t.shadow.movingTexture.onAfterRenderObservable.add(() => {
      passes++;
      drawn = t.shadow.movingTexture.renderList?.length ?? -1;
    });
    for (let i = 1; i <= 10; i++) t.frame(new Vector3(i * 0.5, 0, 0));
    expect(passes).toBe(1);
    expect(drawn).toBe(0);
  });

  it("the map's detailed buildings (fixed casters) are kept with the statics, and drawn again when shown or hidden", () => {
    const t = setup();
    const block = MeshBuilder.CreateBox("map-near-0:0", { width: 20, height: 12, depth: 10 }, t.scene);
    block.layerMask = SHADOW_ONLY;
    t.shadow.addFixedCaster(block);
    let draws = 0;
    block.onBeforeRenderObservable.add(() => draws++);
    const at = new Vector3(0, 0, 0);
    // With every caster until the square settles, then once with the statics alone.
    for (let i = 0; i < 40; i++) t.frame(at);
    expect(draws).toBe(SETTLE_FRAMES + 1);
    block.setEnabled(false);
    for (let i = 0; i < 5; i++) t.frame(at);
    block.setEnabled(true);
    for (let i = 0; i < 5; i++) t.frame(at);
    expect(draws).toBe(SETTLE_FRAMES + 2);
    expect(t.statics()).toBe(SETTLE_FRAMES + 3);
    block.dispose();
    for (let i = 0; i < 5; i++) t.frame(at);
    expect(t.statics()).toBe(SETTLE_FRAMES + 4);
    expect(t.dynamics()).toBe(55);
  });

  it("is settled once the kept statics are drawn: not while the square settles nor before the frame that draws them", () => {
    const t = setup();
    const block = MeshBuilder.CreateBox("map-near-0:0", { width: 20, height: 12, depth: 10 }, t.scene);
    t.shadow.addFixedCaster(block);
    const at = new Vector3(0, 0, 0);
    // Before every render: the frame's update has run, its draws not yet.
    const before: boolean[] = [];
    const after: boolean[] = [];
    const frame = (focus: Vector3): void => {
      t.shadow.update(focus);
      before.push(t.shadow.settled);
      t.scene.render();
      after.push(t.shadow.settled);
    };
    for (let i = 0; i < SETTLE_FRAMES + 3; i++) frame(at);
    // The square moved on the first frame; it stands from the next, and splits on the SETTLE_FRAMES-th standing frame.
    const split = SETTLE_FRAMES;
    expect(after).toEqual(after.map((_, i) => i >= split));
    expect(before[split]).toBe(false);
    // A fixed caster hidden: its frame draws the statics again, then they are kept as before.
    block.setEnabled(false);
    expect(t.shadow.settled).toBe(false);
    frame(at);
    expect(after.at(-1)).toBe(true);
    // Walking: never settled.
    for (let i = 1; i <= 5; i++) frame(new Vector3(i * 0.5, 0, 0));
    expect(after.slice(-5)).toEqual([false, false, false, false, false]);
  });

  it("a frame of no shadow update (the loading screen) still draws the moving casters", () => {
    const t = setup();
    const at = new Vector3(0, 0, 0);
    for (let i = 0; i < 10; i++) t.frame(at);
    const before = t.dynamics();
    for (let i = 0; i < 5; i++) t.scene.render();
    expect(t.dynamics()).toBe(before + 5);
  });
});
