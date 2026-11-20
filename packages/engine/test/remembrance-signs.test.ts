import { MEMORIAL_CLEAR, type RemembrancePlace } from "@seki/sim";
import { describe, expect, it } from "vitest";
import { MeshSink } from "../src/renderer/mesh-sink";
import { type AcrossAt, findSpans } from "../src/renderer/mapcity/canyon-plan";
import { planCanyonSigns } from "../src/renderer/mapcity/canyon-signs";
import { type MapBuilding, facadeFrame } from "../src/renderer/mapcity/facade-frame";
import { remembranceNear } from "../src/renderer/mapcity/map-building";
import { type P2, cleanRing, pointInRing } from "../src/renderer/mapcity/polygon";
import { MAP_SIGN_KIND, planBuildingSigns } from "../src/renderer/mapcity/sign-plan";
import { planVenueSigns, venueBoards } from "../src/renderer/mapcity/venue-plan";

/**
 * The map's signs keep off the places of remembrance (ADR-0074 §6, G-943): on a street of two
 * tenements a stumbling stone lies in front of the middle of the long one; no glowing sign comes
 * nearer it than 20 m across the plan, and the signs farther off stay where they were.
 */

const rect = (x0: number, z0: number, x1: number, z1: number): P2[] => cleanRing([{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }]);
const none = () => null;
const stone = (p: P2): RemembrancePlace => ({ name: "the stumbling stone Test", x0: p.x, x1: p.x, z0: p.z, z1: p.z });
const STONE = stone({ x: 30, z: 15 });
/** The kinds the glitch scan's `memorial-neon-clear` counts. */
const GLOWING = new Set<number>([MAP_SIGN_KIND.board, MAP_SIGN_KIND.holo, MAP_SIGN_KIND.tube, MAP_SIGN_KIND.blade, MAP_SIGN_KIND.disc, MAP_SIGN_KIND.ad, MAP_SIGN_KIND.venue, MAP_SIGN_KIND.glyph, MAP_SIGN_KIND.screen]);

/** A tall lively tenement 60 m along the street (z = 14), its superstructure, clutter and shop windows. */
const tenement = (look: number, extra: Partial<MapBuilding> = {}): MapBuilding => ({ id: 1, ring: rect(0, 0, 60, 14), base: 0, foot: 0, height: 26, levels: 8, use: "residential", look, roof: 3, shopfront: true, rise: 12, clutter: 1, ...extra });
const across = facadeFrame({ ...tenement(0x5151), id: 2, ring: rect(0, 32, 60, 46) }, none);
const acrossAt: AcrossAt = (x, z, self) => (self !== 2 && pointInRing({ x, z }, across.b.ring) ? { id: 2, top: across.top, clutter: 1 } : null);

type Quad = { readonly kind: number; readonly key: string; readonly off: number; readonly mid: P2; readonly long: number };

/** Every glowing quad of a building's signs, how far its outline on the plan comes to the stone, and its middle. */
const glows = (b: MapBuilding, stone: P2 = { x: 0, z: 0 }): Quad[] => {
  const f = facadeFrame(b, none);
  const sink = new MeshSink();
  planBuildingSigns(sink, f, () => 0);
  planVenueSigns(sink, f);
  planCanyonSigns(sink, [f], findSpans(f, acrossAt), false);
  const out: Quad[] = [];
  for (let v = 0; v + 3 < sink.vertexCount; v += 4) {
    const kind = sink.uvs2[v * 2 + 1]!;
    if (!GLOWING.has(kind)) continue;
    const p = [0, 1, 2, 3].map((k) => ({ x: sink.positions[(v + k) * 3]!, y: sink.positions[(v + k) * 3 + 1]!, z: sink.positions[(v + k) * 3 + 2]! }));
    let off = Infinity;
    for (let k = 0; k < 4; k++) {
      const [a, c] = [p[k]!, p[(k + 1) % 4]!];
      for (let t = 0; t <= 1; t += 0.05) off = Math.min(off, Math.hypot(a.x + (c.x - a.x) * t - stone.x, a.z + (c.z - a.z) * t - stone.z));
    }
    out.push({ kind, off, long: Math.hypot(p[1]!.x - p[0]!.x, p[1]!.z - p[0]!.z), mid: { x: p.reduce((m, q) => m + q.x, 0) / 4, z: p.reduce((m, q) => m + q.z, 0) / 4 }, key: `${kind}:${p.map((q) => `${q.x.toFixed(3)},${q.y.toFixed(3)},${q.z.toFixed(3)}`).join(" ")}` });
  }
  return out;
};

/** The first look whose tenement hangs every kind of the map's signs: a board, a blade, the cornice's tube, a hologram and ads. */
const LIVELY = Array.from({ length: 4000 }, (_, i) => i).find((look) => {
  const { style } = facadeFrame(tenement(look), none);
  const kinds = new Set(glows(tenement(look)).map((q) => q.kind));
  return style.cornice && style.neonTrim !== null && [MAP_SIGN_KIND.board, MAP_SIGN_KIND.blade, MAP_SIGN_KIND.holo, MAP_SIGN_KIND.ad].every((k) => kinds.has(k));
})!;

describe("the map's signs by a place of remembrance (ADR-0074 §6, G-943)", () => {
  const venues = [5, 30, 55].map((x, i) => ({ x, z: 13.5, name: ["KAWA", "PIEROGI", "APTEKA"][i]!, color: "#ff2e88" }));
  const cases: [string, number, Partial<MapBuilding>][] = [
    ["a shop's board", MAP_SIGN_KIND.board, {}],
    ["a blade", MAP_SIGN_KIND.blade, {}],
    ["a hologram", MAP_SIGN_KIND.holo, {}],
    ["an advert", MAP_SIGN_KIND.ad, {}],
    ["a tube", MAP_SIGN_KIND.tube, {}],
    ["a venue's board", MAP_SIGN_KIND.venue, { venues }],
    ["an Old Town's bracket sign", MAP_SIGN_KIND.disc, { bracketSigns: true }],
  ];

  for (const [what, kind, extra] of cases) {
    it(`leaves out every sign nearer than 20 m to a stone under ${what}, and moves none of the others`, () => {
      // The cornice's tube, not a strip of a curtain.
      const first = glows(tenement(LIVELY, extra)).find((q) => q.kind === kind && (kind !== MAP_SIGN_KIND.tube || q.long > 2 * MEMORIAL_CLEAR));
      expect(first).toBeDefined();
      const at = first!.mid;
      const plain = glows(tenement(LIVELY, extra), at);
      const quiet = glows(tenement(LIVELY, { ...extra, remembrance: [stone(at)] }), at);
      expect(quiet.filter((q) => q.off < MEMORIAL_CLEAR - 1e-6).map((q) => q.key)).toEqual([]);
      expect(quiet.length).toBeGreaterThan(0);
      // What is left of the tube past the zone stays.
      if (kind === MAP_SIGN_KIND.tube) expect(quiet.some((q) => q.kind === kind && q.long > 2 && q.off < MEMORIAL_CLEAR + 1)).toBe(true);
      // Every sign of the quiet street stood there before; only a tube is cut at the zone's edge.
      const before = new Set(plain.map((q) => q.key));
      expect(quiet.filter((q) => q.kind !== MAP_SIGN_KIND.tube && !before.has(q.key)).map((q) => q.key)).toEqual([]);
      const after = new Set(quiet.map((q) => q.key));
      expect(plain.filter((q) => q.kind !== MAP_SIGN_KIND.tube && q.off >= MEMORIAL_CLEAR + 1 && !after.has(q.key)).map((q) => q.key)).toEqual([]);
    });
  }

  it("keeps a hushed venue's board in the plan, so the doors and awnings under it stay as they were", () => {
    const plain = venueBoards(facadeFrame(tenement(LIVELY, { venues }), none));
    const quiet = venueBoards(facadeFrame(tenement(LIVELY, { venues, remembrance: [STONE] }), none));
    expect(quiet.map(({ hushed: _h, ...b }) => b)).toEqual(plain);
    expect(quiet.map((b) => [b.text, b.hushed ?? false])).toEqual([
      ["KAWA", false],
      ["PIEROGI", true],
      ["APTEKA", false],
    ]);
  });

  it("gives a building the places its signs and the spans over its streets may reach", () => {
    const far: RemembrancePlace = { ...STONE, name: "far", x0: 130, x1: 130 };
    const box: RemembrancePlace = { name: "a memorial", x0: -60, x1: -40, z0: 5, z1: 6 };
    expect(remembranceNear(rect(0, 0, 60, 14), [STONE, far, box]).map((r) => r.name)).toEqual(["the stumbling stone Test", "a memorial"]);
  });
});
