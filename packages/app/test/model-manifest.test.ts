import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAST_KEYS, type CastKey } from "@seki/core";
import { CAST_OF_SPAWN } from "@seki/sim";
import { parseModelManifest } from "../src/model-manifest";

const BASE = "https://example.test/game/models/manifest.json";

describe("parseModelManifest", () => {
  it("resolves model URLs against the manifest and keeps known characters only", () => {
    const manifest = parseModelManifest({ heroine: { url: "seki.vrm", scale: 1.1 }, fixer: { scale: 2 }, dragon: { url: "x.glb" } }, BASE);
    expect(manifest).toEqual({ heroine: { url: "https://example.test/game/models/seki.vrm", scale: 1.1 } });
  });

  it("treats anything but an object as an empty manifest", () => {
    expect(parseModelManifest(null, "https://example.test/")).toEqual({});
    expect(parseModelManifest("nope", "https://example.test/")).toEqual({});
  });

  it("reads the cast and the pools (ADR-0076), dropping unknown names, roles and entries without a URL", () => {
    const manifest = parseModelManifest(
      {
        civilian: { url: "civilian.vrm" },
        cast: { ume: { url: "ume.vrm", scale: 0.9, variant: 2 }, godzilla: { url: "g.vrm" }, hana: { scale: 1 } },
        pools: { civilian: [{ url: "a.vrm", weight: 3 }, { weight: 1 }], dragons: [{ url: "d.vrm" }], corpo: [] },
      },
      BASE,
    );
    expect(manifest).toEqual({
      civilian: { url: "https://example.test/game/models/civilian.vrm" },
      cast: { ume: { url: "https://example.test/game/models/ume.vrm", scale: 0.9, variant: 2 } },
      pools: { civilian: [{ url: "https://example.test/game/models/a.vrm", weight: 3 }] },
    });
    // Broken sections are dropped, the role models stay.
    expect(parseModelManifest({ civilian: { url: "c.vrm" }, cast: [1], pools: "x" }, BASE)).toEqual({ civilian: { url: "https://example.test/game/models/c.vrm" } });
  });
});

const read = readFileSync as (u: URL) => Uint8Array;
const GAME = parseModelManifest(JSON.parse(new TextDecoder().decode(read(new URL("../public/models/manifest.json", import.meta.url)))), BASE);

/**
 * Named characters who still share a look in stage 1 (ADR-0076): until stage 2 brings the
 * variants, the cast stands in the five files of before. Each stage takes names off this list;
 * empty, the test below is the user's decision 6: no two named characters look the same.
 */
const SHARED_UNTIL_STAGE_2: readonly CastKey[] = [
  // The first name of `CAST_KEYS` on a file owns it; these borrow Kaito's `kaito.vrm` and Ume's `civilian.vrm`.
  "kurosawa", // until his own model (decision 4)
  ...(["hana", "genzo", "ren", "fumiko", "kenta", "goro", "oyaji", "sachiko"] as const),
  ...(["tetsu", "hideo", "mei", "sabu", "hina", "takumi", "shiro", "tomo", "nobu", "koji", "daigo", "riko", "kiku", "akane"] as const),
];

describe("the game's cast (ADR-0076)", () => {
  it("has a model for every named character the simulation places", () => {
    for (const key of new Set(Object.values(CAST_OF_SPAWN))) expect(GAME.cast?.[key], key).toBeDefined();
    for (const key of CAST_KEYS) expect(GAME.cast?.[key], key).toBeDefined();
  });

  it("gives no two named characters the same file and variant, but for the known exceptions", () => {
    const seen = new Map<string, CastKey>();
    const clashes: CastKey[] = [];
    for (const key of CAST_KEYS) {
      const spec = GAME.cast?.[key];
      if (!spec) continue;
      const look = `${spec.url}#${spec.variant ?? 0}`;
      if (seen.has(look)) clashes.push(key);
      else seen.set(look, key);
    }
    expect(clashes.filter((k) => !SHARED_UNTIL_STAGE_2.includes(k))).toEqual([]);
    // A name taken off the list for good stays off: the exceptions only shrink.
    expect(SHARED_UNTIL_STAGE_2.filter((k) => !clashes.includes(k))).toEqual([]);
  });

  it("keeps a pool for every background role, in the files of the role models", () => {
    expect(Object.keys(GAME.pools ?? {}).sort()).toEqual(["civilian", "corpo", "ganger", "vendor"]);
  });
});
