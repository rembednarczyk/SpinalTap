import { describe, expect, it } from "vitest";
import { ALCHEMIA_MEMORIAL, ALCHEMIA_PIECES } from "../../../packages/sim/src/content/alchemia";
import { LUBLIN_ANCHOR } from "../../../packages/core/src/world/city-geo.ts";
import { box, piece } from "../../../packages/sim/src/content/alchemia/plan";
import { type Glow, MEMORIAL_CLEAR, alchemiaSignGlows, gameNeonGlows, memorialNeonClear, remembrances } from "./alchemia-landmark-checks";

/** A neon's plate a metre square on the plan, its west edge at x. */
const plate = (source: string, x: number, z: number): Glow => ({
  source,
  kind: "neon",
  points: [
    { x, z },
    { x: x + 1, z },
    { x: x + 1, z: z + 1 },
    { x, z: z + 1 },
  ],
});

describe("memorial-neon-clear (ADR-0074 §6, the curator's reviews of Alchemia)", () => {
  const M = ALCHEMIA_MEMORIAL;
  // A stumbling stone of the map at the world's origin (the anchor), and a plaque, which is no stone.
  const places = remembrances([{ lat: LUBLIN_ANCHOR.lat, lon: LUBLIN_ANCHOR.lon, tags: { memorial: "stolperstein", name: "Test" } }, { lat: 0, lon: 0, tags: { memorial: "plaque" } }]);

  it("takes the memorial stone and the map's stumbling stones, not other memorials", () => {
    expect(places.map((p) => p.name)).toEqual(["the memorial of Plac Ofiar Getta", "the stumbling stone Test"]);
  });

  it("finds a sign nearer than 20 m to the memorial or a stone across the plan, one finding a sign, none farther", () => {
    const stone = places[1]!;
    const glows = [plate("a", M.x1 + MEMORIAL_CLEAR - 0.2, M.z0), plate("b", M.x1 + MEMORIAL_CLEAR + 0.1, M.z0), plate("c", stone.x0 - 3, stone.z0 - 0.5)];
    const found = memorialNeonClear(places, glows);
    expect(found.map((f) => f.what.split(" ")[0])).toEqual(["a", "c"]);
    // From its nearest corner, (-2, ±0.5).
    expect(found[1]!.what).toContain("2.1 m off the stumbling stone Test");
    // Letters 1.5 m apart and less are one sign; two signs 3 m apart are two.
    expect(memorialNeonClear(places, [plate("d", M.x0, M.z1 + 3), plate("d", M.x0 + 2.4, M.z1 + 3)])).toHaveLength(1);
    expect(memorialNeonClear(places, [plate("d", M.x0, M.z1 + 3), plate("d", M.x0 + 4, M.z1 + 3)])).toHaveLength(2);
  });

  it("finds a screen of Alchemia's front put up on T2 by the memorial", () => {
    const screen = piece(box(M.x0, M.x1, M.z0 - 6, M.z0 - 5.9, M.y0, M.y1 + 2), "screen", false);
    const plain = alchemiaSignGlows();
    expect(memorialNeonClear(places, plain)).toEqual([]);
    const found = memorialNeonClear(places, alchemiaSignGlows([...ALCHEMIA_PIECES, screen]));
    expect(found).toHaveLength(1);
    expect(found[0]!.what).toMatch(/^Alchemia's front \(C4\) .*screen.* off the memorial/);
  });

  it("counts a sign seen from the ground, not one under the ground at it (Hebi's neon in the shelter under T2)", () => {
    const at = (y: number): Glow => ({ ...plate("a", M.x1 + 3, M.z0), points: plate("a", M.x1 + 3, M.z0).points.map((p) => ({ ...p, y })) });
    const ground = () => -9.2;
    expect(memorialNeonClear(places, [at(-9.2)], ground)).toHaveLength(1);
    expect(memorialNeonClear(places, [at(-9.3)], ground)).toEqual([]);
    // A sign without a known height counts, as does one reaching out of the ground.
    expect(memorialNeonClear(places, [plate("b", M.x1 + 3, M.z0)], ground)).toHaveLength(1);
    expect(memorialNeonClear(places, [{ ...at(-12), points: [...at(-12).points, { x: M.x1 + 3, y: -9, z: M.z0 }] }], ground)).toHaveLength(1);
    // The game's own: the shelter's neon is 14.2 m off the memorial across the plan, its top 0.9 m under T2.
    const hebi = gameNeonGlows().filter((g) => g.source === "device dev:targ-neon");
    expect(hebi).toHaveLength(1);
    expect(memorialNeonClear(places, hebi, () => -Infinity).map((f) => f.what)).toEqual(["device dev:targ-neon neon 14.2 m off the memorial of Plac Ofiar Getta"]);
    expect(memorialNeonClear(places, hebi)).toEqual([]);
  });

  it("sees every source of the game's neons", () => {
    const sources = new Set([...alchemiaSignGlows(), ...gameNeonGlows()].filter((g) => g.points.length > 0).map((g) => g.source.replace(/^(neon|device) .*/, "$1")));
    expect([...sources].sort()).toEqual(["Alchemia's front (C4)", "W-3's TESSEN", "device", "neon", "the arcade house's lettering", "the deptak's neons (C7)", "the food hall's signs (O3)", "the gallery's shop signs (O2)", "the pavilion's neon"].sort());
  });
});
