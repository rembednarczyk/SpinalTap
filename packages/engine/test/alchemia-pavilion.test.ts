// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALCHEMIA_CENTRE, ALCHEMIA_PAVILION, PAVILION_CENTRE, PAVILION_CORNERS, PAVILION_LADDER, PAVILION_SIGN } from "@seki/sim";
import { GeometrySink, parseCityKit } from "../src/renderer/city-kit-data";
import { MeshSink } from "../src/renderer/mesh-sink";
import { neonText, neonWidth } from "../src/renderer/alchemia/neon-letters";
import { bakePavilionStandIn, pavilionIn } from "../src/renderer/alchemia/pavilion-far";
import { pavilionGeometry } from "../src/renderer/alchemia/pavilion-geometry";
import { type PavilionLook, pavilionFaces } from "../src/renderer/alchemia/pavilion-shape";
import { ALCHEMIA_DRAW } from "../src/renderer/alchemia/alchemia-view";

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const kitData = parseCityKit(file("city-kit.glb"));

type V = { x: number; y: number; z: number };

/** The highest triangle of the positions a vertical ray down at (x, z) hits, or null. */
const hitDown = (positions: readonly number[], indices: readonly number[], x: number, z: number): number | null => {
  let best: number | null = null;
  const p = (i: number): V => ({ x: positions[i * 3]!, y: positions[i * 3 + 1]!, z: positions[i * 3 + 2]! });
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [p(indices[t]!), p(indices[t + 1]!), p(indices[t + 2]!)];
    const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(d) < 1e-9) continue;
    const l1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d;
    const l2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
    const l3 = 1 - l1 - l2;
    if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
    const y = l1 * a.y + l2 * b.y + l3 * c.y;
    if (best === null || y > best) best = y;
  }
  return best;
};

/** Points inside the triangle, every metre, a little off its sides. */
const insideTriangle = (): { x: number; z: number }[] => {
  const out: { x: number; z: number }[] = [];
  for (let x = 420; x < 437; x += 1) {
    for (let z = -9; z < 7; z += 1) {
      const ok = [0, 1, 2].every((i) => {
        const a = PAVILION_CORNERS[i]!;
        const b = PAVILION_CORNERS[(i + 1) % 3]!;
        return ((b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x)) / Math.hypot(b.x - a.x, b.z - a.z) > 0.4;
      });
      if (ok) out.push({ x, z });
    }
  }
  return out;
};

/** Within the pavilion's box: the triangle's and the annex's (the ladder on its west face). */
const onCorner = (x: number, z: number) => x > 420.2 && x < 436.6 && z > -9.1 && z < 6.4;

/**
 * The triangular pavilion on Alchemia's corner (ADR-0074 stage 3) in the engine: drawn in
 * Alchemia's outside mesh within a building's budget, its neon readable from both sides, the
 * ladder's rungs where the climber's hands go, and a stand-in in the furniture's block from afar.
 */
describe("the pavilion on Alchemia's corner in the engine (ADR-0074 stage 3)", () => {
  it("is drawn on its corner within a building's budget (ADR-0074 §7: some 8 thousand triangles)", () => {
    const sink = new GeometrySink();
    pavilionGeometry(sink, kitData);
    const triangles = sink.indices.length / 3;
    expect(triangles).toBeGreaterThan(500);
    expect(triangles).toBeLessThanOrEqual(8000);
    for (let i = 0; i < sink.positions.length; i += 3) {
      expect(onCorner(sink.positions[i]!, sink.positions[i + 2]!), `${sink.positions[i]!.toFixed(2)},${sink.positions[i + 2]!.toFixed(2)}`).toBe(true);
      expect(sink.positions[i + 1]!).toBeGreaterThanOrEqual(ALCHEMIA_PAVILION.base - 1e-6);
      expect(sink.positions[i + 1]!).toBeLessThanOrEqual(PAVILION_SIGN.top + 1e-6);
    }
    // Its roof over the whole triangle.
    for (const p of insideTriangle()) expect(hitDown(sink.positions, sink.indices, p.x, p.z)! + 1e-6, `${p.x},${p.z}`).toBeGreaterThanOrEqual(ALCHEMIA_PAVILION.roof);
  });

  it("reads ALCHEMIA left to right from Bajkowskiego and from T0, the letters on both faces of the board", () => {
    const strokes = neonText("ALCHEMIA", 0.9);
    expect(neonWidth("ALCHEMIA", 0.9)).toBeLessThan(PAVILION_SIGN.x1 - PAVILION_SIGN.x0 - 0.2);
    expect(strokes.length).toBeGreaterThan(20);
    const faces: { look: PavilionLook; n: V; c: V }[] = [];
    pavilionFaces((cs, n, look) => {
      if (look === "neon") faces.push({ look, n, c: { x: (cs[0].x + cs[2].x) / 2, y: (cs[0].y + cs[2].y) / 2, z: (cs[0].z + cs[2].z) / 2 } });
    });
    // The A's left leg is the first stroke: west from the south, east from the north.
    const south = faces.filter((f) => f.n.z < -0.5 && f.c.z < PAVILION_SIGN.z);
    const north = faces.filter((f) => f.n.z > 0.5 && f.c.z > PAVILION_SIGN.z);
    expect(south.length).toBeGreaterThan(20);
    expect(north.length).toBe(south.length);
    expect(south[0]!.c.x).toBeLessThan((PAVILION_SIGN.x0 + PAVILION_SIGN.x1) / 2 - 2);
    expect(north[0]!.c.x).toBeGreaterThan((PAVILION_SIGN.x0 + PAVILION_SIGN.x1) / 2 + 2);
  });

  it("hangs the ladder's rungs on the world's 0.3 m grid, where a climber's hands reach without a ladder in view", () => {
    const ys = new Set<number>();
    pavilionFaces((cs, n, look) => {
      if (look === "metal" && n.y > 0.5 && Math.abs(cs[0].z - cs[2].z) > 0.4) ys.add(Math.round((cs[0].y - 0.02) * 1000) / 1000);
    });
    expect(ys.size).toBeGreaterThan(12);
    for (const y of ys) expect(Math.abs(y / 0.3 - 0.5 - Math.round(y / 0.3 - 0.5)), `${y}`).toBeLessThan(1e-6);
    expect(Math.min(...ys)).toBeGreaterThan(PAVILION_LADDER.bottom);
    expect(Math.max(...ys)).toBeLessThan(PAVILION_LADDER.top);
  });

  it("stands in from afar in the furniture's block, inside the detailed faces, its roof and neon over the triangle", () => {
    const s = new MeshSink();
    bakePavilionStandIn(s);
    for (const p of insideTriangle()) expect(hitDown(s.positions, s.indices, p.x, p.z)!, `${p.x},${p.z}`).toBeGreaterThan(ALCHEMIA_PAVILION.roof - 0.1);
    for (let i = 0; i < s.positions.length; i += 3) {
      expect(onCorner(s.positions[i]!, s.positions[i + 2]!)).toBe(true);
      expect(s.positions[i]!).toBeGreaterThan(PAVILION_CORNERS[0].x - 0.01);
    }
    expect(pavilionIn({ minX: 256, maxX: 512, minZ: -256, maxZ: 0 })).toBe(true);
    expect(pavilionIn({ minX: 256, maxX: 512, minZ: 0, maxZ: 256 })).toBe(false);
    // Brama Krakowska (472.6; -91.2) is beyond Alchemia's detailed mesh: the stand-in is what it sees.
    expect(Math.hypot(472.6 - ALCHEMIA_CENTRE.x, -91.2 - ALCHEMIA_CENTRE.z)).toBeGreaterThan(ALCHEMIA_DRAW + 10);
    expect(Math.hypot(PAVILION_CENTRE.x - ALCHEMIA_CENTRE.x, PAVILION_CENTRE.z - ALCHEMIA_CENTRE.z)).toBeLessThan(ALCHEMIA_DRAW - 60);
  });
});
