import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { type Mesh, Scene, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { buildLootBag } from "../src/renderer/props";

/**
 * The loot bag (ADR-0015) as a real duffel (`docs/zasady-lokacji.md` §9; the Hebi bag on the pavilion's roof,
 * `docs/lokacje/alchemia-pawilon-dach.md`): a canvas cylinder lying on the ground with its rims, zip, handles and
 * strap in one mesh, the rarity's neon strip on its side, two meshes as before.
 */

const scene = new Scene(new NullEngine());
const materials = new ToonMaterials(scene);

describe("the loot bag", () => {
  it("is a duffel of one mesh on the ground with its rarity strip, two meshes as the capsule was", () => {
    const at = new Vector3(10, 2, -3);
    const view = buildLootBag(scene, materials, "bag-test", { kind: "loot", style: "bag", best: "rare" }, at);
    const meshes = view.root.getChildMeshes(true) as Mesh[];
    expect(meshes).toHaveLength(2);
    const [body] = view.casters;
    expect(body!.isPickable).toBe(true);
    expect(view.glowing).toHaveLength(1);
    body!.computeWorldMatrix(true);
    body!.refreshBoundingInfo();
    const { minimumWorld: lo, maximumWorld: hi } = body!.getBoundingInfo().boundingBox;
    // Lying on the ground, half a metre long and a hand under 0.3 m high with its handles, the strap slack beside it.
    expect(lo.y - at.y).toBeGreaterThan(-0.02);
    expect(lo.y - at.y).toBeLessThan(0.02);
    expect(hi.y - at.y).toBeGreaterThan(0.24);
    expect(hi.y - at.y).toBeLessThan(0.35);
    expect(hi.x - lo.x).toBeGreaterThan(0.5);
    expect(hi.x - lo.x).toBeLessThan(0.7);
    // Many more faces than the 10-sided capsule: rims, zip, handles and strap.
    expect(body!.getTotalIndices() / 3).toBeGreaterThan(300);
    view.root.dispose();
  });
});
