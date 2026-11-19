import { describe, expect, it } from "vitest";
import { type AlchemiaPiece, box, piece } from "../../../packages/sim/src/content/alchemia/plan";
import { GALLERY_PLOT, GALLERY_TOP, mallFootprint, mallHeight } from "./alchemia-checks";

/** A piece of the gallery a metre square on its plot's floor, moved to (x, z) and up to `top`. */
const at = (x: number, z: number, top = 2): AlchemiaPiece => piece(box(x, x + 1, z, z + 1, 0, top), "partition", true);

describe("alchemia-mall-footprint and alchemia-mall-height (ADR-0093, review of O1)", () => {
  it("finds a piece of the gallery off its plot or over its height, not one on its edges", () => {
    const P = GALLERY_PLOT;
    expect(mallFootprint([at(P.x0, P.z0), at(P.x1 - 1, P.z1 - 1)])).toEqual([]);
    expect(mallFootprint([at(P.x0 - 0.1, 40)])).toHaveLength(1);
    expect(mallFootprint([at(420, P.z1 - 0.9)])).toHaveLength(1);
    expect(mallFootprint([at(420, P.z0 - 0.5)])).toHaveLength(1);
    expect(mallHeight([at(420, 40, GALLERY_TOP)])).toEqual([]);
    expect(mallHeight([at(420, 40, GALLERY_TOP + 0.2)])).toHaveLength(1);
  });

  it("finds none in the game's gallery: its body, cores, lifts, escalators and shops", () => {
    expect(mallFootprint()).toEqual([]);
    expect(mallHeight()).toEqual([]);
  });
});
