import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "../../../packages/core/src";
import { INTERIORS } from "../../../packages/sim/src/content/interior-areas";
import { clusters, thingsIn } from "../src/measures";

const room = (id: string) => thingsIn(INTERIORS.find((i) => i.id === id)!);
const shape = (key: string) => ROOM_DETAIL_SHAPES.find((s) => s.key === key)!;

/** §14's layers as the measures read them: a model that is a clutter cluster, the services on show, what is no thing. */
describe("the rooms' measures of clutter (§14)", () => {
  it("counts a model holding a clutter cluster as that many hand-sized things in one cluster", () => {
    const n = shape("rd-w3h-break").clutter!;
    expect(n).toBeGreaterThanOrEqual(3);
    const t = room("w3-hall").filter((x) => x.name === "rd-w3h-break");
    expect(t).toHaveLength(n);
    expect(t.every((x) => x.layer === "mikro")).toBe(true);
    expect(clusters(t)).toEqual({ clusters: 1, clustered: n, strays: 0 });
  });

  it("puts the services on show into the architecture and a model with no clutter into meso", () => {
    expect(shape("rd-w3b-pipes").services).toBe(true);
    const basement = room("w3-basement");
    for (const k of ["rd-w3b-pipes", "rd-w3b-handrail-a", "rd-w3b-brick-wide"]) expect(basement.find((x) => x.name === k)?.layer, k).toBe("architektura");
    expect(room("w3-hall").find((x) => x.name === "rd-w3h-barrels")?.layer).toBe("mezo");
  });

  it("does not count the kitchens' steam, and counts the menus' screens and coffee machines as meso", () => {
    const hall = room("alchemia-foodhall");
    expect(hall.some((x) => x.name === "steam")).toBe(false);
    for (const k of ["display", "machine"]) {
      const of = hall.filter((x) => x.name === k);
      expect(of.length, k).toBeGreaterThan(0);
      expect(of.every((x) => x.layer === "mezo"), k).toBe(true);
    }
  });
});
