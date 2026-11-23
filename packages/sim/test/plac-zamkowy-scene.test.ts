import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { PLAC_ZAMKOWY_DETAIL, PLAC_ZAMKOWY_METRO, PLAC_ZAMKOWY_STALLS, WORLD_SCENERY, inBuilding } from "../src";

/*
 * Plac Zamkowy's flea market after its card (`docs/lokacje/plac-zamkowy.md`, ADR-0102 point 5): every stall on the
 * square dressed where it stands, facing as it faces; the metro pavilion's lamp on its wall at the opening.
 */
const keyOf = (variant: number): string => ROOM_DETAIL_SHAPES[variant]!.key;

describe("Plac Zamkowy's scene (ADR-0102 point 5)", () => {
  it("dresses each of the square's stalls where it stands", () => {
    expect(PLAC_ZAMKOWY_STALLS.length).toBeGreaterThanOrEqual(5);
    const dressed = PLAC_ZAMKOWY_DETAIL.filter((i) => keyOf(i.variant) === "rd-pz-stall");
    expect(dressed.map((d) => [d.x, d.z, d.yaw])).toEqual(PLAC_ZAMKOWY_STALLS.map((s) => [s.x, s.z, s.yaw]));
    for (const d of dressed) expect(inBuilding(d.x, d.z)).toBe(false);
  });

  it("hangs the green lamp at the metro pavilion's opening, on its wall", () => {
    const lamp = PLAC_ZAMKOWY_DETAIL.find((i) => keyOf(i.variant) === "rd-pz-metro-lamp")!;
    expect(Math.hypot(lamp.x - PLAC_ZAMKOWY_METRO.at.x, lamp.z - PLAC_ZAMKOWY_METRO.at.z)).toBeLessThan(1e-9);
    expect(Math.hypot(lamp.x - 722, lamp.z - 286)).toBeLessThan(4);
    expect(WORLD_SCENERY.some((s) => s.view.kind === "street-props" && s.view.items === PLAC_ZAMKOWY_DETAIL)).toBe(true);
  });
});
