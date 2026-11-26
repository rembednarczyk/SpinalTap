import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { StreetPropItem, StreetPropKind } from "@seki/core";
import { chainVariant } from "@seki/sim";
import { describe, expect, it } from "vitest";
import { type Mesh, Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { DETAIL_REACH, DETAIL_TILE, MID_LEAVES } from "../src/renderer/mapcity/detail-tiles";
import { tree } from "../src/renderer/mapcity/prop-green";
import { nearModel } from "../src/renderer/mapcity/prop-models";
import { StreetProps } from "../src/renderer/mapcity/street-props";
import { FULL_LEAVES } from "../src/renderer/mapcity/tree-plan";

const item = (prop: StreetPropKind, x: number, z: number, variant = 0): StreetPropItem => ({ prop, x, y: 0, z, yaw: 0, variant });

const make = (quality: "high" | "low") => {
  const scene = new Scene(new NullEngine());
  return new StreetProps({ scene, materials: new ToonMaterials(scene), quality, now: () => 0 });
};
const blockMesh = (props: StreetProps): Mesh => props.meshes.find((m) => /^props-[-\d]/.test(m.name))!;

describe("the near blocks' trees and bollards in tiles of two levels of detail", () => {
  // Two tiles: trees and a chained bollard in the first (centre 32, 32), a tree in the second (centre 96, 32); a bench of the block's own.
  const pieces = [item("tree", 10, 10, 0), item("tree", 20, 12, 3), item("bollard", 30, 20, chainVariant(2, 0, 0)), item("tree", DETAIL_TILE + 10, 10, 1), item("bench", 40, 40)];

  it("draws a tile in full near its centre and coarser beyond the reach, in the block's one mesh", () => {
    const props = make("high");
    props.spawn(1, pieces, { x: 0, y: 0, z: 0 });
    props.flush();
    // Both tiles within reach: all in full.
    props.update({ x: 64, y: 2, z: 32 });
    expect(props.waiting).toBe(0);
    const mesh = blockMesh(props);
    const full = mesh.getTotalIndices();
    // The first tile's centre beyond the reach, the second within: the first coarse.
    props.update({ x: 32 + DETAIL_REACH + 20, y: 2, z: 32 });
    const one = mesh.getTotalIndices();
    expect(one).toBeLessThan(0.8 * full);
    // Both beyond: fewer still; back near, all in full again.
    props.update({ x: 96 + DETAIL_REACH + 20, y: 2, z: 32 + DETAIL_REACH });
    expect(mesh.getTotalIndices()).toBeLessThan(one);
    props.update({ x: 64, y: 2, z: 32 });
    expect(mesh.getTotalIndices()).toBe(full);
    // One mesh, one draw call, whatever the levels (ADR-0050); the stats count the pieces as before.
    expect(props.stats.groups).toBe(1);
    expect(props.meshes.filter((m) => /^props-[-\d]/.test(m.name))).toHaveLength(1);
    expect(props.stats.drawn).toEqual({ tree: 3, bollard: 1, bench: 1 });
  });

  it("goes coarse again only past the reach by a margin", () => {
    const props = make("high");
    props.spawn(1, [item("tree", 10, 10, 0)], { x: 0, y: 0, z: 0 });
    props.flush();
    props.update({ x: 32, y: 2, z: 32 });
    const full = blockMesh(props).getTotalIndices();
    props.update({ x: 32 + DETAIL_REACH + 5, y: 2, z: 32 });
    expect(blockMesh(props).getTotalIndices()).toBe(full);
    props.update({ x: 32 + DETAIL_REACH + 15, y: 2, z: 32 });
    expect(blockMesh(props).getTotalIndices()).toBeLessThan(full);
  });

  it("keeps the phones' coarse bollards as they were, and draws their trees far beyond the reach (T-354)", () => {
    const props = make("low");
    props.spawn(1, [item("bollard", 30, 20, chainVariant(2, 0, 0)), item("bench", 40, 40)], { x: 0, y: 0, z: 0 });
    props.flush();
    props.update({ x: 64, y: 2, z: 32 });
    const near = blockMesh(props).getTotalIndices();
    props.update({ x: 64 + DETAIL_REACH + 40, y: 2, z: 32 });
    expect(blockMesh(props).getTotalIndices()).toBe(near);
    // A phone tree (226-438 triangles) is the far tree (30) past the reach, whole again within it.
    const trees = make("low");
    trees.spawn(1, [item("tree", 10, 10, 0), item("tree", 20, 12, 3)], { x: 0, y: 0, z: 0 });
    trees.flush();
    trees.update({ x: 32, y: 2, z: 32 });
    const full = blockMesh(trees).getTotalIndices();
    trees.update({ x: 32 + DETAIL_REACH + 20, y: 2, z: 32 });
    const far = blockMesh(trees).getTotalIndices();
    // The block's own parts stay; of the two trees' indices, over 60% go.
    const phoneTrees = nearModel("tree", 0, "low").indices.length + nearModel("tree", 3, "low").indices.length;
    expect(full - far).toBeGreaterThan(0.6 * phoneTrees);
    trees.update({ x: 32, y: 2, z: 32 });
    expect(blockMesh(trees).getTotalIndices()).toBe(full);
  });

  it("thins a leafy tree to fewer, bigger leaves, the game's original trees as they are", () => {
    expect(MID_LEAVES.perCluster).toBeLessThan(FULL_LEAVES.perCluster / 3);
    expect(MID_LEAVES.leaf).toBeGreaterThan(FULL_LEAVES.leaf);
    for (let s = 0; s < 5; s++) expect(tree(s, MID_LEAVES).indices.length).toBeLessThan(0.4 * tree(s).indices.length);
    // Style 1 (shapes 5..9) is the original tree: no leaves to thin.
    for (let s = 5; s < 10; s++) expect(tree(s, MID_LEAVES).indices.length).toBe(tree(s).indices.length);
  });
});
