import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";
import { PROPS_OUT, buildProps } from "../src/props-build.ts";

/** The table file as the module runner would find it on the disk, holding `source` (`load` after the generator's own). */
const onDisk = (source: string): Plugin => ({
  name: "test-props-on-disk",
  load: (id) => (id.split("?")[0] === PROPS_OUT ? source : null),
});

const EMPTY = 'import type { LublinPropTable } from "./types";\nexport const LUBLIN_PROP_TABLE: LublinPropTable = {};\n';

describe("pnpm osm:props (G-745)", () => {
  // Two whole passes of the generator: about 20 s each on a free machine.
  it("writes the same table byte for byte whatever the table it overwrites holds", async () => {
    const fromEmpty = await buildProps([onDisk(EMPTY)]);
    const fromCommitted = await buildProps([onDisk(readFileSync(PROPS_OUT, "utf8"))]);
    expect(fromEmpty.figures.per).toEqual(fromCommitted.figures.per);
    expect(fromEmpty.text === fromCommitted.text).toBe(true);
  }, 240_000);
});
