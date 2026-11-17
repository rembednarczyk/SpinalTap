// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { W3_LAYOUT, w3 } from "@seki/sim";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CityKit } from "../src/renderer/city-kit";
import { parseCityKit, swatchUv } from "../src/renderer/city-kit-data";
import { LINE_IDLE, linePose } from "../src/renderer/tessen-w3/w3-line-anim";
import { WRECK_BOXES, lineGeometry } from "../src/renderer/tessen-w3/w3-line-geometry";
import { W3View } from "../src/renderer/tessen-w3/w3-view";

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const kitData = parseCityKit(file("city-kit.glb"));

/**
 * W-3's stations wrecked for good in the engine (ADR-0082 stage 3c): the wrecks are boxes of the
 * line's own mesh (no draw call of their own), from the `line-wrecks` state the app sends from the
 * stations' flags; the arms by a wreck hang dead, its screen lies out; without wrecks the line is
 * the mesh it was.
 */
describe("W-3's wrecked stations (ADR-0082 stage 3c)", () => {
  it("adds the wrecks' boxes after the line's, hangs the arms by them dead and puts their screens out", () => {
    const intact = lineGeometry(kitData, linePose(0, undefined, true));
    const mission = { ...LINE_IDLE, wrecks: ["S4", "S1"] as const };
    const pose = linePose(0, undefined, true, mission);
    expect(pose.wrecks).toEqual(["S1", "S4"]);
    const wrecked = lineGeometry(kitData, pose);
    expect(wrecked.vertexCount).toBe(intact.vertexCount + 2 * WRECK_BOXES * 24);
    // The line's own boxes come first, in the same order: only the wrecks are new.
    expect(wrecked.indices.slice(0, intact.indices.length)).toEqual(intact.indices);
    // S1's arms (belt L1, x 2516 and 2524) and S4's (belt L2, x 2532 and 2540) hang dead and dark; the others work.
    const dead = pose.arms.filter((a) => a.shoulder < 0);
    expect(dead.map((a) => [a.x, a.side])).toEqual([
      [2516, 1],
      [2524, 1],
      [2532, -1],
      [2540, -1],
    ]);
    expect(dead.every((a) => !a.beacon)).toBe(true);
    const teal = (s: ReturnType<typeof lineGeometry>) => {
      const [u, v] = swatchUv(kitData, "win-teal");
      let n = 0;
      for (let i = 0; i < s.uvs.length; i += 2) if (s.uvs[i] === u && s.uvs[i + 1] === v) n++;
      return n / 24;
    };
    expect(teal(intact)).toBe(5);
    expect(teal(wrecked)).toBe(3);
    // Every wreck lies by its station, on the floor of the hall and under its top.
    for (let i = intact.positions.length; i < wrecked.positions.length; i += 3) {
      const [x, y, z] = [wrecked.positions[i]!, wrecked.positions[i + 1]!, wrecked.positions[i + 2]!];
      const near = (["S1", "S4"] as const).some((s) => Math.abs(x - W3_LAYOUT.STATIONS[s].x) < 2.2 && Math.abs(z - W3_LAYOUT.STATIONS[s].z) < 3);
      expect(near && y >= w3(0, 0, 0).y - 1e-6 && y < w3(0, 2, 0).y, `${x},${y},${z}`).toBe(true);
    }
  });

  it("fills the line's mesh anew once when the wrecks change, back as it was without them, no mesh left behind", () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const kit = new CityKit(scene, materials, null, kitData, { labels: false });
    const eye = { ...w3(2520, 1.6, 418) };
    const v = new W3View({ scene, materials, kit: () => kit, city: () => true, eye: () => eye, still: true });
    const vertices = () => (v as unknown as { line: { getTotalVertices(): number } }).line.getTotalVertices();
    v.update(0, false);
    const meshes = scene.meshes.length;
    const before = vertices();
    // The app sends the empty state after every load: nothing to change.
    v.setMission({ kind: "line-wrecks", stations: [] });
    v.update(0, false);
    expect(vertices()).toBe(before);
    v.setMission({ kind: "line-wrecks", stations: ["S1", "S2", "S4"] });
    v.update(0, false);
    expect(vertices()).toBe(before + 3 * WRECK_BOXES * 24);
    expect(v.stats.meshes).toBe(3);
    // A load of a save from before the blast: the wrecks go.
    v.setMission({ kind: "line-wrecks", stations: [] });
    v.update(0, false);
    expect(vertices()).toBe(before);
    expect(scene.meshes.length).toBe(meshes);
  });
});
