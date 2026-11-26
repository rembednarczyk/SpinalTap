import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { PLAC_ZAMKOWY_DETAIL, PLAC_ZAMKOWY_METRO, PLAC_ZAMKOWY_STALLS, WORLD_CHUNKS, WORLD_SCENERY, groundY, inBuilding } from "../src";
import { PLAC_ZAMKOWY_SIGNS } from "../src/content/plac-zamkowy-detail";

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

  it("stands the market's neon on the pavilion's roof, one side facing the stalls and one the opening (its card, §13)", () => {
    expect(PLAC_ZAMKOWY_SIGNS).toHaveLength(2);
    const facing = (f: string) => PLAC_ZAMKOWY_SIGNS.find((p) => p.view.kind === "neon" && p.view.facing === f)!;
    const [south, north] = [facing("z-"), facing("z+")];
    for (const sign of [south, north]) {
      expect(sign.view).toMatchObject({ kind: "neon", label: "TARG ZAMKOWY" });
      expect(Math.abs(sign.center.x - PLAC_ZAMKOWY_METRO.at.x)).toBeLessThan(1e-9);
      // On the roof (3.1 m and its 0.2 m slab), streamed with its chunk.
      expect(sign.center.y - 0.3 - groundY(PLAC_ZAMKOWY_METRO.at.x, PLAC_ZAMKOWY_METRO.at.z)).toBeGreaterThanOrEqual(3.3);
      expect(WORLD_CHUNKS.some((c) => c.street?.some((p) => p === sign))).toBe(true);
    }
    // The north side over the opening, a little behind its front; the south side faces the market, every stall south of it.
    expect(PLAC_ZAMKOWY_METRO.at.z - north.center.z).toBeGreaterThan(0);
    expect(PLAC_ZAMKOWY_METRO.at.z - north.center.z).toBeLessThan(0.5);
    expect(south.center.z).toBeLessThan(north.center.z - 5);
    const stalls = PLAC_ZAMKOWY_STALLS.filter((s) => s.z < south.center.z);
    expect(stalls.length).toBeGreaterThanOrEqual(PLAC_ZAMKOWY_STALLS.length - 2);
  });
});
