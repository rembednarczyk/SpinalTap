import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { LUBLIN_PROP_TABLE } from "../../../packages/sim/src/content/lublin/props.generated.ts";
import { STOREY } from "../src/building-tags.ts";
import { partTier } from "../src/building-parts.ts";
import { ADDED_AREAS, TAG_CORRECTIONS, addedAreas, corrected, correctedLine } from "../src/corrections.ts";
import { type Area, type Line, extractFeatures } from "../src/features.ts";
import { type Pt, pointInRing } from "../src/geometry.ts";
import { areaSurface } from "../src/ground.ts";
import { mergeOsm, parseExtract } from "../src/osm.ts";
import { geoToWorld } from "../src/project.ts";

/** The explicit corrections of estimated OSM tags: documented, and applied to the right element only. */

const annex: Area = { id: "w617597406", osmId: 617597406, tags: { "building:levels": "2", "building:part": "yes", "roof:colour": "brown" }, ring: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }], holes: 0 };

describe("tag corrections (ADR-0042)", () => {
  it("names each correction's reason and its entry in the topography register", () => {
    expect(TAG_CORRECTIONS.length).toBeGreaterThan(0);
    for (const c of TAG_CORRECTIONS) {
      expect(c.id).toMatch(/^[wr]\d+$/);
      expect(c.reason.length).toBeGreaterThan(10);
      expect(c.ref).toMatch(/^T-\d{3}$/);
      expect(Object.keys(c.tags).length > 0 || c.scale !== undefined).toBe(true);
    }
    expect(new Set(TAG_CORRECTIONS.map((c) => c.id)).size).toBe(TAG_CORRECTIONS.length);
  });

  it("raises Brama Krakowska's annex from two estimated storeys to the measured 9.3 m over its base (T-033)", () => {
    expect(partTier(annex, "historic")!.eaves).toBeCloseTo(2 * STOREY, 6);
    const tier = partTier(corrected(annex), "historic")!;
    expect(tier.eaves).toBeCloseTo(9.3, 6);
    expect(tier.source).toBe("height");
    // Other elements and the other tags stay as mapped.
    expect(corrected({ ...annex, id: "w617597407" }).tags).toEqual(annex.tags);
    expect(corrected(annex).tags["roof:colour"]).toBe("brown");
  });

  it("corrects a line's tags by its id and leaves other lines and tags as mapped (G-203)", () => {
    const run: Line = { id: "w1305889408", osmId: 1305889408, tags: { highway: "steps", step_count: "40" }, line: [{ x: 784.7, z: 243.4 }, { x: 800.3, z: 242.5 }] };
    expect(correctedLine(run).tags).toEqual({ highway: "steps", step_count: "40", width: "10" });
    expect(correctedLine(run).line).toBe(run.line);
    expect(correctedLine({ ...run, id: "w1305889409" })).toEqual({ ...run, id: "w1305889409" });
    // A change of type for a line (T-050) goes the same way.
    const works = new Map([["w65351909", { id: "w65351909", tags: { highway: "path" }, reason: "ścieżka po remoncie", ref: "T-050" }]]);
    expect(correctedLine({ ...run, id: "w65351909", tags: { highway: "construction" } }, works).tags.highway).toBe("path");
  });

  // NMPT GUGiK 0.5 m (T-114), world y: the chapel's eaves about 7 and its nave's ridge 15.3, the keep's crown 16.4..16.9.
  it("puts the Trinity Chapel's eaves and ridge and the keep's crown in the game's data within 1 m of the surface model (G-204)", () => {
    const building = (id: string) => PODZAMCZE_CHUNKS.flatMap((c) => c.buildings).find((b) => b.id === id)!;
    const chapel = building("w66258167");
    expect(chapel.source).toBe("height");
    expect(Math.abs(chapel.y + chapel.height - 7)).toBeLessThanOrEqual(1);
    expect(Math.abs(chapel.y + chapel.height + (chapel.roof ?? 0) - 15.3)).toBeLessThanOrEqual(1);
    const keep = building("w450180469");
    expect(Math.abs(keep.y + keep.height + (keep.roof ?? 0) - 16.65)).toBeLessThanOrEqual(1);
  });

  // NMPT GUGiK 0.5 m (T-129), world y: St Josaphat's tower to 9.5, the highest cell in its outline,
  // some 4 m under the church's ridge (y 13.3). St Nicholas's belfry waits for a source (G-224):
  // the surface model over it is tree crowns.
  it("puts the top of St Josaphat's tower in the game's data within 1 m of the surface model (G-224)", () => {
    const tower = KRAKOWSKIE_CHUNKS.flatMap((c) => c.buildings).find((o) => o.id === "w1382552285")!;
    expect(tower.source).toBe("height");
    expect(Math.abs(tower.y + tower.height + (tower.roof ?? 0) - 9.5)).toBeLessThanOrEqual(1);
  });

  // NMPT GUGiK 0.5 m (T-129): the apex at y 9.4 over the middle, the eaves at y 8.0..8.2 along the
  // walls, a light tin pyramid on the photograph; the import's 3 m roof for a roofless tower stood
  // its eaves 1.5 m too low.
  it("gives St Josaphat's tower the surface model's low pyramid roof (G-246)", () => {
    const tower = KRAKOWSKIE_CHUNKS.flatMap((c) => c.buildings).find((o) => o.id === "w1382552285")!;
    expect(tower.roofShape).toBe("pyramidal");
    expect(Math.abs(tower.y + tower.height - 8)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(tower.y + tower.height + (tower.roof ?? 0) - 9.5)).toBeLessThanOrEqual(0.5);
  });

  // NMPT GUGiK 0.5 m (T-122), world y: eaves and ridge of each church's main body where the surface is a roof, not trees.
  const CHURCHES: readonly (readonly [string, number, number])[] = [
    ["w69916021", 6.8, 11.4], // cerkiew św. Jozafata
    ["w66330578", 12.5, 24.5], // Bernardyni
    ["w66264082", 11.5, 22], // Brygidki
    ["w66264126", 16.5, 20.4], // Świętego Ducha
    ["w232674421", 1.2, 1.8], // Niecała 4
    ["r5420467", 5, 14.5], // Karmelici
    ["w66335226", 12.5, 19.7], // św. Piotra
    ["w66258180", 8.5, 12.5], // św. Mikołaja
    ["w66264148", -7, -4.3], // cerkiew Przemienienia
  ];
  it("puts the eaves and ridges of the churches without a height in OSM within 1 m of the surface model (G-216)", () => {
    const all = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS].flatMap((c) => c.buildings);
    for (const [id, eaves, ridge] of CHURCHES) {
      const b = all.find((o) => o.id === id)!;
      expect(b.source, id).toBe("height");
      expect(Math.abs(b.y + b.height - eaves), `${id} eaves`).toBeLessThanOrEqual(1);
      expect(Math.abs(b.y + b.height + (b.roof ?? 0) - ridge), `${id} ridge`).toBeLessThanOrEqual(1);
    }
  });

  // The flights and landings of the castle stairs, from Plac Zamkowy up to the gate's bridge (T-113),
  // as mapped: [x, z] of each way's ends. Their walls w231832094 and w231832095 stand 9.6..10.1 m apart.
  const FLIGHTS: readonly (readonly [number, number, number, number])[] = [
    [767.0, 244.8, 768.3, 244.7], // w1435832499
    [776.8, 244.0, 781.4, 243.6], // w1305940836
    [784.7, 243.4, 800.3, 242.5], // w1305889408
    [802.7, 242.4, 806.6, 242.1], // w1305940837
    [824.9, 240.1, 829.2, 239.5], // w1306105687
  ];
  const ground = PODZAMCZE_CHUNKS.flatMap((c) => c.ground);
  const inside = (x: number, z: number, o: readonly number[]) => {
    let hit = false;
    for (let i = 0, j = o.length - 2; i < o.length; j = i, i += 2) {
      if (o[i + 1]! > z !== o[j + 1]! > z && x < ((o[j]! - o[i]!) * (z - o[i + 1]!)) / (o[j + 1]! - o[i + 1]!) + o[i]!) hit = !hit;
    }
    return hit;
  };
  /** The surface drawn on top at (x, z): the last piece in draw order, or null for bare terrain. */
  const surfaceAt = (x: number, z: number) => ground.reduce<string | null>((s, g) => (inside(x, z, g.outline) ? g.surface : s), null);

  it("lays each flight of the castle stairs at least 9.5 m wide, as its walls stand (G-203)", () => {
    for (const [x0, z0, x1, z1] of FLIGHTS) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const [nx, nz] = [-(z1 - z0) / len, (x1 - x0) / len];
      const [mx, mz] = [(x0 + x1) / 2, (z0 + z1) / 2];
      const on = (v: number) => surfaceAt(mx + nx * v, mz + nz * v) === "steps";
      let [left, right] = [0, 0];
      while (left < 15 && on(left + 0.1)) left += 0.1;
      while (right < 15 && on(-right - 0.1)) right += 0.1;
      expect(left + right, `flight at ${mx.toFixed(0)},${mz.toFixed(0)}`).toBeGreaterThanOrEqual(9.5);
    }
  });

  it("joins the castle stairs' landings to their flights with no bare ground between them (G-203)", () => {
    const bare: string[] = [];
    for (let k = 0; k + 1 < FLIGHTS.length; k++) {
      const [x0, z0] = [FLIGHTS[k]![2], FLIGHTS[k]![3]];
      const [x1, z1] = [FLIGHTS[k + 1]![0], FLIGHTS[k + 1]![1]];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const [nx, nz] = [-(z1 - z0) / len, (x1 - x0) / len];
      // From 0.2 m off the joints: on the joint line itself a point lies on both bands' edges.
      for (let s = 0.2; s <= len - 0.2; s += 0.5) {
        for (let v = -4.5; v <= 4.5; v += 0.5) {
          const [x, z] = [x0 + ((x1 - x0) * s) / len + nx * v, z0 + ((z1 - z0) * s) / len + nz * v];
          const surface = surfaceAt(x, z);
          if (surface === null || surface === "grass") bare.push(`${x.toFixed(1)},${z.toFixed(1)}`);
        }
      }
    }
    expect(bare.join(" ")).toEqual("");
  });

  it("names each added area's reason and register entry, apart from the map's ids", () => {
    expect(ADDED_AREAS.length).toBeGreaterThan(0);
    for (const a of ADDED_AREAS) {
      expect(a.ref).toMatch(/^T-\d{3}$/);
      expect(a.id.startsWith(`${a.ref}/`)).toBe(true);
      expect(a.reason.length).toBeGreaterThan(10);
      expect(a.ring.length).toBeGreaterThanOrEqual(3);
      expect(a.nodesOf).toHaveLength(a.ring.length);
    }
    expect(new Set(ADDED_AREAS.map((a) => a.id)).size).toBe(ADDED_AREAS.length);
    expect(addedAreas().map((a) => a.id)).toEqual(ADDED_AREAS.map((a) => a.id));
  });

  // The square before the Dworzec Autobusowy (T-162): bare terrain in front of the metro's `targ` B
  // between the path w1435832520, the footway w227698423, the car park w175995587 and Nova.
  it("paves the square before the Dworzec Autobusowy under the paths and the car park, and none of them over (G-332)", () => {
    const square = ADDED_AREAS.find((a) => a.ref === "T-162")!.ring;
    const buildings = PODZAMCZE_CHUNKS.flatMap((c) => c.buildings).map((b) => b.outline.map((v, i) => v + (i % 2 === 0 ? b.x : b.z)));
    const bare: string[] = [];
    for (let x = 718.25; x < 764; x += 0.5)
      for (let z = 368.75; z < 381; z += 0.5) {
        if (!pointInRing({ x, z }, square) || buildings.some((o) => inside(x, z, o))) continue;
        if (surfaceAt(x, z) === null) bare.push(`${x},${z}`);
      }
    expect(bare.join(" ")).toEqual("");
    // Drawn under its neighbours: the path's, the footway's and the car park's ground stays on top.
    expect(surfaceAt(750, 369.5)).toBe("footway");
    expect(surfaceAt(762.5, 372)).toBe("footway");
    expect(surfaceAt(755, 380)).toBe("road");
    expect(surfaceAt(754, 373.9)).toBe("square");
  });

  // The strips by the Dworzec Autobusowy (T-164): (a) between the car park w175995587 and the footway
  // w227698423, (b) between that footway and the station's west wall, (c) between Nova's east wall and
  // the car park. Grass (a bed) may stay; bare terrain may not.
  const STRIPS: readonly (readonly [string, number, number, number, number])[] = [
    ["a", 760, 770, 376, 406],
    ["b", 766, 782, 376, 412],
    ["c", 745, 750, 378, 420],
  ];
  it("paves the strips by the Dworzec Autobusowy and Nova, and leaves the car park and the footways on top (G-336)", () => {
    const buildings = PODZAMCZE_CHUNKS.flatMap((c) => c.buildings).map((b) => b.outline.map((v, i) => v + (i % 2 === 0 ? b.x : b.z)));
    const bare: string[] = [];
    for (const [name, x0, x1, z0, z1] of STRIPS)
      for (let x = x0; x <= x1; x += 0.5)
        for (let z = z0; z <= z1; z += 0.5) {
          if (buildings.some((o) => inside(x, z, o))) continue;
          if (surfaceAt(x, z) === null) bare.push(`${name} ${x},${z}`);
        }
    expect(bare.join(" ")).toEqual("");
    expect(surfaceAt(770.5, 390)).toBe("footway");
    expect(surfaceAt(765, 390)).toBe("road");
    expect(surfaceAt(752, 400)).toBe("road");
    expect(surfaceAt(774, 390)).toBe("square");
    expect(surfaceAt(748, 400)).toBe("footway");
  });

  // Nova's back yard (T-169): between its north wall, the car park w175995587 and Nowy Plac Targowy
  // w40050943, from the footway w227698428 by its west wall. West of x 726.5 the strip between the
  // car park w227698441 and the street is another gap.
  it("paves Nova's back yard up to the street, and leaves the car park, the footway and the street on top (G-342)", () => {
    const buildings = PODZAMCZE_CHUNKS.flatMap((c) => c.buildings).map((b) => b.outline.map((v, i) => v + (i % 2 === 0 ? b.x : b.z)));
    const bare: string[] = [];
    for (let x = 726.5; x <= 756; x += 0.5)
      for (let z = 428; z <= 441; z += 0.5) {
        if (buildings.some((o) => inside(x, z, o))) continue;
        if (surfaceAt(x, z) === null) bare.push(`${x},${z}`);
      }
    expect(bare.join(" ")).toEqual("");
    expect(surfaceAt(740, 434)).toBe("square");
    expect(surfaceAt(735, 443.5)).toBe("road");
    expect(surfaceAt(760, 438)).toBe("road");
    expect(surfaceAt(755.5, 431)).toBe("road");
    expect(surfaceAt(726.5, 432)).toBe("footway");
  });

  // The strips around the Dworzec Autobusowy (T-168): north, between its north wall and the footway
  // w227698418; east, between its east wall and the stands' asphalt w66323033.
  const AROUND: readonly (readonly [string, number, number, number, number])[] = [
    ["north", 785, 797, 422, 430],
    ["east", 793, 808, 376, 428],
  ];
  it("paves the strips north and east of the Dworzec Autobusowy, and leaves the stands' asphalt and the footways on top (G-341)", () => {
    const buildings = PODZAMCZE_CHUNKS.flatMap((c) => c.buildings).map((b) => b.outline.map((v, i) => v + (i % 2 === 0 ? b.x : b.z)));
    const bare: string[] = [];
    for (const [name, x0, x1, z0, z1] of AROUND)
      for (let x = x0; x <= x1; x += 0.5)
        for (let z = z0; z <= z1; z += 0.5) {
          if (buildings.some((o) => inside(x, z, o))) continue;
          if (surfaceAt(x, z) === null) bare.push(`${name} ${x},${z}`);
        }
    expect(bare.join(" ")).toEqual("");
    expect(surfaceAt(805, 400)).toBe("road");
    expect(surfaceAt(801.5, 415)).toBe("footway");
    expect(surfaceAt(797, 410)).toBe("square");
    expect(surfaceAt(797, 435)).toBe("square");
    // The north footway w227698418 and the kiosk's east footway w227698421 stay on top of the pavement.
    expect(surfaceAt(794, 427.7)).toBe("footway");
    expect(surfaceAt(804.6, 430)).toBe("footway");
  });

  // The north pavement of al. Tysiąclecia (T-165): from the carriageway's axis to z 383, x 640-806,
  // short of the beds the orthophoto shows (shrubs before the Bazar's halls 1-3.75 m south of
  // w67502759, broken at x 684-687 by the footway w227698415 into the halls; before the Dworzec
  // between the cycleway w1435832523 and the path w227698420, x 773-803). A bed may stay bare; the
  // pavement may not. The strip under the halls' eaves, from the bed to the Bazar's edge, is paved too.
  // The beds are taken 0.1 m wider for their edges' seams.
  const T165: readonly Pt[] = [
    { x: 640, z: 370.6 },
    { x: 741, z: 356.4 },
    { x: 761.8, z: 353.5 },
    { x: 804.6, z: 347.6 },
    { x: 804.6, z: 370.4 },
    { x: 806, z: 370.2 },
    { x: 806, z: 383 },
    { x: 640, z: 383 },
  ];
  const BEDS: readonly (readonly Pt[])[] = [
    [{ x: 659.02, z: 382.62 }, { x: 684.1, z: 378.69 }, { x: 684.53, z: 381.6 }, { x: 659.45, z: 385.53 }],
    [{ x: 686.9, z: 378.21 }, { x: 715.18, z: 373.77 }, { x: 715.61, z: 376.68 }, { x: 687.33, z: 381.12 }],
    [{ x: 773, z: 374.55 }, { x: 773.7, z: 368.9 }, { x: 803.6, z: 364.8 }, { x: 803.6, z: 370.5 }],
  ];
  it("paves the north pavement of al. Tysiąclecia from the carriageway to the paths and the beds, and leaves the beds and the paths on top (G-337)", () => {
    const buildings = PODZAMCZE_CHUNKS.flatMap((c) => c.buildings).map((b) => b.outline.map((v, i) => v + (i % 2 === 0 ? b.x : b.z)));
    const bare: string[] = [];
    for (let x = 640; x <= 806; x += 0.5)
      for (let z = 347.5; z <= 383; z += 0.5) {
        if (!pointInRing({ x, z }, T165) || BEDS.some((b) => pointInRing({ x, z }, b)) || buildings.some((o) => inside(x, z, o))) continue;
        if (surfaceAt(x, z) === null) bare.push(`${x},${z}`);
      }
    // Under the eaves, 0.25 m in from the bed and the Bazar's edge for their seams.
    for (let x = 660; x <= 715; x += 0.5) {
      const bed = 385.43 - (x - 659.55) * 0.15815;
      for (let z = bed + 0.25; z <= bed + 3.04 - 0.25; z += 0.25) if (surfaceAt(x, z) === null) bare.push(`eaves ${x},${z.toFixed(2)}`);
    }
    expect(bare.join(" ")).toEqual("");
    expect(surfaceAt(690, 382.2)).toBe("square");
    // The bed stays bare; the break for the footway into the halls is paved.
    expect(surfaceAt(670, 382.3)).toBeNull();
    expect(surfaceAt(705, 377.5)).toBeNull();
    expect(surfaceAt(686.7, 380)).toBe("square");
  });

  // The Dworzec Autobusowy east of T-168's line x 810.6 (T-170): (a) the platform under the roof
  // w458862470, from the footway w227698409 to the stands' asphalt w66323033; (b) the pavilions'
  // block between the path w227698420 and that footway, to x 870; (c) north of the kiosk w73833929
  // to Nowy Plac Targowy and the stands' entry (asphalt). The bed south of the path stays bare.
  const pathAxis = (x: number) => (x <= 834.75 ? 370.14 - ((x - 806.22) * 3.88) / 28.53 : 366.26 - ((x - 834.75) * 10.14) / 74.4);
  it("paves the Dworzec Autobusowy's platform, the pavilions' block and north of the kiosk, and leaves the asphalt, the footways and the bed on top (G-345)", () => {
    const buildings = PODZAMCZE_CHUNKS.flatMap((c) => c.buildings).map((b) => b.outline.map((v, i) => v + (i % 2 === 0 ? b.x : b.z)));
    const bare: string[] = [];
    const look = (name: string, x: number, z: number) => {
      if (!buildings.some((o) => inside(x, z, o)) && surfaceAt(x, z) === null) bare.push(`${name} ${x},${z}`);
    };
    for (let x = 806.5; x <= 869.5; x += 0.5) for (let z = Math.ceil(pathAxis(x) * 2) / 2 + 0.5; z <= 396; z += 0.5) look("ab", x, z);
    // North of the kiosk up to the streets: the corner across Nowy Plac Targowy (x < 784) is not this block's.
    for (let x = 784; x <= 822; x += 0.5) for (let z = 433; z <= 445; z += 0.5) look("c", x, z);
    expect(bare.join(" ")).toEqual("");
    expect(surfaceAt(840, 384)).toBe("square");
    expect(surfaceAt(850, 372)).toBe("square");
    expect(surfaceAt(800, 443)).toBe("square");
    expect(surfaceAt(850, 395)).toBe("road");
    expect(surfaceAt(816, 437)).toBe("road");
    expect(surfaceAt(845, 361.3)).toBeNull();
    // The footways stay on top of the paving.
    expect(surfaceAt(850, 377.5)).toBe("footway");
    expect(surfaceAt(816, 438.8)).toBe("footway");
  });

  // By the car park w227698441 at the Bazar (T-172): (a) asphalt between the car park and Nowy Plac
  // Targowy, (b) the footway w227698428's setts between the car park and the Bazar, (c) the gap by
  // the building w73833938. The register's test: on a 0.1 m grid at most 0.5 m² (seams).
  it("paves round the car park by the Bazar up to the street and the halls, and leaves the car park, the footway and the street on top (G-347)", () => {
    const box = (o: readonly number[]) => o.some((v, i) => (i % 2 === 0 ? v > 671 && v < 728 : v > 433 && v < 450));
    const pieces = ground.filter((g) => box(g.outline)).map((g) => g.outline);
    const walls = PODZAMCZE_CHUNKS.flatMap((c) => c.buildings).map((b) => b.outline.map((v, i) => v + (i % 2 === 0 ? b.x : b.z))).filter(box);
    let bare = 0;
    for (let x = 672.05; x < 727; x += 0.1)
      for (let z = 434.05; z < 449; z += 0.1) if (![...walls, ...pieces].some((o) => inside(x, z, o))) bare++;
    expect(bare * 0.01).toBeLessThanOrEqual(0.5);
    expect(surfaceAt(700, 445)).toBe("road");
    expect(surfaceAt(700, 448.2)).toBe("road");
    expect(surfaceAt(700, 439.6)).toBe("footway");
    expect(surfaceAt(700, 436)).toBe("square");
    expect(surfaceAt(725.6, 428)).toBe("footway");
  });

  // The road lamps of Nowy Plac Targowy by the car park w227698441 (T-172, curator's review of
  // PR #318): on the orthophoto the poles stand on the line of the cars' fronts, 1.6-2 m north of the
  // car park's edge, on the asphalt strip by the street, not past the car park by the halls.
  it("keeps the street's lamps by the car park at the Bazar on the line of the cars' fronts (G-347)", () => {
    const edge = (x: number) => 450.44 - ((x - 672.09) * 9.64) / 54.03;
    const lamps: string[] = [];
    for (const rows of Object.values(LUBLIN_PROP_TABLE)) {
      const row = rows["lamp-road"] ?? [];
      for (let k = 0; k < row.length; k += 5) {
        const [x, z] = [row[k]!, row[k + 2]!];
        if (x > 690 && x < 726 && z > 436 && z < 455) lamps.push(`${x},${z} ${(z - edge(x)).toFixed(2)}`);
      }
    }
    expect(lamps.length).toBeGreaterThan(0);
    for (const l of lamps) {
      const off = Number(l.split(" ")[1]);
      expect(off >= 1 && off <= 2.5, l).toBe(true);
    }
  });

  // The lawn before the pavilions by the Dworzec (T-170, the curator's review of PR #318): green on the
  // orthophoto between the pavilions' south walls and the path w227698420, x 840-870, not setts.
  it("leaves the lawn before the Dworzec's pavilions green, not paved (G-345)", () => {
    const buildings = PODZAMCZE_CHUNKS.flatMap((c) => c.buildings).map((b) => b.outline.map((v, i) => v + (i % 2 === 0 ? b.x : b.z)));
    // Before each pavilion's south wall (x from, x to, the wall's lowest z), 0.6 m short of it.
    const fronts: readonly (readonly [number, number, number])[] = [
      [841.25, 845.5, 368.87],
      [847.25, 855.25, 366.48],
      [858.25, 861.75, 364.65],
    ];
    const paved: string[] = [];
    for (const [x0, x1, wall] of fronts)
      for (let x = x0; x <= x1; x += 0.5)
        for (let z = pathAxis(x) + 1.5; z < wall - 0.6; z += 0.25) {
          if (buildings.some((o) => inside(x, z, o))) continue;
          if (surfaceAt(x, z) !== "grass") paved.push(`${x},${z.toFixed(2)} ${surfaceAt(x, z)}`);
        }
    expect(paved.join(" ")).toEqual("");
    // Before the walls, between the pavilions and in front of the kiosk the setts go on.
    expect(surfaceAt(846.6, 368)).toBe("square");
    expect(surfaceAt(837, 368)).toBe("square");
  });

  // The north pavement of al. Tysiąclecia east of x 806 (T-173): from the carriageway to the footway
  // w1435832518 and the path w1435832524, x 806-870, where the lawn w804709934 begins. The register's test: 0.5 m samples, at most
  // 0.5 m² bare (seams). North of the footway lies the bed of T-170, not this pavement.
  const walkAxis = (x: number) => (x <= 838.98 ? 360.04 - ((x - 804.67) * 4.78) / 34.31 : x <= 850.34 ? 355.26 + ((x - 838.98) * 0.64) / 11.36 : 355.9 - ((x - 850.34) * 2.79) / 16.68);
  it("paves the north pavement of al. Tysiąclecia east of the Dworzec from the carriageway to the footway, and leaves the road and the sidewalk on top (G-350)", () => {
    const bare: string[] = [];
    for (let x = 806.25; x < 870; x += 0.5) for (let z = 343.25; z < walkAxis(x); z += 0.5) if (surfaceAt(x, z) === null) bare.push(`${x},${z}`);
    expect(bare.length * 0.25, bare.slice(0, 20).join(" ")).toBeLessThanOrEqual(0.5);
    expect(surfaceAt(830, 350)).toBe("square");
    expect(surfaceAt(860, 352)).toBe("square");
    expect(surfaceAt(830, 343)).toBe("road");
    expect(surfaceAt(830, 356.6)).toBe("sidewalk");
    expect(surfaceAt(880, 346)).toBe("grass");
  });

  // Along the Bazar's east edge (T-175): red setts from the halls' wall to Nova, where the game had
  // the footway w227698428's band and bare terrain beside it. The register's test: no bare sample.
  it("paves along the Bazar's east edge from the halls to the footway, and leaves the footway and the paths into the halls on top (G-352)", () => {
    const buildings = PODZAMCZE_CHUNKS.flatMap((c) => c.buildings).map((b) => b.outline.map((v, i) => v + (i % 2 === 0 ? b.x : b.z)));
    const bare: string[] = [];
    for (let x = 716.25; x < 721; x += 0.5)
      for (let z = 389.25; z < 413; z += 0.5) if (!buildings.some((o) => inside(x, z, o)) && surfaceAt(x, z) === null) bare.push(`${x},${z}`);
    expect(bare.join(" ")).toEqual("");
    expect(surfaceAt(720.3, 400)).toBe("square");
    expect(surfaceAt(722.3, 400)).toBe("footway");
    expect(surfaceAt(722.3, 416)).toBe("square");
    expect(surfaceAt(720.5, 412.9)).toBe("footway");
  });

  const OSM_DIR = join(__dirname, "../../../data/osm");
  const osm = mergeOsm(readdirSync(OSM_DIR).filter((f) => f.endsWith(".json")).map((f) => parseExtract(readFileSync(join(OSM_DIR, f), "utf8"))));
  const PAVED = new Set(["square", "cobble", "footway", "road"]);

  // As a tag correction stays until OSM agrees, an added area goes once OSM maps a paving there.
  it("adds no area where OSM maps a paving of its own: the added area is to go once it does", () => {
    const mapped = extractFeatures(osm).areas.filter((a) => PAVED.has(areaSurface(a.tags) ?? ""));
    for (const a of ADDED_AREAS) {
      const xs = a.ring.map((p) => p.x);
      const zs = a.ring.map((p) => p.z);
      const covered: string[] = [];
      for (let x = Math.min(...xs) + 0.5; x < Math.max(...xs); x += 1)
        for (let z = Math.min(...zs) + 0.5; z < Math.max(...zs); z += 1) {
          if (!pointInRing({ x, z }, a.ring)) continue;
          const by = mapped.find((m) => pointInRing({ x, z }, m.ring));
          if (by) covered.push(`${x},${z} ${by.id}`);
        }
      expect(covered.join(" "), a.id).toEqual("");
    }
  });

  it("keeps an added area's corners within 0.2 m of the map's nodes they were taken from", () => {
    const off: string[] = [];
    for (const a of ADDED_AREAS)
      a.nodesOf.forEach((way, k) => {
        if (way === null) return;
        const w = osm.ways.get(Number(way.slice(1)));
        const nodes = (w?.nodes ?? []).flatMap((id) => {
          const n = osm.nodes.get(id);
          return n ? [geoToWorld(n.lat, n.lon)] : [];
        });
        const p = a.ring[k]!;
        const d = Math.min(...nodes.map((n) => Math.hypot(n.x - p.x, n.z - p.z)));
        if (!(d <= 0.2)) off.push(`${a.id} #${k} ${way} ${d.toFixed(2)} m`);
      });
    expect(off.join(", ")).toEqual("");
  });
});
