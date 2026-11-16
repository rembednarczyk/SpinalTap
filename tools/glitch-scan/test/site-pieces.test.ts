import { describe, expect, it } from "vitest";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { siteFenceVariant, siteGateVariant } from "../../../packages/core/src/world/sites.ts";
import { type SiteGroundQuery, siteGateBlocked, siteOnRoad, siteThroughWall } from "./site-pieces";

/** The building sites' checks of ADR-0087 on a plan: a pavement south of z 0, a carriageway south of z -3, a building east of x 20. */
const ground = (barriers: SiteGroundQuery["barriers"] = []): SiteGroundQuery => ({
  surfaceAt: (p) => (p.x > 20 ? "building" : p.z < -3 ? "road" : p.z < 0 ? "walk" : null),
  barriers,
});

const fence = (x: number, z: number, yaw = Math.PI, length = 2.5): StreetPropItem => ({ prop: "site-fence", x, y: 0, z, yaw, variant: siteFenceVariant({ length, rise: 0, ad: null, led: 0 }) });
const gate = (x: number, z: number, wicket = false): StreetPropItem => ({ prop: "site-gate", x, y: 0, z, yaw: Math.PI, variant: siteGateVariant(wicket, 0, true) });
const cabin = (x: number, z: number): StreetPropItem => ({ prop: "site-cabin", x, y: 0, z, yaw: 0, variant: 0 });

describe("the building sites' checks (ADR-0087)", () => {
  it("finds a piece of a site on a carriageway or a pavement, and only that", () => {
    expect(siteOnRoad([fence(5, 0.3), cabin(5, 6)], ground())).toEqual([]);
    expect(siteOnRoad([fence(5, 0)], ground()).map((f) => f.what)).toEqual([expect.stringMatching(/^site-fence on walk/)]);
    expect(siteOnRoad([cabin(5, 0.5)], ground())).toHaveLength(1);
    // Furniture of other kinds is not the check's.
    expect(siteOnRoad([{ ...cabin(5, -5), prop: "bench" }], ground())).toEqual([]);
  });

  it("finds a piece of a site in a building or by a wall of the map", () => {
    expect(siteThroughWall([fence(17, 0.3)], ground())).toEqual([]);
    expect(siteThroughWall([fence(19.5, 0.3)], ground()).map((f) => f.what)).toEqual([expect.stringMatching(/in a building/)]);
    const wall = [
      [
        { x: 0, z: 0.4 },
        { x: 10, z: 0.4 },
      ],
    ];
    expect(siteThroughWall([fence(5, 0.3)], ground(wall)).map((f) => f.what)).toEqual([expect.stringMatching(/by a wall/)]);
  });

  it("finds a gate whose way in a building or a solid blocks, before or behind it", () => {
    expect(siteGateBlocked([gate(8, 0.3), fence(8 - 3 - 0.15 - 1.25, 0.3), fence(8 + 3 + 0.15 + 1.25, 0.3)], ground())).toEqual([]);
    // A container right behind the opening.
    expect(siteGateBlocked([gate(8, 0.3), cabin(8, 2.3)], ground())).toHaveLength(1);
    // A wicket against a building's wall.
    expect(siteGateBlocked([gate(19.9, 0.3, true)], ground()).map((f) => f.what)).toEqual([expect.stringMatching(/^wicket blocked/)]);
  });
});
