import { describe, expect, it } from "vitest";
import { bridgeFills, onCarriagewayDecks } from "../src/bridge-fill.ts";
import { type Area, type Line } from "../src/features.ts";
import { lineBands } from "../src/ground.ts";

const line = (id: number, tags: Record<string, string>, ...pts: [number, number][]): Line => ({ id: `w${id}`, osmId: id, tags, line: pts.map(([x, z]) => ({ x, z })) });
const outline = (tags: Record<string, string>, ...pts: [number, number][]): Area => ({ id: "w9", osmId: 9, tags, ring: pts.map(([x, z]) => ({ x, z })), holes: 0 });
/** A carriageway 13 m wide on a bridge along x, its sidewalk 2.5 m wide 10 m off its axis: 2.25 m between them. */
const road = line(1, { highway: "secondary", lanes: "4", bridge: "yes", sidewalk: "separate" }, [0, 0], [40, 0]);
const walk = (z: number, tags: Record<string, string> = {}) => line(2, { highway: "footway", bridge: "yes", ...tags }, [0, z], [40, z]);
const bridge = outline({ man_made: "bridge" }, [0, -15], [40, -15], [40, 10], [0, 10]);
const bands = (...ls: Line[]) => ls.flatMap((l) => lineBands(l, true));

describe("one deck across a bridge (G-340)", () => {
  it("fills the bridge's outline between its sidewalk and its carriageway, on the sidewalk's deck, sharing both edges", () => {
    const fills = bridgeFills([bridge], bands(road, walk(-10)));
    expect(fills).toHaveLength(1);
    const f = fills[0]!;
    expect(f).toMatchObject({ surface: "footway", bridge: true, source: "w9", deck: [{ x: 0, z: -10 }, { x: 40, z: -10 }] });
    const corners = f.ring.map((p) => `${p.x},${p.z}`).sort();
    expect(corners).toEqual(["0,-6.5", "0,-8.75", "40,-6.5", "40,-8.75"]);
  });

  it("fills on either side of the carriageway, whichever way the sidewalk runs", () => {
    const back = line(2, { highway: "footway", bridge: "yes" }, [40, 9], [0, 9]);
    const corners = bridgeFills([bridge], bands(road, back))[0]!.ring.map((p) => `${p.x},${p.z}`).sort();
    expect(corners).toEqual(["0,6.5", "0,7.75", "40,6.5", "40,7.75"]);
  });

  it("fills nothing off a bridge's outline, for a sidewalk at the kerb or overlapping it, too far off or across", () => {
    expect(bridgeFills([outline({ building: "yes" }, [0, -15], [40, -15], [40, 10], [0, 10])], bands(road, walk(-10)))).toEqual([]);
    expect(bridgeFills([bridge], bands(road, walk(-7.75)))).toEqual([]);
    expect(bridgeFills([bridge], bands(road, walk(-7)))).toEqual([]);
    expect(bridgeFills([bridge], bands(road, walk(-13)))).toEqual([]);
    expect(bridgeFills([bridge], bands(road, line(2, { highway: "footway", bridge: "yes" }, [5, -14], [35, -2])))).toEqual([]);
    expect(bridgeFills([bridge], bands(road, line(2, { highway: "footway" }, [0, -10], [40, -10])))).toEqual([]);
  });

  it("fills beside a sidewalk turned up to 15° from the carriageway, not further: two ways crossing the bridge apart", () => {
    // A sidewalk 10 m long round (20, -10), within the gap's limits at either angle: the turn alone decides.
    const turned = (deg: number) => {
      const [c, s] = [5 * Math.cos((deg * Math.PI) / 180), 5 * Math.sin((deg * Math.PI) / 180)];
      return line(2, { highway: "footway", bridge: "yes" }, [20 - c, -10 - s], [20 + c, -10 + s]);
    };
    for (const deg of [0, 14, -14, 180 + 14]) expect(bridgeFills([bridge], bands(road, turned(deg))), `${deg}°`).toHaveLength(1);
    for (const deg of [16, -16, 180 + 16]) expect(bridgeFills([bridge], bands(road, turned(deg))), `${deg}°`).toEqual([]);
  });
});

describe("a bridge's sidewalk on its carriageway's deck (G-737)", () => {
  const axis = (b: { readonly deck?: readonly { x: number; z: number }[] }) => b.deck!.map((p) => `${p.x},${p.z}`).join(" ");
  const walkDecks = (areas: Area[], ...ls: Line[]) => onCarriagewayDecks(areas, bands(...ls)).filter((b) => !b.carriageway).map(axis);

  it("lays a sidewalk beside the carriageway on the carriageway's axis, so the two are level in each cross-section", () => {
    // The sidewalk's ends 1–2 m off the carriageway's along the bridge, as the map's ways end at the abutments.
    const skew = line(2, { highway: "footway", bridge: "yes" }, [-1, -10], [42, -10]);
    expect(walkDecks([bridge], road, skew)).toEqual(["0,0 40,0"]);
    expect(walkDecks([bridge], road, walk(-7.75))).toEqual(["0,0 40,0"]);
    expect(onCarriagewayDecks([bridge], bands(road, skew)).filter((b) => b.carriageway).map(axis)).toEqual(["0,0 40,0"]);
  });

  it("leaves a sidewalk on its own deck off a bridge's outline, alone on it, across the carriageway or too far off", () => {
    expect(walkDecks([outline({ building: "yes" }, [0, -15], [40, -15], [40, 10], [0, 10])], road, walk(-10))).toEqual(["0,-10 40,-10"]);
    expect(walkDecks([bridge], walk(-10))).toEqual(["0,-10 40,-10"]);
    expect(walkDecks([bridge], road, line(2, { highway: "footway", bridge: "yes" }, [5, -14], [35, -2]))).toEqual(["5,-14 35,-2"]);
    expect(walkDecks([bridge], road, walk(-13))).toEqual(["0,-13 40,-13"]);
  });
});
