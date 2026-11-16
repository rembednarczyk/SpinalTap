import { describe, expect, it } from "vitest";
import { siteCraneLayout } from "@seki/core";
import { LUBLIN_CONSTRUCTION_SITES, sitePieces } from "@seki/sim/lublin";
import { MeshSink } from "../src/renderer/mesh-sink";
import { BOARD_LINES, SiteTexts, boardText, planSiteSigns, siteBoardSpots } from "../src/renderer/mapcity/construction/site-signs";
import { CLEAR, siteDroneLane, siteDroneLanes } from "../src/renderer/mapcity/construction/site-drones";
import { CRANE_HEAD, HOOK_DROP } from "../src/renderer/mapcity/construction/site-crane";
import { DRONE_LAYER, DRONE_SIZE, BOB, droneFleet, dronePose } from "../src/renderer/drones/drone-flight";
import { MAP_SIGN_KIND } from "../src/renderer/mapcity/sign-plan";

/** The building sites' lights, letters and drones of ADR-0087 stage 2 in the renderer. */

const zielona = LUBLIN_CONSTRUCTION_SITES.find((s) => s.id === "w770678456")!;
const all = { minX: -1e6, maxX: 1e6, minZ: -1e6, maxZ: 1e6 };
const flat = () => 0;
/** The kinds of the sign quads in a sink (uv2.y of each quad's first corner). */
const kinds = (s: MeshSink): number[] => Array.from({ length: s.vertexCount / 4 }, (_, q) => s.uvs2[q * 8 + 1]!);

describe("the building sites' signs (ADR-0087 stage 2)", () => {
  const texts = { [zielona.board!.name]: "Goat Plaza", [zielona.board!.developer]: "Developer: Sakura-Wisła Development", [zielona.board!.term]: "Completion: 2080 (delayed)" };

  it("lights the crane's beacon on its tower head, blinking at its phase, steady on the phones", () => {
    const sink = new MeshSink();
    planSiteSigns(sink, all, {}, false, [zielona], flat);
    const crane = sitePieces([zielona]).find((p) => p.prop === "site-crane")!;
    expect(kinds(sink)).toEqual([MAP_SIGN_KIND.strobe, MAP_SIGN_KIND.strobe, MAP_SIGN_KIND.strobe, MAP_SIGN_KIND.strobe]);
    const ys = Array.from({ length: sink.vertexCount }, (_, i) => sink.positions[i * 3 + 1]!);
    expect(Math.min(...ys)).toBeGreaterThan(siteCraneLayout(crane.variant).height - 0.2);
    // Its phase from the seed, in the quad's seed.
    expect(sink.uvs2[0]).toBeCloseTo(siteCraneLayout(crane.variant).phase / 16, 6);
    const lite = new MeshSink();
    planSiteSigns(lite, all, {}, true, [zielona], flat);
    expect(new Set(kinds(lite))).toEqual(new Set([MAP_SIGN_KIND.tube]));
  });

  it("writes the board's three lines in the language handed over, nothing without the texts", () => {
    const bare = new MeshSink();
    planSiteSigns(bare, all, {}, false, [zielona], flat);
    const sink = new MeshSink();
    planSiteSigns(sink, all, texts, false, [zielona], flat);
    const glyphs = kinds(sink).filter((k) => k === MAP_SIGN_KIND.glyph).length;
    const letters = [...`${boardText(texts[zielona.board!.name]!)}${boardText(texts[zielona.board!.developer]!)}${boardText(texts[zielona.board!.term]!)}`].filter((c) => c !== " ").length;
    expect(glyphs).toBe(letters);
    expect(kinds(bare).filter((k) => k === MAP_SIGN_KIND.glyph)).toEqual([]);
    // On the board's face, between its lines' heights.
    const board = sitePieces([zielona]).find((p) => p.prop === "site-board")!;
    const ys = Array.from({ length: sink.vertexCount }, (_, i) => sink.positions[i * 3 + 1]!).filter((y) => y < 5);
    expect(Math.max(...ys)).toBeLessThanOrEqual(BOARD_LINES[0].y + BOARD_LINES[0].h / 2 + 1e-6);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(BOARD_LINES[2].y - BOARD_LINES[2].h / 2 - 1e-6);
    expect(siteBoardSpots([zielona]).some((b) => board.x >= b.minX && board.x <= b.maxX && board.z >= b.minZ && board.z <= b.maxZ)).toBe(true);
    // Only the pieces in the cell.
    expect(planSiteSigns(new MeshSink(), { minX: 0, maxX: 1, minZ: 0, maxZ: 1 }, texts, false, [zielona], flat)).toBe(0);
  });

  it("draws a text as the atlas can: upper case, Polish letters kept, the rest a space", () => {
    expect(boardText("Zakończenie: III kwartał 2078")).toBe("ZAKOŃCZENIE: III KWARTAŁ 2078");
    expect(boardText("Completion: 2080 (delayed)")).toBe("COMPLETION: 2080 DELAYED");
  });

  it("moves its version only when the texts change", () => {
    const t = new SiteTexts();
    t.set(texts);
    t.set({ ...texts });
    expect(t.version).toBe(1);
    t.set({ ...texts, [zielona.board!.term]: "Zakończenie: 2080 (opóźnione)" });
    expect(t.version).toBe(2);
  });
});

describe("the building sites' delivery drone (ADR-0087 stage 2)", () => {
  it("flies from the gate to the dig and back, over the fence and under the crane's hook", () => {
    const lane = siteDroneLane(zielona, flat)!;
    const gate = sitePieces([zielona]).find((p) => p.prop === "site-gate")!;
    expect(lane.points[0]).toEqual({ x: gate.x, z: gate.z });
    expect(lane.kind).toBe("delivery");
    const feet = lane.levels[0]! + DRONE_LAYER.delivery.above + BOB;
    expect(feet).toBeCloseTo(CLEAR, 6);
    const crane = siteCraneLayout(sitePieces([zielona]).find((p) => p.prop === "site-crane")!.variant);
    const hook = crane.height - CRANE_HEAD + 0.6 - HOOK_DROP - 0.8;
    expect(hook - (feet + BOB + DRONE_SIZE.delivery.height)).toBeGreaterThan(2);
    // One drone, its place on the loop from the seed; none on the phones.
    const [drone] = droneFleet([lane], "high");
    expect(droneFleet([lane], "high")).toHaveLength(1);
    expect(drone!.kind).toBe("delivery");
    expect(dronePose(drone!, 0)).not.toEqual(dronePose(droneFleet([{ ...lane, seed: lane.seed + 1 }], "high")[0]!, 0));
    expect(droneFleet([lane], "low")).toEqual([]);
    expect(siteDroneLanes(LUBLIN_CONSTRUCTION_SITES, flat).map((l) => l.seed)).toEqual([zielona.seed]);
  });
});
