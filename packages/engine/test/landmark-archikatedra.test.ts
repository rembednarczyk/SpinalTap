import { describe, expect, it } from "vitest";
import { porticoOf } from "@seki/sim/lublin";
import { ARCHIKATEDRA } from "../src/renderer/mapcity/landmarks/archikatedra";
import { axisOn } from "../src/renderer/mapcity/landmarks/cathedral-front";
import type { Wall } from "../src/renderer/mapcity/facade-frame";

/**
 * The Archikatedra's front in bays (T-349 stage K2): the pilasters behind the portico stand behind
 * the simulation's columns, and the storeys over it share their axis with the portal's door.
 */

const front = (id: string) => ARCHIKATEDRA.parts.find((p) => p.osm === id)!.tier.westFront!;

describe("the Archikatedra's front (T-349, K2)", () => {
  it("measures the bays from where the axis meets a wall", () => {
    const w = { a: { x: 0, z: 0 }, b: { x: 10, z: 0 }, length: 10 } as unknown as Wall;
    expect(axisOn(w, { x: 4, z: 5 })).toBeCloseTo(4, 6);
  });

  it("stands a pilaster behind each column of the portico, the door in the middle bay", () => {
    const vestibule = front("w66286341");
    const columns = porticoOf("w66286341")!.columns;
    // Along the front (the columns' line), the offsets of the columns from the portal's axis.
    const [a, b] = [columns[0]!, columns[columns.length - 1]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const along = (p: { x: number; z: number }) => ((p.x - vestibule.axis.x) * (b.x - a.x) + (p.z - vestibule.axis.z) * (b.z - a.z)) / len;
    const offsets = columns.map(along).sort((p, q) => p - q);
    const pilasters = [...vestibule.pilasters!].sort((p, q) => p - q);
    offsets.forEach((o, k) => expect(Math.abs(o - pilasters[k]!), `column ${k}`).toBeLessThan(0.35));
    expect(vestibule.doors!.map((d) => d.at)).toEqual([0]);
  });

  it("lines the upper storeys' windows up over the portal, the sun in the screen front's pediment", () => {
    const nave = front("w617763433");
    const screen = front("T-349/katedra-fronton");
    expect(nave.windows!.some((o) => o.at === 0 && o.y0 >= 14 && o.y1 <= 25)).toBe(true);
    expect(screen.windows!.every((o) => o.y0 >= 25 && o.y1 <= 33)).toBe(true);
    expect(screen.sun).toBe(true);
    expect(nave.pilasters).toEqual(screen.pilasters);
  });
});
