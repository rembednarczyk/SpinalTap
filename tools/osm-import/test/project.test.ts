import { describe, expect, it } from "vitest";
import { LUBLIN_ANCHOR } from "../../../packages/core/src/world/city-geo.ts";
import { geoToPuwg, geoToWorld, puwgFrame, worldToGeo, worldToPuwg } from "../src/project.ts";

/** Geodesic distance on the GRS80 ellipsoid by Vincenty's inverse formula (reference for the tests). */
const vincenty = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const a = 6378137;
  const f = 1 / 298.257222101;
  const b = a * (1 - f);
  const rad = Math.PI / 180;
  const L = (lon2 - lon1) * rad;
  const U1 = Math.atan((1 - f) * Math.tan(lat1 * rad));
  const U2 = Math.atan((1 - f) * Math.tan(lat2 * rad));
  let lambda = L;
  let sinS = 0;
  let cosS = 0;
  let sigma = 0;
  let cos2a = 0;
  let cos2sm = 0;
  for (let i = 0; i < 100; i++) {
    const sl = Math.sin(lambda);
    const cl = Math.cos(lambda);
    sinS = Math.hypot(Math.cos(U2) * sl, Math.cos(U1) * Math.sin(U2) - Math.sin(U1) * Math.cos(U2) * cl);
    cosS = Math.sin(U1) * Math.sin(U2) + Math.cos(U1) * Math.cos(U2) * cl;
    sigma = Math.atan2(sinS, cosS);
    const sinA = (Math.cos(U1) * Math.cos(U2) * sl) / sinS;
    cos2a = 1 - sinA * sinA;
    cos2sm = cosS - (2 * Math.sin(U1) * Math.sin(U2)) / cos2a;
    const C = (f / 16) * cos2a * (4 + f * (4 - 3 * cos2a));
    const prev = lambda;
    lambda = L + (1 - C) * f * sinA * (sigma + C * sinS * (cos2sm + C * cosS * (-1 + 2 * cos2sm * cos2sm)));
    if (Math.abs(lambda - prev) < 1e-12) break;
  }
  const u2 = (cos2a * (a * a - b * b)) / (b * b);
  const A = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
  const B = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
  const dS = B * sinS * (cos2sm + (B / 4) * (cosS * (-1 + 2 * cos2sm * cos2sm) - (B / 6) * cos2sm * (-3 + 4 * sinS * sinS) * (-3 + 4 * cos2sm * cos2sm)));
  return b * A * (sigma - dS);
};

describe("projection around LUBLIN_ANCHOR", () => {
  it("puts the anchor at the world origin and round-trips", () => {
    const o = geoToWorld(LUBLIN_ANCHOR.lat, LUBLIN_ANCHOR.lon);
    expect(o.x).toBeCloseTo(0, 9);
    expect(o.z).toBeCloseTo(0, 9);
    const p = { x: 1234.5, z: -678.9 };
    const g = worldToGeo(p);
    const back = geoToWorld(g.lat, g.lon);
    expect(back.x).toBeCloseTo(p.x, 6);
    expect(back.z).toBeCloseTo(p.z, 6);
  });

  it("has x east and z north", () => {
    expect(geoToWorld(LUBLIN_ANCHOR.lat, LUBLIN_ANCHOR.lon + 0.01).x).toBeGreaterThan(690);
    expect(geoToWorld(LUBLIN_ANCHOR.lat + 0.01, LUBLIN_ANCHOR.lon).z).toBeGreaterThan(1110);
  });

  it("keeps distances within 0.1 % across 2 km", () => {
    for (const [dLat, dLon] of [
      [0, 0.028],
      [0.018, 0],
      [0.012, 0.02],
      [-0.01, -0.025],
    ] as const) {
      const lat = LUBLIN_ANCHOR.lat + dLat;
      const lon = LUBLIN_ANCHOR.lon + dLon;
      const w = geoToWorld(lat, lon);
      const truth = vincenty(LUBLIN_ANCHOR.lat, LUBLIN_ANCHOR.lon, lat, lon);
      expect(Math.abs(Math.hypot(w.x, w.z) - truth) / truth).toBeLessThan(0.001);
    }
  });
});

describe("PUWG 1992 (EPSG:2180)", () => {
  it("maps Plac Litewski where GUGiK's services expect it", () => {
    const g = geoToPuwg(51.24838, 22.55964);
    expect(g.n).toBeCloseTo(381761.84, 2);
    expect(g.e).toBeCloseTo(748333.49, 2);
  });

  it("maps the central meridian and the equator-free origin consistently", () => {
    const g = geoToPuwg(52, 19);
    expect(g.e).toBeCloseTo(500000, 6);
  });

  it("is a turn by the meridian convergence and a near-unit scale near the anchor", () => {
    const f = puwgFrame();
    expect(f.gammaDeg).toBeGreaterThan(2.7);
    expect(f.gammaDeg).toBeLessThan(2.85);
    expect(f.scale).toBeGreaterThan(1);
    expect(f.scale).toBeLessThan(1.0002);
    // The similarity is good to a metre over the districts (the scale changes with easting).
    const g = (f.gammaDeg * Math.PI) / 180;
    for (const p of [
      { x: 1000, z: 500 },
      { x: -200, z: -250 },
      { x: 2700, z: 480 },
    ]) {
      const exact = worldToPuwg(p);
      const e = f.origin.e + f.scale * (p.x * Math.cos(g) - p.z * Math.sin(g));
      const n = f.origin.n + f.scale * (p.x * Math.sin(g) + p.z * Math.cos(g));
      expect(Math.hypot(exact.e - e, exact.n - n)).toBeLessThan(1);
    }
  });
});
