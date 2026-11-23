import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * `tools/blender/build.py` builds every room's models in the order of its `ROOMS` (ADR-0098): each module there must be
 * imported above the list, or Blender stops on a NameError before it writes a file (a merge once left
 * `import brama_krakowska` under the list; CI does not run Blender, so this test is what catches it).
 */
const BUILD = fileURLToPath(new URL("../../blender/build.py", import.meta.url));

describe("tools/blender/build.py", () => {
  it("imports every room module of ROOMS above the list", () => {
    const lines = readFileSync(BUILD, "utf8").split("\n");
    const at = lines.findIndex((l) => l.startsWith("ROOMS = ["));
    expect(at).toBeGreaterThan(0);
    const rooms = lines[at]!.slice("ROOMS = [".length, lines[at]!.lastIndexOf("]")).split(",").map((s) => s.trim());
    const imported = new Set(lines.slice(0, at).map((l) => /^import (\w+)\s+# noqa: E402$/.exec(l)?.[1]).filter((m): m is string => Boolean(m)));
    for (const room of rooms) expect(imported.has(room), room).toBe(true);
    expect(lines.slice(at + 1).some((l) => /^import \w+/.test(l))).toBe(false);
  });
});
