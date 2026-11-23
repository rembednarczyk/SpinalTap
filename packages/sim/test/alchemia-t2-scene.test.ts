import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { ALCHEMIA_MEMORIAL, ALCHEMIA_T2, HEBI_LOOKOUT_POST, T2_DETAIL, T2_HEBI_RING, T2_SETTLEMENT, T2_STAIRS, T2_STONE, TERRITORY_GROUPS, WORLD_SCENERY, onT2 } from "../src";

/*
 * T2 under the Arkady after its card (`docs/lokacje/alchemia-t2-arkady.md`, ADR-0102 point 5): the stone's cut name and
 * tributes on the stone facing the stairs, the settlement's outline on the square clear of the stone's bed, the stairs
 * and the lookout, the leavings where the lookout and the Hebi group stand.
 */

const keyOf = (variant: number): string => ROOM_DETAIL_SHAPES[variant]!.key;
const modelOf = (key: string) => T2_DETAIL.find((i) => keyOf(i.variant) === key)!;
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe("Alchemia's T2 scene (ADR-0102 point 5)", () => {
  it("puts the cut name and the tributes on the memorial stone, facing south to the stairs from T1", () => {
    const m = modelOf("rd-t2-tribute");
    expect(flat(m, T2_STONE)).toBeLessThan(1e-9);
    expect(T2_STONE.x).toBeCloseTo((ALCHEMIA_MEMORIAL.x0 + ALCHEMIA_MEMORIAL.x1) / 2, 9);
    // Its front (+z) turned south, towards the stairs' foot.
    expect(Math.cos(m.yaw)).toBeCloseTo(-1, 9);
    expect(T2_STAIRS.b.z).toBeLessThan(T2_STONE.z);
    expect(m.y).toBeCloseTo(ALCHEMIA_T2, 1);
  });

  it("lays the settlement's outline on the square, 11.3 x 10.5 m, clear of the stone's bed, the stairs and the posts", () => {
    const m = modelOf("rd-t2-settlement");
    expect(flat(m, T2_SETTLEMENT)).toBeLessThan(1e-9);
    const hx = 11.32 / 2;
    const hz = 10.52 / 2;
    for (const [x, z] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]] as const) expect(onT2(m.x + x, m.z + z), `${x},${z}`).toBe(true);
    // The stone's bed (to x 431.7 from z 110.4), the stairs' foot (z 92.5) and the lookout stay off it.
    expect(m.z + hz).toBeLessThan(110.4);
    expect(m.z - hz).toBeGreaterThan(T2_STAIRS.b.z);
    expect(Math.abs(HEBI_LOOKOUT_POST.x - m.x) > hx || Math.abs(HEBI_LOOKOUT_POST.z - m.z) > hz).toBe(true);
  });

  it("leaves the lookout's crate and radio at his post and the group's leavings in its ring", () => {
    expect(flat(modelOf("rd-t2-lookout"), HEBI_LOOKOUT_POST)).toBeLessThan(1e-9);
    const group = TERRITORY_GROUPS.find((g) => g.territory === "alchemia-arcades")!;
    expect(flat(group.core, T2_HEBI_RING)).toBeLessThan(1e-9);
    expect(flat(modelOf("rd-t2-hebi"), T2_HEBI_RING)).toBeLessThan(1e-9);
    for (const i of T2_DETAIL) expect(onT2(i.x, i.z)).toBe(true);
    expect(WORLD_SCENERY.some((s) => s.view.kind === "street-props" && s.view.items === T2_DETAIL)).toBe(true);
  });
});
