import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { FreeCamera, MeshBuilder, MeshClass, Scene, Vector3 } from "../src/babylon";
import { NIGHT_RIG } from "../src/npr/lighting";
import { MoonShadow } from "../src/npr/moon-shadow";

const setup = () => {
  const scene = new Scene(new NullEngine({ renderWidth: 320, renderHeight: 200, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 1 }));
  const view = new FreeCamera("view", new Vector3(0, 30, -30), scene);
  view.setTarget(Vector3.Zero());
  scene.activeCamera = view;
  const shadow = new MoonShadow(scene, NIGHT_RIG, 28, 256);
  const proxy = (): MeshClass => {
    const m = scene.getMeshByName("moon-static-casters");
    if (!(m instanceof MeshClass)) throw new Error("no merged static casters");
    return m;
  };
  return { scene, shadow, proxy };
};

const maxIndex = (indices: ArrayLike<number>): number => {
  let max = -1;
  for (let i = 0; i < indices.length; i++) max = Math.max(max, indices[i]!);
  return max;
};

describe("moon shadow: the merged static casters (G-867)", () => {
  it("a rebuilt proxy indexes only its own vertices and leaves the casters' index data alone", () => {
    const t = setup();
    const bench = MeshBuilder.CreateBox("bench", { width: 2, height: 0.5, depth: 0.5 }, t.scene);
    bench.position.set(3, 0.25, 3);
    const lamp = MeshBuilder.CreateBox("lamp", { width: 0.2, height: 4, depth: 0.2 }, t.scene);
    lamp.position.set(-4, 2, 1);
    t.shadow.addStaticCaster(bench);
    t.shadow.addStaticCaster(lamp);
    const benchIndices = Array.from(bench.getIndices()!);
    const at = new Vector3(0, 0, 0);
    t.shadow.update(at);
    // A caster streamed in (or out) rebuilds the proxy from the casters' own data.
    const kiosk = MeshBuilder.CreateBox("kiosk", { size: 2 }, t.scene);
    kiosk.position.set(1, 1, -5);
    t.shadow.addStaticCaster(kiosk);
    t.shadow.update(at);
    t.shadow.invalidateStatics();
    t.shadow.update(at);
    expect(Array.from(bench.getIndices()!), "the first caster's indices after three merges").toEqual(benchIndices);
    const proxy = t.proxy();
    const casters = [bench, lamp, kiosk];
    expect(proxy.getTotalVertices()).toBe(casters.reduce((n, m) => n + m.getTotalVertices(), 0));
    expect(proxy.getTotalIndices()).toBe(casters.reduce((n, m) => n + m.getTotalIndices(), 0));
    // An index past the last vertex reads whatever the GPU returns there: a different shadow each page.
    expect(maxIndex(proxy.getIndices()!)).toBeLessThan(proxy.getTotalVertices());
  });
});
