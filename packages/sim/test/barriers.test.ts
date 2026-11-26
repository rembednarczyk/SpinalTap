import { nearBreakline } from "../src/content/lublin/breaklines";
import { describe, expect, it } from "vitest";
import { BARRIER_PIECE, BARRIER_THICKNESS, type StreetPropItem, barrierLayout } from "@seki/core";
import { Simulation, W3_BARRIERS, WORLD_BARRIERS, WORLD_CHUNKS, WORLD_SCENERY, ground, groundY } from "../src";
import { RETAINED_FACE, barrierPieces, barrierPrism, distanceToBarrier } from "../src/content/lublin/barriers";
import { barrierBlocked } from "../src/content/world-barriers";
import { clearSight, lineOfSight } from "../src/world/hitscan";
import { inPlayerView } from "../src/systems/crime-system";
import { WORLD_STREET_PROPS } from "../src/content/street-props";
import { CROWD_SPOTS } from "../src/content/crowd";
import { input, run, teleportPlayer } from "./helpers";

const all = Object.entries(WORLD_BARRIERS).flatMap(([chunk, items]) => items.map((item) => ({ chunk, item })));
const kindOf = (i: StreetPropItem) => barrierLayout(i.variant).kind;

/** A point `across` metres off a piece's middle, square to it (positive to its right). */
const off = (i: StreetPropItem, across: number) => ({ x: i.x + Math.cos(i.yaw) * across, z: i.z - Math.sin(i.yaw) * across });

/** The first long piece of a kind with the ground on either side clear of every other barrier. */
const lonePiece = (kind: string): { chunk: string; item: StreetPropItem } => {
  const found = all.find(
    ({ item }) =>
      kindOf(item) === kind &&
      barrierLayout(item.variant).length > 2.5 &&
      [-2, -1, 1, 2].every((a) => {
        const p = off(item, a);
        return all.every((o) => o.item === item || distanceToBarrier(o.item, p.x, p.z) > 1.5);
      }),
  );
  if (!found) throw new Error(`no lone ${kind}`);
  return found;
};

describe("the map's barriers in the game (ADR-0077 point 4)", () => {
  it("lays a line in stretches of at most 4 m along it, on the ground, with the ground's rise", () => {
    const line = [
      { x: 0, z: 0 },
      { x: 0, z: 9 },
      { x: 3, z: 9 },
    ];
    const pieces = barrierPieces("fence", 1.6, line, (x, z) => z * 0.1 + x * 0.0);
    expect(pieces).toHaveLength(4);
    const first = barrierLayout(pieces[0]!.variant);
    expect(first).toEqual({ kind: "fence", length: 3, height: 1.6, rise: 0.3, material: "plain" });
    expect(pieces[0]).toMatchObject({ prop: "barrier", x: 0, y: 0.15, z: 1.5, yaw: 0 });
    expect(pieces[3]!.yaw).toBeCloseTo(Math.PI / 2);
    expect(barrierLayout(pieces[3]!.variant).length).toBe(3);
    // A gate is drawn, it has no solid.
    expect(barrierPrism(barrierPieces("gate", 1.6, line.slice(0, 2), () => 0)[0]!)).toBeNull();
  });

  it("lays the map's walls, fences and hedges in the game's chunks, each piece on the ground", () => {
    const kinds = new Map<string, number>();
    for (const { item } of all) {
      const b = barrierLayout(item.variant);
      kinds.set(b.kind, (kinds.get(b.kind) ?? 0) + b.length);
      expect(b.length).toBeLessThanOrEqual(BARRIER_PIECE + 0.01);
      // On the ground at its middle; a piece of the parish church's foundations raised to their level (`levelTop`) on its low end.
      const half = { x: (Math.sin(item.yaw) * b.length) / 2, z: (Math.cos(item.yaw) * b.length) / 2 };
      const lowEnd = Math.min(groundY(item.x - half.x, item.z - half.z), groundY(item.x + half.x, item.z + half.z));
      // A retaining wall on a terrace's breakline from its lower side: the lowest ground at its faces and a metre to either side (T-351, G-971).
      const across = { x: Math.cos(item.yaw), z: -Math.sin(item.yaw) };
      const stepped = b.kind === "retaining-wall" && nearBreakline(item.x, item.z);
      const sides = [RETAINED_FACE, -RETAINED_FACE, 1, -1].map((d) => groundY(item.x + across.x * d, item.z + across.z * d));
      const ground = stepped ? Math.min(...sides) : groundY(item.x, item.z);
      expect(Math.min(Math.abs(item.y - ground), b.rise === 0 ? Math.abs(item.y - lowEnd) : Infinity), `${item.x},${item.z}`).toBeLessThan(0.05);
    }
    expect(kinds.get("wall")).toBeGreaterThan(1500);
    expect(kinds.get("fence")).toBeGreaterThan(4000);
    expect(kinds.get("hedge")).toBeGreaterThan(700);
    // Drawn with the furniture, one view a chunk with barriers; a solid a piece in the chunk's street.
    // W-3's own fences (ADR-0082) come in views of their own after the map's.
    const ours = new Set(W3_BARRIERS);
    const views = WORLD_SCENERY.filter((s) => s.view.kind === "street-props" && s.view.items.some((i) => i.prop === "barrier") && !s.view.items.every((i) => ours.has(i)));
    expect(views).toHaveLength(Object.keys(WORLD_BARRIERS).length);
    for (const c of WORLD_CHUNKS) {
      const solids = (WORLD_BARRIERS[c.id] ?? []).filter((i) => barrierPrism(i) !== null).length;
      expect(c.street?.filter((p) => p.prisms?.length === 1 && p.seeThrough && p.view.kind === "street-props").length ?? 0).toBeGreaterThanOrEqual(solids);
    }
  });

  it("leaves no piece where the game needs the way clear", () => {
    for (const { item } of all) {
      if (barrierPrism(item) === null) continue;
      const b = barrierLayout(item.variant);
      for (const t of [-0.5, 0, 0.5]) {
        const p = { x: item.x + Math.sin(item.yaw) * b.length * t * 0.9, z: item.z + Math.cos(item.yaw) * b.length * t * 0.9 };
        // On the line or a hair either side of it: the piece's place is rounded to the centimetre.
        const half = BARRIER_THICKNESS[b.kind] / 2;
        const dir = { x: Math.sin(item.yaw), z: Math.cos(item.yaw) };
        // A retaining wall at a terrace's edge stands along its flight (T-351).
        const edge = b.kind === "retaining-wall" && nearBreakline(p.x, p.z);
        const clear = [0, 0.05, -0.05].some((a) => !barrierBlocked(p.x + Math.cos(item.yaw) * a, p.z - Math.sin(item.yaw) * a, half, dir, edge));
        expect(clear, `${b.kind} at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`).toBe(true);
      }
    }
  });

  it("cut through no café garden and no resident's place (G-612)", () => {
    const gardens = Object.values(WORLD_STREET_PROPS)
      .flat()
      .filter((i) => i.prop === "cafe-garden");
    expect(gardens.length).toBeGreaterThan(5);
    for (const g of gardens) expect(barrierBlocked(g.x, g.z)).toBe(true);
    for (const s of CROWD_SPOTS) expect(barrierBlocked(s.at.x + 0.4, s.at.z)).toBe(true);
  });

  it("a fence stops the player walking into it", () => {
    const { item } = lonePiece("fence");
    const sim = Simulation.create({ seed: 1 });
    const from = off(item, 1.5);
    teleportPlayer(sim, ground(from.x, from.z), item.yaw - Math.PI / 2);
    run(sim, 2);
    run(sim, 90, input({ moveZ: 1 }));
    const p = sim.player()!.position;
    expect(distanceToBarrier(item, p.x, p.z)).toBeGreaterThan(0.2);
    // Still on its own side.
    expect((p.x - item.x) * Math.cos(item.yaw) - (p.z - item.z) * Math.sin(item.yaw)).toBeGreaterThan(0);
  });

  it("the eye sees through a fence and a hedge, not through a wall; a walk and a shot pass none", () => {
    const sim = Simulation.create({ seed: 1 });
    for (const [kind, seen] of [
      ["fence", true],
      ["hedge", true],
      ["wall", false],
    ] as const) {
      const { item } = lonePiece(kind);
      teleportPlayer(sim, ground(item.x, item.z + 3));
      run(sim, 2);
      const [a, b] = [off(item, 1.2), off(item, -1.2)];
      const at = (p: { x: number; z: number }) => ({ x: p.x, y: groundY(p.x, p.z) + 0.6, z: p.z });
      expect(clearSight(sim.world, at(a), at(b)), kind).toBe(seen);
      expect(lineOfSight(sim.world, at(a), at(b)), kind).toBe(false);
      // The crimes' witnesses look the same way (G-611): through a fence or a hedge (over a low wall too).
      const p = sim.player()!;
      p.position = { ...at(a), y: groundY(a.x, a.z) };
      p.yaw = Math.atan2(b.x - a.x, b.z - a.z);
      if (seen) expect(inPlayerView({ world: sim.world } as never, p, { ...at(b), y: groundY(b.x, b.z) }), kind).toBe(true);
    }
  });
});

describe("retaining walls off the terrace's breaklines (the curator's review of T-351)", () => {
  it("stand on their axis's ground at their mapped height: no wall grows off a breakline", () => {
    let seen = 0;
    for (const { item } of all) {
      const b = barrierLayout(item.variant);
      if (b.kind !== "retaining-wall" || nearBreakline(item.x, item.z)) continue;
      seen++;
      // Its height is the map's tag (or the import's default); never the 12.7 m a read off the map gave.
      expect(b.height, `${item.x},${item.z}`).toBeLessThanOrEqual(6);
    }
    expect(seen).toBeGreaterThan(100);
  });
});

describe("a retaining wall by a stair flight (G-972)", () => {
  it("keeps its parapet over the upper side at both ends of a piece, the flight rising along it", () => {
    // A wall along x, its lower side north (z > 0) at -4.7, its upper side south rising 0.45 m a metre
    // along it, as a flight's ramp beside the wall: a piece's top read at its middle alone fell under the
    // steps at its upper end (the curator's review of #1038: x 587.4-587.8, the edge unguarded over 1.3 m).
    const upper = (x: number) => -4.7 + 0.45 * x;
    const ground = (x: number, z: number) => (z > 0.3 ? -4.7 : upper(x));
    const pieces = barrierPieces("retaining-wall", 1.2, [{ x: 0, z: 0 }, { x: 5.4, z: 0 }], ground, "plain", () => true);
    expect(pieces.length).toBeGreaterThan(1);
    for (const item of pieces) {
      const b = barrierLayout(item.variant);
      const top = item.y + b.height + Math.abs(b.rise) / 2;
      const end = item.x + b.length / 2;
      // The variant keeps the height in tenths, rounded: the top may fall half a tenth short.
      expect(top, `piece at ${item.x}`).toBeGreaterThanOrEqual(upper(end) + 0.5 - 0.06);
    }
  });
});
