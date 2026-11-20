import { describe, expect, it } from "vitest";
import { type Piece as AlchemiaPiece, box, piece } from "../../../packages/sim/src/content/alchemia/plan";
import { FRONT_VOLUMES, GALLERY_PLOT, GALLERY_TOP, frontFootprint, mallFootprint, mallHeight } from "./alchemia-checks";

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

describe("alchemia-front-footprint (ADR-0093 O5)", () => {
  it("finds a piece of the front's rooms out of its storeys, not one inside them", () => {
    const v = FRONT_VOLUMES.find((q) => q.key === "l2-0")!;
    const inL2 = piece(box(v.x0 + 1, v.x0 + 2, v.z0 + 1, v.z0 + 2, v.y0, v.y1), "partition", true);
    expect(frontFootprint([inL2])).toEqual([]);
    expect(frontFootprint([{ ...inL2, box: { ...inL2.box, y1: v.y1 + 0.5 } }])).toHaveLength(1);
    expect(frontFootprint([{ ...inL2, box: { ...inL2.box, z0: v.z0 - 0.5 } }])).toHaveLength(1);
  });

  it("finds none in the game's front: its units, arcades, café, bar, grill and tables", () => {
    expect(frontFootprint()).toEqual([]);
  });
});
