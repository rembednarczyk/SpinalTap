import { describe, expect, it } from "vitest";
import {
  type PairXZ,
  type PointXZ,
  mulberry32,
  offsetPolylineRight,
  pointInPairRingEvenOdd,
  pointInRingEvenOdd,
  polylineTangent,
  segmentDistance,
  segmentParam,
  signedArea,
} from "../src";

/**
 * The module replaced copies spread over sim and engine; each copy is kept here verbatim (the
 * reference) and must give bit for bit the same number (`Object.is`) on seeded random data and
 * on the edge cases: a point on an edge or a vertex, a degenerate segment, an open and a closed
 * ring. Integer coordinates on a small grid make the edge cases common in the random runs.
 */

type Rng = () => number;

const coord = (rng: Rng, grid: boolean): number => (grid ? Math.floor(rng() * 7) - 3 : (rng() - 0.5) * 2000);
const pt = (rng: Rng, grid: boolean): PointXZ => ({ x: coord(rng, grid), z: coord(rng, grid) });
const ringOf = (rng: Rng, grid: boolean): PointXZ[] => Array.from({ length: 3 + Math.floor(rng() * 6) }, () => pt(rng, grid));
const closed = <T>(ring: readonly T[]): T[] => [...ring, ring[0] as T];
const pairs = (ring: readonly PointXZ[]): PairXZ[] => ring.map((p) => [p.x, p.z] as const);
const same = (a: number, b: number): boolean => Object.is(a, b);

/** Runs `check` on 4000 cases from two seeds, half of them on the small integer grid. */
const random = (check: (rng: Rng, grid: boolean) => void): void => {
  for (const seed of [7, 0xdeadbeef]) {
    const rng = mulberry32(seed);
    for (let i = 0; i < 2000; i++) check(rng, i % 2 === 0);
  }
};

// The old copies, as they were (only renamed).
const escortSegmentDistance = (p: PointXZ, a: PointXZ, b: PointXZ): number => {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const len2 = abx * abx + abz * abz;
  const t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.z - a.z) * abz) / len2));
  return Math.hypot(a.x + abx * t - p.x, a.z + abz * t - p.z);
};
const abutmentsSegmentDistance = (p: PointXZ, a: PointXZ, b: PointXZ): number => {
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + dx * k - p.x, a.z + dz * k - p.z);
};
const gridSegmentDistance = (x: number, z: number, a: PointXZ, b: PointXZ): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
};
const propsSegmentDistance = (x: number, z: number, a: PointXZ, b: PointXZ): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2));
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
};
const parkedSegmentDistance = (x: number, z: number, a: PairXZ, b: PairXZ): number => {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len2));
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
};
// The foot's parameter as crowd-barriers' `shiftAt` and the deck's `deckHeight` had it (the same text).
const barriersFootParam = (x: number, z: number, a: PointXZ, b: PointXZ): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
};
const oldSignedArea = (ring: readonly PointXZ[]): number => {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as PointXZ;
    const b = ring[(i + 1) % ring.length] as PointXZ;
    s += a.x * b.z - b.x * a.z;
  }
  return s / 2;
};
const polygonPointInRing = (p: PointXZ, ring: readonly PointXZ[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i] as PointXZ;
    const b = ring[j] as PointXZ;
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};
const passagePointInRing = (ring: readonly PointXZ[], x: number, z: number): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i] as PointXZ;
    const b = ring[j] as PointXZ;
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};
const kerbInRing = (x: number, z: number, ring: readonly PairXZ[]): boolean => {
  let on = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i]!;
    const [bx, bz] = ring[j]!;
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) on = !on;
  }
  return on;
};
const trafficDirAt = (pts: readonly PairXZ[], i: number): PairXZ => {
  const a = pts[Math.max(0, i - 1)]!;
  const b = pts[Math.min(pts.length - 1, i + 1)]!;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
};
const trafficOffsetLine = (pts: readonly PairXZ[], off: number): PairXZ[] =>
  pts.map((p, i) => {
    const [tx, tz] = trafficDirAt(pts, i);
    return [Math.round((p[0] + tz * off) * 100) / 100, Math.round((p[1] - tx * off) * 100) / 100] as const;
  });

/** Every old copy of the distance against the module on one case (escort's with its 1e-12 floor). */
const distancesAgree = (p: PointXZ, a: PointXZ, b: PointXZ): void => {
  const d = segmentDistance(p.x, p.z, a.x, a.z, b.x, b.z);
  const old = [
    abutmentsSegmentDistance(p, a, b),
    gridSegmentDistance(p.x, p.z, a, b),
    propsSegmentDistance(p.x, p.z, a, b),
    parkedSegmentDistance(p.x, p.z, [a.x, a.z], [b.x, b.z]),
  ];
  expect(old.every((o) => same(o, d)), `${JSON.stringify([p, a, b])}: ${d} vs ${old.join(", ")}`).toBe(true);
  expect(same(segmentDistance(p.x, p.z, a.x, a.z, b.x, b.z, 1e-12), escortSegmentDistance(p, a, b))).toBe(true);
};

describe("segmentDistance", () => {
  it("matches every old copy on random points and segments", () => {
    random((rng, grid) => distancesAgree(pt(rng, grid), pt(rng, grid), pt(rng, grid)));
  });

  it("matches them at a vertex, on the segment and on a degenerate one", () => {
    const a = { x: 1, z: 2 };
    const b = { x: 4, z: 6 };
    for (const p of [a, b, { x: 2.5, z: 4 }, { x: -3, z: -1 }, { x: 9, z: 1 }]) {
      distancesAgree(p, a, b);
      distancesAgree(p, a, a);
    }
    expect(segmentDistance(2.5, 4, 1, 2, 4, 6)).toBe(0);
    expect(segmentDistance(4, 6, 1, 2, 1, 2)).toBe(5);
  });

  it("keeps escort's floor apart: a segment shorter than 1e-6 m is its start only with `minLen2`", () => {
    const a = { x: 0, z: 0 };
    const b = { x: 5e-7, z: 0 };
    const p = { x: 1, z: 0 };
    distancesAgree(p, a, b);
    expect(segmentDistance(1, 0, 0, 0, 5e-7, 0, 1e-12)).toBe(1);
    expect(segmentDistance(1, 0, 0, 0, 5e-7, 0)).toBe(1 - 5e-7);
  });
});

describe("segmentParam", () => {
  it("matches the old copy on random points and segments, at a vertex and on a degenerate segment", () => {
    const agrees = (p: PointXZ, a: PointXZ, b: PointXZ): void => {
      const t = segmentParam(p.x, p.z, a.x, a.z, b.x, b.z);
      expect(same(t, barriersFootParam(p.x, p.z, a, b)), `${JSON.stringify([p, a, b])}: ${t}`).toBe(true);
    };
    random((rng, grid) => agrees(pt(rng, grid), pt(rng, grid), pt(rng, grid)));
    const a = { x: 1, z: 2 };
    const b = { x: 4, z: 6 };
    for (const p of [a, b, { x: 2.5, z: 4 }, { x: -3, z: -1 }, { x: 9, z: 1 }]) {
      agrees(p, a, b);
      agrees(p, a, a);
    }
  });

  it("clamps the foot to the segment and gives 0 under `minLen2`", () => {
    expect(segmentParam(2.5, 4, 1, 2, 4, 6)).toBe(0.5);
    expect(segmentParam(-3, -1, 1, 2, 4, 6)).toBe(0);
    expect(segmentParam(10, 10, 1, 2, 4, 6)).toBe(1);
    expect(segmentParam(4, 6, 1, 2, 1, 2)).toBe(0);
    expect(segmentParam(1, 0, 0, 0, 5e-7, 0)).toBe(1);
    expect(segmentParam(1, 0, 0, 0, 5e-7, 0, 1e-12)).toBe(0);
  });
});

describe("signedArea", () => {
  it("matches the old copy on random open and closed rings, closing adding nothing", () => {
    random((rng, grid) => {
      const ring = ringOf(rng, grid);
      expect(same(signedArea(ring), oldSignedArea(ring))).toBe(true);
      expect(same(signedArea(closed(ring)), oldSignedArea(closed(ring)))).toBe(true);
    });
  });

  it("is positive counter-clockwise and zero for a degenerate ring", () => {
    const square = [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 2 }, { x: 0, z: 2 }];
    expect(signedArea(square)).toBe(4);
    expect(signedArea([...square].reverse())).toBe(-4);
    expect(signedArea(closed(square))).toBe(4);
    expect(signedArea([{ x: 0, z: 0 }, { x: 1, z: 1 }, { x: 2, z: 2 }])).toBe(0);
    expect(signedArea([])).toBe(0);
  });
});

/** Every old copy of the point-in-ring test against the module on one case. */
const insideAgrees = (x: number, z: number, ring: readonly PointXZ[]): boolean => {
  const inside = pointInRingEvenOdd(x, z, ring);
  const pr = pairs(ring);
  expect([polygonPointInRing({ x, z }, ring), passagePointInRing(ring, x, z), kerbInRing(x, z, pr), pointInPairRingEvenOdd(x, z, pr)]).toEqual([inside, inside, inside, inside]);
  return inside;
};

describe("pointInRingEvenOdd", () => {
  it("matches every old copy on random rings and points, open and closed", () => {
    random((rng, grid) => {
      const ring = ringOf(rng, grid);
      const p = pt(rng, grid);
      expect(insideAgrees(p.x, p.z, closed(ring))).toBe(insideAgrees(p.x, p.z, ring));
    });
  });

  it("counts a left or bottom edge in, a right or top edge out, and a vertex by the same rule", () => {
    const square = [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 2 }, { x: 0, z: 2 }];
    const cases: ReadonlyArray<readonly [number, number, boolean]> = [
      [1, 1, true],
      [0, 1, true],
      [1, 0, true],
      [2, 1, false],
      [1, 2, false],
      [0, 0, true],
      [2, 0, false],
      [2, 2, false],
      [0, 2, false],
      [3, 1, false],
    ];
    for (const [x, z, inside] of cases) {
      expect(insideAgrees(x, z, square), `${x},${z}`).toBe(inside);
      expect(insideAgrees(x, z, closed(square)), `${x},${z} closed`).toBe(inside);
    }
  });

  it("puts the doubly wound part of a self-crossing ring outside (even-odd)", () => {
    const twice = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }, { x: 0, z: 4 }, { x: 0, z: 1 }, { x: 3, z: 1 }, { x: 3, z: 3 }, { x: 1, z: 3 }, { x: 1, z: 0 }];
    expect(insideAgrees(2, 2, twice)).toBe(false);
    expect(insideAgrees(0.5, 2, twice)).toBe(true);
    expect(insideAgrees(5, 5, [])).toBe(false);
  });
});

describe("offsetPolylineRight", () => {
  it("matches traffic's offset line (to the centimetre) and its direction on random polylines", () => {
    const cm = (v: number): number => Math.round(v * 100) / 100;
    random((rng, grid) => {
      const line = pairs(ringOf(rng, grid));
      const off = (rng() - 0.5) * 20;
      const moved = offsetPolylineRight(line, off).map(([x, z]) => [cm(x), cm(z)]);
      expect(moved).toEqual(trafficOffsetLine(line, off).map(([x, z]) => [x, z]));
      line.forEach((_, i) => expect(polylineTangent(line, i)).toEqual(trafficDirAt(line, i)));
    });
  });

  it("moves heading north to the east, leaves an end on a repeated point and a one-point line in place", () => {
    expect(offsetPolylineRight([[0, 0], [0, 10]], 2)).toEqual([[2, 0], [2, 10]]);
    expect(offsetPolylineRight([[0, 0], [0, 0], [0, 10]], -1)).toEqual([[0, 0], [-1, 0], [-1, 10]]);
    expect(offsetPolylineRight([[3, 4]], 5)).toEqual([[3, 4]]);
  });
});
