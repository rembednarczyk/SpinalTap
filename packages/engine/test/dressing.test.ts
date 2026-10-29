import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { ViewDescriptor } from "@seki/core";
import { MARKET_PLACE, type StaticProp, WORLD_CHUNKS, groundY } from "@seki/sim";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { WorldDressing } from "../src/renderer/dressing";
import { type DressBlock, isBuilding, isRoadDeck, isWalkedRoof, planDressing } from "../src/renderer/dressing-plan";
import { DRESS_FLAG, MeshSink } from "../src/renderer/mesh-sink";
import { blockPreset } from "../src/renderer/props";

type BlockView = Extract<ViewDescriptor, { kind: "block" }>;
const isBlock = (p: StaticProp): p is StaticProp & { view: BlockView } => p.view.kind === "block";

const blocksOf = (props: readonly StaticProp[]): DressBlock[] =>
  props.filter(isBlock).map((p) => ({
    center: p.center,
    size: p.view.size,
    material: p.view.material,
    ...(p.view.skin ? { skin: p.view.skin } : {}),
    ...(p.view.rungs ? { rungs: p.view.rungs } : {}),
    ...(p.view.slope ? { slope: p.view.slope } : {}),
  }));

const chunk = (id: string) => WORLD_CHUNKS.find((c) => c.id === id)!;
const world = WORLD_CHUNKS.flatMap((c) => blocksOf(c.props));
/** Lublin's chunks (ADR-0045): the market under the viaduct, Grodzka with the footbridge, the deptak. */
const MARKET = "podzamcze-1-0";
const GRODZKA = "stare-miasto-1-1";
const DEPTAK = "krakowskie-2-0";
/** The map's buildings are drawn by the map city: only the game's own blocks are dressed. */
const DRESSED = WORLD_CHUNKS.filter((c) => blocksOf(c.props).length >= 10);
const dress = (blocks: readonly DressBlock[], kit = false) => planDressing({ blocks, world, signs: [], kit, ground: groundY });

describe("procedural dressing (ADR-0027)", () => {
  it("dresses the chunks with the game's buildings without the city kit (W9)", () => {
    expect(DRESSED.map((c) => c.id)).toEqual(expect.arrayContaining([DEPTAK, MARKET, "nabrzeze-1-1"]));
    // The market and the docks are the game's own buildings; the deptak's rooms are cut into the map's.
    expect(dress(blocksOf(chunk(MARKET).props)).vertexCount).toBeGreaterThan(2000);
    expect(dress(blocksOf(chunk("nabrzeze-1-1").props)).vertexCount).toBeGreaterThan(200);
    for (const c of DRESSED) {
      const sink = dress(blocksOf(c.props));
      expect(sink.colors.length / 4).toBe(sink.vertexCount);
      expect(sink.indices.length % 3).toBe(0);
    }
  });

  it("leaves skinned buildings to the kit when it is there", () => {
    const blocks = blocksOf(chunk(MARKET).props);
    const bare = planDressing({ blocks, world, signs: [], kit: false });
    const kit = planDressing({ blocks, world, signs: [], kit: true });
    expect(kit.vertexCount).toBeLessThan(bare.vertexCount / 2);
  });

  it("is deterministic", () => {
    const blocks = blocksOf(chunk(MARKET).props);
    const a = planDressing({ blocks, world, signs: [], kit: false });
    const b = planDressing({ blocks, world, signs: [], kit: false });
    expect(a.positions).toEqual(b.positions);
  });

  it("marks the overpass as a road deck and paints lanes, joints and studs on it (C7)", () => {
    const decks = blocksOf(chunk(MARKET).props).filter((b) => isRoadDeck(b, groundY));
    expect(decks).toHaveLength(1);
    const deck = decks[0]!;
    const sink = dress([deck], true);
    const top = deck.center.y + deck.size.y / 2;
    let onTop = 0;
    let lit = 0;
    let below = 0;
    for (let i = 0; i < sink.vertexCount; i++) {
      const y = sink.positions[i * 3 + 1]!;
      if (y >= top && y < top + 0.25) onTop++;
      if (y < deck.center.y - deck.size.y / 2) below++;
      if (sink.colors[i * 4 + 3] === DRESS_FLAG.lit) lit++;
      // Everything stays over the deck's footprint.
      expect(Math.abs(sink.positions[i * 3]! - deck.center.x)).toBeLessThanOrEqual(deck.size.x / 2 + 1e-6);
      expect(Math.abs(sink.positions[i * 3 + 2]! - deck.center.z)).toBeLessThanOrEqual(deck.size.z / 2 + 1e-6);
    }
    expect(onTop).toBeGreaterThan(500);
    expect(lit).toBeGreaterThan(0);
    expect(below).toBeGreaterThan(0);
    // A footbridge or a balcony is not a road.
    expect(blocksOf(chunk(GRODZKA).props).filter((b) => isRoadDeck(b, groundY))).toHaveLength(0);
  });

  it("finds the walked roofs of the market's south row by their ladders and rails (C8)", () => {
    // The market keeps its own coordinates, moved by MARKET_PLACE (ADR-0045).
    const south = blocksOf(chunk(MARKET).props).filter((b) => isBuilding(b) && b.center.z < MARKET_PLACE.z + 62);
    const walked = south.filter((b) => isWalkedRoof(b, world)).map((b) => Math.round(b.center.x - MARKET_PLACE.x));
    // Glass by the gate, the concrete roof with the stash and the glass roof to the east (railed).
    expect(walked).toEqual(expect.arrayContaining([74, 89]));
    // The hall's east wall, on Ruska's side, is no roof anyone walks.
    const wall = blocksOf(chunk(MARKET).props).find((b) => b.size.x === 2 && b.size.z === 32)!;
    expect(isWalkedRoof(wall, world)).toBe(false);
  });

  it("puts no roof clutter on walked roofs", () => {
    const south = blocksOf(chunk(MARKET).props).filter((b) => isBuilding(b) && isWalkedRoof(b, world));
    for (const b of south) {
      const sink = planDressing({ blocks: [b], world, signs: [], kit: false });
      const top = b.center.y + b.size.y / 2;
      for (let i = 0; i < sink.vertexCount; i++) {
        const x = sink.positions[i * 3]!;
        const z = sink.positions[i * 3 + 2]!;
        const inside = Math.abs(x - b.center.x) < b.size.x / 2 - 0.6 && Math.abs(z - b.center.z) < b.size.z / 2 - 0.6;
        if (inside) expect(sink.positions[i * 3 + 1]!).toBeLessThanOrEqual(top + 0.01);
      }
    }
  });

  it("gives bare structures a procedural skin and keeps windows on buildings (C5)", () => {
    const view = (size: { x: number; y: number; z: number }, material: BlockView["material"]): BlockView => ({ kind: "block", size, material });
    expect(blockPreset(view({ x: 1.4, y: 8.5, z: 1.4 }, "concrete"))).toBe("concreteBare");
    expect(blockPreset(view({ x: 2, y: 8, z: 34 }, "metal"))).toBe("metalPanel");
    expect(blockPreset(view({ x: 0.4, y: 11.1, z: 2.6 }, "concrete"))).toBe("concreteBare");
    expect(blockPreset(view({ x: 60, y: 1.4, z: 10 }, "concrete"))).toBe("concreteBare");
    expect(blockPreset(view({ x: 14, y: 18, z: 14 }, "concrete"))).toBe("concrete");
    expect(blockPreset(view({ x: 14, y: 26, z: 16 }, "glass"))).toBe("glass");
    expect(blockPreset(view({ x: 60, y: 0.2, z: 28 }, "asphalt"))).toBe("asphalt");
    expect(blockPreset({ ...view({ x: 0.6, y: 5, z: 0.08 }, "metal"), rungs: 16 })).toBe("metal");
  });
});

describe("WorldDressing", () => {
  const scene = new Scene(new NullEngine());
  const materials = new ToonMaterials(scene);

  it("builds a chunk's dressing when its blocks stream in and releases it when they go", () => {
    const built: string[] = [];
    const dressing = new WorldDressing(scene, materials, "pending", { built: (m) => built.push(m.name) });
    const props = chunk(MARKET).props.filter(isBlock);
    props.forEach((p, i) => dressing.addBlock(100 + i, p.view, p.center));
    expect(dressing.flush()).toBe(false);
    expect(dressing.meshes).toHaveLength(0);
    dressing.setKit("bare");
    expect(dressing.flush()).toBe(true);
    expect(built).toEqual([`dressing-${MARKET}`]);
    expect([...dressing.residentChunks()]).toEqual([MARKET]);
    const mesh = dressing.meshes[0]!;
    expect(mesh.material).toBe(materials.get("dressing"));
    expect(dressing.flush()).toBe(false);
    props.forEach((_, i) => dressing.remove(100 + i));
    dressing.flush();
    expect(dressing.meshes).toHaveLength(0);
    expect(mesh.isDisposed()).toBe(true);
    expect(dressing.residentChunks().size).toBe(0);
  });

  it("bakes vertex flags the dressing material reads", () => {
    const sink = new MeshSink();
    sink.box({ x: 0, y: 0, z: 0 }, 1, 1, 1, [1, 0, 0, DRESS_FLAG.lit]);
    expect(sink.vertexCount).toBe(24);
    expect(sink.colors[3]).toBe(0);
    expect(materials.get("dressing").options.defines).toContain("DRESS_FLAGS");
    expect(materials.get("concreteBare").options.defines).toContain("CONCRETE_PANELS");
    expect(materials.get("metalPanel").options.defines).toContain("METAL_PANELS");
  });
});
