import { describe, expect, it } from "vitest";
import { coverOf, coverageLines, squareOf } from "../src/walk-coverage.ts";

describe("the cover of the older checks of steps by walk-blocked (ADR-0080)", () => {
  it("puts a key of either grid on its 10 m square", () => {
    expect(squareOf("deck-abutment-step", "podzamcze-2-0 1070,160")).toBe("1070,160");
    expect(squareOf("steps-riser-tall", "stare-miasto-1-1 -728,157")).toBe("-730,150");
    expect(squareOf("steps-riser-tall", "? traffic")).toBeNull();
  });

  it("covers a key in the same square or one beside it, not further", () => {
    const walk = new Set(["720,150"]);
    expect(coverOf("deck-abutment-step", "s 720,150", walk)).toBe("square");
    expect(coverOf("steps-riser-tall", "s 731,162", walk)).toBe("beside");
    expect(coverOf("deck-abutment-step", "s 1070,160", walk)).toBe("none");
  });

  it("lists every key and the sums", () => {
    const old = new Map([["deck-abutment-step", new Map([["a 720,150", 1], ["b 1070,160", 1]])]]);
    const lines = coverageLines(old, ["a 720,150"]);
    expect(lines).toContain("  covered a 720,150");
    expect(lines).toContain("  NOT COVERED b 1070,160");
    expect(lines.at(-1)).toBe("walk-blocked 1 square(s); old keys 2: 1 in the same square, 0 beside, 1 not covered");
  });
});
