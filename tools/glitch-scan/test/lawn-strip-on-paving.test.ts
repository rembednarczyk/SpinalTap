import { describe, expect, it } from "vitest";
import { COVER } from "../../orto/src/classify.ts";
import { type Cover } from "../../orto/src/cover.ts";
import { THRESHOLDS } from "../../orto/src/thresholds.ts";
import { lawnStripOnPaving } from "./lawn-strip-on-paving";

/** A 20 m square's cover from (0, 0), all of it `cls`. */
const cover = (cls: number): Cover => ({
  header: { district: "t", x0: 0, z1: 20, step: 0.5, width: 40, height: 40, classes: [], source: "", tiles: [], thresholds: THRESHOLDS },
  cls: new Uint8Array(40 * 40).fill(cls),
});
const square = (x0: number, z0: number, x1: number, z1: number) => [x0, z0, x1, z0, x1, z1, x0, z1];
const ring = (o: readonly number[]) => Array.from({ length: o.length >> 1 }, (_, k) => ({ x: o[2 * k]!, z: o[2 * k + 1]! }));

describe("a strip to a lawn laid as grass over paving (lawn-strip-on-paving, G-825)", () => {
  // A carriageway up to z 5, the game's grass from it to z 12, the map's lawn from z 7 on.
  const ground = [
    { surface: "road", outline: square(0, 0, 10, 5) },
    { surface: "grass", outline: square(0, 5, 10, 12) },
  ];
  const lawn = ring(square(0, 7, 10, 12));

  it("names each sample of hard cover under the strip past the kerb's width, and none on the map's lawn", () => {
    const found = lawnStripOnPaving([{ id: "c", ground }], [lawn], [], [cover(COVER.paving)]);
    // Rows z 5.75 and 6.25, x 0.25 .. 9.75: the row at z 5.25 is the kerb, the one at 6.75 the lawn's outline as simplified.
    expect(found.length).toBe(2 * 20);
    expect(found[0]!.what).toBe("c: grass on paving 0.25,5.75, 0.75 m from the kerb");
  });

  it("finds none on green cover, on the bare ground rule's grass or by no road", () => {
    expect(lawnStripOnPaving([{ id: "c", ground }], [lawn], [], [cover(COVER.green)])).toEqual([]);
    expect(lawnStripOnPaving([{ id: "c", ground }], [lawn], [ring(square(0, 5, 10, 7))], [cover(COVER.asphalt)])).toEqual([]);
    expect(lawnStripOnPaving([{ id: "c", ground: [ground[1]!] }], [lawn], [], [cover(COVER.paving)])).toEqual([]);
  });
});
