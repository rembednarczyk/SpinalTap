import { describe, expect, it } from "vitest";
import type { StepFace } from "./steps-faces";
import { flightOffNorm } from "./steps-norm";

/** A band 2 m wide along x from 0 to `length`. */
const band = (length: number) => [{ x: 0, z: 0 }, { x: length, z: 0 }, { x: length, z: 2 }, { x: 0, z: 2 }];

/** The faces of a flight with risers `h` m high at `at` along x, and a tread between each two. */
const flight = (at: readonly number[], h: readonly number[], length: number): StepFace[] => {
  const out: StepFace[] = [];
  let y = 0.05;
  const tread = (x0: number, x1: number, yy: number) => {
    out.push({ up: true, corners: [{ x: x0, y: yy, z: 0 }, { x: x1, y: yy, z: 0 }, { x: x1, y: yy, z: 2 }] });
    out.push({ up: true, corners: [{ x: x0, y: yy, z: 0 }, { x: x1, y: yy, z: 2 }, { x: x0, y: yy, z: 2 }] });
  };
  const riser = (x: number, y0: number, y1: number) => {
    out.push({ up: false, corners: [{ x, y: y0, z: 0 }, { x, y: y0, z: 2 }, { x, y: y1, z: 2 }] });
    out.push({ up: false, corners: [{ x, y: y0, z: 0 }, { x, y: y1, z: 2 }, { x, y: y1, z: 0 }] });
  };
  // The kerbs at the ends, up from the ground.
  riser(0, 0, 0.05);
  let from = 0;
  at.forEach((x, i) => {
    tread(from, x, y);
    riser(x, y, y + h[i]!);
    y += h[i]!;
    from = x;
  });
  tread(from, length, y);
  riser(length, y - 0.05, y);
  return out;
};

/** `n` risers of `h` from `x0`, `s` apart. */
const run = (n: number, x0: number, s: number): number[] => Array.from({ length: n }, (_, i) => x0 + i * s);

describe("the glitch scan's check steps-riser-norm (G-840)", () => {
  it("passes a flight of the norm: 12 risers of 0.15 m on treads of 0.32 m, a landing, 5 more", () => {
    const at = [...run(12, 0.5, 0.32), ...run(5, 0.5 + 11 * 0.32 + 1.2, 0.32)];
    expect(flightOffNorm(flight(at, at.map(() => 0.15), 8), band(8))).toBeNull();
  });

  it("passes the kerbs at a band's ends, however low", () => {
    expect(flightOffNorm(flight([], [], 3), band(3))).toBeNull();
  });

  it("finds a riser under the norm: a dark line of the smoothed terrain (G-018)", () => {
    const at = run(6, 0.33, 0.33);
    expect(flightOffNorm(flight(at, at.map(() => 0.05), 3), band(3))).toMatch(/^riser 0\.050/);
  });

  it("finds risers of unequal height in one flight", () => {
    const at = run(6, 0.5, 0.32);
    expect(flightOffNorm(flight(at, at.map((_, i) => (i % 2 ? 0.13 : 0.16)), 3), band(3))).toMatch(/^risers 0\.130-0\.160/);
  });

  it("finds a tread stretched past the stride and short of a landing", () => {
    expect(flightOffNorm(flight([0.5, 0.82, 1.5], [0.15, 0.15, 0.15], 3), band(3))).toMatch(/^tread 0\.68/);
  });

  it("finds more than 12 risers with no landing", () => {
    const at = run(13, 0.3, 0.32);
    expect(flightOffNorm(flight(at, at.map(() => 0.15), 5), band(5))).toBe("13 risers with no landing");
  });
});
