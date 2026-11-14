import { describe, expect, it } from "vitest";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";

/** The added paving on Plac Czechowicza (T-210): the strip before the Sąd Okręgowy w69672563 and along its east wall. */

const ground = KRAKOWSKIE_CHUNKS.flatMap((c) => c.ground);
const buildings = KRAKOWSKIE_CHUNKS.flatMap((c) => c.buildings).map((b) => b.outline.map((v, i) => v + (i % 2 === 0 ? b.x : b.z)));
const inside = (x: number, z: number, o: readonly number[]) => {
  let hit = false;
  for (let i = 0, j = o.length - 2; i < o.length; j = i, i += 2) {
    if (o[i + 1]! > z !== o[j + 1]! > z && x < ((o[j]! - o[i]!) * (z - o[i + 1]!)) / (o[j + 1]! - o[i + 1]!) + o[i]!) hit = !hit;
  }
  return hit;
};
/**
 * The surface at (x, z): the piece over it, or null for bare terrain. The ground is a partition of the
 * plane (ADR-0078 step 3): pieces share their edges, one cut along another's to the millimetre, so a
 * sample on such an edge may fall in a hairline between the two; it takes the piece 2 mm off it then.
 */
const surfaceAt = (x: number, z: number): string | null => {
  for (const [dx, dz] of [[0, 0], [0.002, 0], [-0.002, 0], [0, 0.002], [0, -0.002]] as const) {
    const g = ground.find((p) => inside(x + dx, z + dz, p.outline));
    if (g) return g.surface;
  }
  return null;
};
const inBuilding = (x: number, z: number) => buildings.some((o) => inside(x, z, o));

describe("the paving before the Sąd Okręgowy on Plac Czechowicza (G-436)", () => {
  // The square w505211283 ends 1-2 m short of the court's north wall and the footway w288178955's
  // band 2-3 m short of its east wall: bare terrain where the orthophoto (PZGiK) has the pavement
  // up to the walls. The register's test: no bare sample on a 0.25 m grid round the court's corner.
  it("paves from the square and the footway up to the court's north and east walls", () => {
    const bare: string[] = [];
    for (let x = 2.625; x < 22; x += 0.25)
      for (let z = -119.875; z < -104.75; z += 0.25) if (!inBuilding(x, z) && surfaceAt(x, z) === null) bare.push(`${x},${z}`);
    expect(bare.length, bare.slice(0, 20).join(" ")).toBe(0);
    expect(surfaceAt(10, -105.8)).toBe("square");
    expect(surfaceAt(19.5, -110)).toBe("square");
    expect(surfaceAt(18.6, -120)).toBe("square");
  });

  it("leaves the footway, the street and the square's car park on top, and the court's walls where they are", () => {
    expect(surfaceAt(22.5, -108)).toBe("footway");
    expect(surfaceAt(25, -108)).toBe("road");
    expect(surfaceAt(10, -100)).toBe("road");
    expect(inBuilding(10, -107)).toBe(true);
    expect(inBuilding(18, -110)).toBe(true);
  });
});

describe("the pavement along the façades of ul. Kościuszki (G-440)", () => {
  /** Bare samples (0.25 m grid) within 3 m of a footway's axis `a`–`b`, on the side `side` of it (+1 east, `a` north of `b`), between `zFrom` and `zTo`. */
  const bareBeside = (a: readonly [number, number], b: readonly [number, number], side: 1 | -1, zFrom: number, zTo: number) => {
    const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
    const len = Math.hypot(dx, dz);
    const bare: string[] = [];
    for (let x = -0.125; x < 35; x += 0.25)
      for (let z = zFrom + 0.125; z < zTo; z += 0.25) {
        // The distance off the axis, positive on the façades' side.
        const off = (side * ((x - a[0]) * -dz + (z - a[1]) * dx)) / len;
        if (off < 0 || off > 3 || inBuilding(x, z) || surfaceAt(x, z) !== null) continue;
        bare.push(`${x},${z}`);
      }
    return bare;
  };

  // The footways w288178955 (west) and w288178957 (east) are lines, 2.5 m bands, that end 1-1.5 m
  // short of the façades: bare terrain where the orthophoto (PZGiK) has the pavement up to the walls.
  it("paves from the footways up to the façades on both sides of the street", () => {
    const west = bareBeside([23.03, -111.88], [9.24, -184.64], -1, -182, -127.25);
    const east = bareBeside([29.37, -115.84], [17.79, -188.27], 1, -187, -110.5);
    expect(west.length, west.slice(0, 20).join(" ")).toBe(0);
    expect(east.length, east.slice(0, 20).join(" ")).toBe(0);
    expect(surfaceAt(13.4, -150)).toBe("square");
    expect(surfaceAt(25.7, -150)).toBe("square");
  });

  it("leaves the footways, the street and the driveway on top, and the façades where they are", () => {
    expect(surfaceAt(15.8, -150)).toBe("footway");
    expect(surfaceAt(23.9, -150)).toBe("footway");
    expect(surfaceAt(20, -150)).toBe("road");
    expect(surfaceAt(30.5, -110.5)).toBe("road");
    expect(inBuilding(12.5, -150)).toBe(true);
    expect(inBuilding(26.5, -150)).toBe(true);
  });
});

describe("the pavement along the façades of Peowiaków by the corners with Kościuszki and by w67508886 (G-450)", () => {
  /**
   * Bare samples (0.25 m grid) within 3 m of a footway's axis `a`–`b`, on its side `side` (+1 left
   * going from `a` to `b`), abreast of the axis between the fractions `tFrom` and `tTo` of it.
   */
  const bareAlong = (a: readonly [number, number], b: readonly [number, number], side: 1 | -1, tFrom: number, tTo: number) => {
    const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
    const len = Math.hypot(dx, dz);
    const bare: string[] = [];
    for (let x = Math.floor(Math.min(a[0], b[0])) - 3.875; x < Math.max(a[0], b[0]) + 4; x += 0.25)
      for (let z = Math.floor(Math.min(a[1], b[1])) - 3.875; z < Math.max(a[1], b[1]) + 4; z += 0.25) {
        const t = ((x - a[0]) * dx + (z - a[1]) * dz) / (len * len);
        const off = (side * ((z - a[1]) * dx - (x - a[0]) * dz)) / len;
        if (t < tFrom || t > tTo || off < 0 || off > 3 || inBuilding(x, z) || surfaceAt(x, z) !== null) continue;
        bare.push(`${x},${z}`);
      }
    return bare;
  };

  // T-221: the footways w288178955 (west of Kościuszki) and w288178957 (east), lines with 2.5 m
  // bands, end 0.5-1.5 m short of the north frontage of Peowiaków, where the orthophoto (PZGiK) has
  // the setts up to the walls: w69672557 to its west corner (-17.4; -178.5), w67508949, r1207677 and
  // w67508955 to its east corner (61.3; -203.3), and round the corners from the footways' bends.
  it("paves from the footways up to the north frontage of Peowiaków on both sides of Kościuszki", () => {
    const west = [...bareAlong([4.4, -187.32], [-20.6, -179.54], -1, 0, 0.895), ...bareAlong([7.53, -186.47], [4.4, -187.32], -1, 0, 1), ...bareAlong([9.24, -184.64], [7.53, -186.47], -1, 0, 1)];
    const east = [...bareAlong([19.83, -192.15], [73.51, -210.52], 1, 0, 0.755), ...bareAlong([18.22, -190.43], [19.83, -192.15], 1, 0, 1)];
    expect(west.length, west.slice(0, 20).join(" ")).toBe(0);
    expect(east.length, east.slice(0, 20).join(" ")).toBe(0);
    expect(surfaceAt(-5, -182.6)).toBe("square");
    expect(surfaceAt(45, -198.6)).toBe("square");
  });

  // T-224: between the footway w288178957's band and the west wall of w67508886, north of the
  // driveway w536680784, up to the church r5420680.
  it("paves from the footway up to the west wall of w67508886", () => {
    const bare: string[] = [];
    for (let x = 30.375; x < 31.3; x += 0.25)
      for (let z = -108.625; z < -104.75; z += 0.25) if (!inBuilding(x, z) && surfaceAt(x, z) === null) bare.push(`${x},${z}`);
    expect(bare.length, bare.join(" ")).toBe(0);
    expect(surfaceAt(30.9, -106.5)).toBe("square");
  });

  it("leaves the footways, the streets and the driveway on top, and the façades where they are", () => {
    expect(surfaceAt(-5, -184.5)).toBe("footway");
    expect(surfaceAt(45, -200.5)).toBe("footway");
    // The footway w288178957's band over the driveway's asphalt: the asphalt wins at a carriageway's
    // edge (ADR-0078 step 3, the user's decision of 14.11), as the picture drew it on top before (SURFACE_LIFT).
    expect(surfaceAt(29.2, -107)).toBe("road");
    expect(surfaceAt(-5, -188)).toBe("road");
    expect(surfaceAt(45, -203)).toBe("road");
    expect(surfaceAt(30.9, -109.5)).toBe("road");
    expect(inBuilding(-5, -180.5)).toBe(true);
    expect(inBuilding(45, -196)).toBe(true);
    expect(inBuilding(32, -107)).toBe(true);
  });
});
