import { crc32, deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decodeRgb } from "../../orto/src/png.ts";
import { frameStats, pairLine, pairStats, type Frame } from "../src/metrics.ts";
import { parseSpots } from "../src/spots.ts";

/** An RGBA PNG (as the canvas capture writes) of `w` x `h`, `paint(x, y)` giving each pixel's RGB. */
const png = (w: number, h: number, paint: (x: number, y: number) => [number, number, number]): Uint8Array => {
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = y * (1 + w * 4) + 1 + x * 4;
      raw.set([...paint(x, y), 255], p);
    }
  const chunk = (type: string, data: Uint8Array) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, "latin1");
    out.set(data, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array())]);
};

const GREY: [number, number, number] = [100, 100, 100];
const WHITE: [number, number, number] = [255, 252, 240];

describe("shots compare: numbers of a pair", () => {
  // 10 x 10: the top half sky grey; the ground (rows 5-9) grey before, and after a white strip on rows 8-9.
  const before = decodeRgb(png(10, 10, () => GREY));
  const after = decodeRgb(png(10, 10, (_x, y) => (y >= 8 ? WHITE : GREY)));

  it("counts the burnt bottom half, the mean luma and the changed share", () => {
    expect(frameStats(before)).toEqual({ meanLuma: 100, burntLowPct: 0 });
    // 20 of the 50 bottom-half pixels are R, G >= 250.
    expect(frameStats(after).burntLowPct).toBe(40);
    const s = pairStats(before, after);
    expect(s.changedPct).toBe(20);
    expect(s.burntAmongChangedPct).toBe(40);
    expect(s.changedLowLuma).toEqual({ before: 100, after: 251.8 });
    expect(pairLine("strip", s)).toBe("strip: changed 20.0%, burnt bottom 0.00% -> 40.00%, mean luma 100 -> 130, luma of changed ground 100 -> 252");
  });

  it("does not count a change of up to 24 summed over R, G and B, nor white with a blue-only channel", () => {
    const close = decodeRgb(png(10, 10, () => [108, 108, 108]));
    expect(pairStats(before, close).changedPct).toBe(0);
    expect(pairStats(before, close).changedLowLuma).toBeNull();
    const blue: Frame = decodeRgb(png(4, 2, () => [0, 0, 255]));
    expect(frameStats(blue).burntLowPct).toBe(0);
  });

  it("counts a sky change out of the ground numbers and gives up on frames of other sizes", () => {
    const sky = decodeRgb(png(10, 10, (_x, y) => (y < 5 ? WHITE : GREY)));
    const s = pairStats(before, sky);
    expect(s.changedPct).toBe(50);
    expect(s.burntAmongChangedPct).toBe(0);
    expect(s.changedLowLuma).toBeNull();
    const other = pairStats(before, decodeRgb(png(8, 10, () => GREY)));
    expect(other.changedPct).toBeNull();
    expect(pairLine("x", other)).toContain("sizes differ");
  });
});

describe("shots compare: the spots file", () => {
  it("reads GLITCH_SPOTS, with or without the floor height", () => {
    expect(parseSpots('[["rynek-n", 10, -5.5, 1.57, -0.1], ["metro", 0, 0, 0, 0, -6]]')).toEqual([
      ["rynek-n", 10, -5.5, 1.57, -0.1],
      ["metro", 0, 0, 0, 0, -6],
    ]);
  });

  it("refuses what would waste two builds: no list, a bad name, a name twice, a missing number", () => {
    expect(() => parseSpots("[]")).toThrow(/non-empty/);
    expect(() => parseSpots('[["a b", 0, 0, 0, 0]]')).toThrow(/name/);
    expect(() => parseSpots('[["../x", 0, 0, 0, 0]]')).toThrow(/name/);
    expect(() => parseSpots('[["a", 0, 0, 0, 0], ["a", 1, 1, 0, 0]]')).toThrow(/twice/);
    expect(() => parseSpots('[["a", 0, 0, 0]]')).toThrow(/yaw, pitch/);
    expect(() => parseSpots('[["a", 0, "1", 0, 0]]')).toThrow(/numbers/);
  });
});
