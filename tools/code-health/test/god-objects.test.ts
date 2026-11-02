import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MEMBER_LIMIT, classSizes, godObjects } from "../src/classes";

/**
 * The god-object ratchet (ADR-0031). A class may hold at most `MEMBER_LIMIT` members; the ones
 * over it when the ratchet came in are in `god-objects-baseline.json` with their size, and may
 * only shrink. A split lowers the baseline in the same commit (`GOD_BASELINE=update pnpm vitest
 * run tools/code-health`); a new class over the limit, or a listed one that grows, is red.
 */

const ROOT = join(__dirname, "..", "..", "..");
const BASELINE = join(__dirname, "god-objects-baseline.json");

describe("god objects (ADR-0031)", () => {
  it("counts methods, accessors and function properties, not fields or the constructor", () => {
    const text = `class A { x = 1; constructor() {} a() {} get b() { return 1 } set b(v) {} c = () => 1; d = function () {}; static e() {} }`;
    expect(classSizes("a.ts", text)).toEqual([{ key: "a.ts#A", members: 6 }]);
  });

  it("holds every class to the limit or to its baseline, which only falls", () => {
    const found = Object.fromEntries(godObjects(ROOT).map((c) => [c.key, c.members]));
    if (process.env.GOD_BASELINE === "update" || !existsSync(BASELINE)) writeFileSync(BASELINE, `${JSON.stringify(found, null, 2)}\n`);
    const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Record<string, number>;
    for (const [key, n] of Object.entries(found)) {
      expect(n, `${key}: ${n} members, limit ${MEMBER_LIMIT}, baseline ${baseline[key] ?? "none"}; split it (ADR-0031)`).toBeLessThanOrEqual(baseline[key] ?? MEMBER_LIMIT);
    }
  });
});
