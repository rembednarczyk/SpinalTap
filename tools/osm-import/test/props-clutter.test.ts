import { describe, expect, it } from "vitest";
import { CLUTTER, CLUTTER_SHAPES } from "../../../packages/core/src/world/clutter.ts";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { LUBLIN_PROP_TABLE } from "../../../packages/sim/src/content/lublin/props.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { backMix } from "../src/props-clutter.ts";
import { Site } from "../src/props-site.ts";

/*
 * The odds and ends of ADR-0096 stage 2, read from the generated table: the refuse behind the
 * restaurants stands on open ground behind a building, not on a street's pavement; the cash machines
 * are set into the banks' walls; the mix behind a venue follows its name's hash alone.
 */

const CHUNKS = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];
const site = new Site(CHUNKS);
const N = CLUTTER_SHAPES.length;

const pieces = Object.values(LUBLIN_PROP_TABLE).flatMap((kinds) => {
  const a = kinds.clutter ?? [];
  const out: { x: number; z: number; yaw: number; shape: number }[] = [];
  for (let i = 0; i + 4 < a.length; i += 5) out.push({ x: a[i]!, z: a[i + 2]!, yaw: a[i + 3]!, shape: a[i + 4]! % N });
  return out;
});
const atms = pieces.filter((p) => p.shape === CLUTTER.atmWall);
const refuse = pieces.filter((p) => p.shape !== CLUTTER.atmWall);

/** Banks of the map, by their buildings' outlines in the world. */
const banks = CHUNKS.flatMap((c) => c.buildings).filter((b) => (b.venues ?? []).some((v) => v.kind === "bank"));
const ring = (b: (typeof banks)[number]) => Array.from({ length: b.outline.length / 2 }, (_, i) => ({ x: b.x + b.outline[i * 2]!, z: b.z + b.outline[i * 2 + 1]! }));
const distTo = (p: { x: number; z: number }, r: { x: number; z: number }[]): number =>
  Math.min(...r.map((a, i) => {
    const b = r[(i + 1) % r.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
  }));

describe("the odds and ends by their venues (ADR-0096 stage 2)", () => {
  it("puts refuse behind dozens of restaurants and a cash machine into most banks", () => {
    expect(refuse.length).toBeGreaterThan(150);
    expect(atms.length).toBeGreaterThanOrEqual(Math.ceil(banks.length / 2));
    expect(atms.length).toBeLessThanOrEqual(banks.length);
  });

  it("stands the refuse on open ground, off the buildings and the paths, against a wall", () => {
    for (const p of refuse) {
      expect(site.surfaceAt(p), `${p.x},${p.z}`).not.toBe("building");
      expect(site.onPath(p), `${p.x},${p.z}`).toBe(false);
      // A wall within a metre and a half (the pieces are turned a little, dropped, not set square).
      const near = Array.from({ length: 16 }, (_, k) => (k * Math.PI) / 8).some((a) => [0.5, 1, 1.5].some((d) => site.surfaceAt({ x: p.x + Math.sin(a) * d, z: p.z + Math.cos(a) * d }) === "building"));
      expect(near, `${p.x},${p.z}`).toBe(true);
    }
  });

  it("sets each cash machine into a bank's wall, its screen out", () => {
    for (const a of atms) {
      expect(Math.min(...banks.map((b) => distTo(a, ring(b)))), `${a.x},${a.z}`).toBeLessThan(0.3);
      expect(site.surfaceAt({ x: a.x - Math.sin(a.yaw) * 0.4, z: a.z - Math.cos(a.yaw) * 0.4 })).toBe("building");
      expect(site.surfaceAt({ x: a.x + Math.sin(a.yaw) * 0.6, z: a.z + Math.cos(a.yaw) * 0.6 })).not.toBe("building");
    }
  });

  it("mixes two to four pieces per venue from its name alone", () => {
    for (const name of ["Bar Turystyczny", "Pizzeria Cyborg", "Kawiarnia"]) {
      const mix = backMix(name);
      expect(mix).toEqual(backMix(name));
      expect(mix.length).toBeGreaterThanOrEqual(2);
      expect(mix.length).toBeLessThanOrEqual(4);
      expect(mix).not.toContain(CLUTTER.atmWall);
    }
  });
});
