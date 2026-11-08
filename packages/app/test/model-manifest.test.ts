import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAST_KEYS, type CastKey } from "@seki/core";
import { CAST_OF_SPAWN } from "@seki/sim";
import { BACKGROUND_VARIANTS, variantOf, variantText } from "@seki/engine";
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
    // A weight that is no finite number of 0 or more drops its entry (G-488).
    expect(
      parseModelManifest({ pools: { vendor: [{ url: "a.vrm", weight: "abc" }, { url: "b.vrm", weight: -1 }, { url: "c.vrm", weight: 0 }, { url: "d.vrm", weight: Number.POSITIVE_INFINITY }] } }, BASE),
    ).toEqual({ pools: { vendor: [{ url: "https://example.test/game/models/c.vrm", weight: 0 }] } });
    // Broken sections are dropped, the role models stay.
    expect(parseModelManifest({ civilian: { url: "c.vrm" }, cast: [1], pools: "x" }, BASE)).toEqual({ civilian: { url: "https://example.test/game/models/c.vrm" } });
  });
});

const read = readFileSync as (u: URL) => Uint8Array;
const GAME = parseModelManifest(JSON.parse(new TextDecoder().decode(read(new URL("../public/models/manifest.json", import.meta.url)))), BASE);

/**
 * Named characters who share a look with another (ADR-0076): empty since stage 2, when every
 * one got a variant of its own (decision 6 of the user). A name may never come back on it.
 */
const SHARED: readonly CastKey[] = [];

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
    expect(clashes.filter((k) => !SHARED.includes(k))).toEqual([]);
    // A name taken off the list for good stays off: the exceptions only shrink.
    expect(SHARED.filter((k) => !clashes.includes(k))).toEqual([]);
  });

  it("dresses no two named characters of one file alike, nor like the background of that file", () => {
    const looks = new Map<string, CastKey>();
    for (const key of CAST_KEYS) {
      const spec = GAME.cast![key]!;
      const look = `${spec.url}#${variantText(variantOf(spec.variant ?? 0, spec.dress))}`;
      expect(looks.get(look), `${key} looks like ${looks.get(look)}`).toBeUndefined();
      looks.set(look, key);
      // Named variants are 0 (the file's own, one character per file) or from 100 up, never a passer-by's.
      expect(spec.variant === undefined || spec.variant === 0 || spec.variant > BACKGROUND_VARIANTS, key).toBe(true);
    }
  });

  it("puts Mori on a man's model in an apron and glasses, and Kurosawa on a file of his own (decisions 3 and 4)", () => {
    const mori = GAME.cast!.mori!;
    expect(mori.url).toMatch(/ganger\.vrm$/);
    expect(variantOf(mori.variant ?? 0, mori.dress).accessories.map((a) => a.id).sort()).toEqual(["apron", "glasses"]);
    // Stage 3: his own face and hair (HairSample_Male), worn by no other named character nor the pools.
    const kurosawa = GAME.cast!.kurosawa!;
    expect(kurosawa.url).toMatch(/kurosawa\.vrm$/);
    expect(CAST_KEYS.filter((k) => GAME.cast?.[k]?.url === kurosawa.url)).toEqual(["kurosawa"]);
    expect(Object.values(GAME.pools ?? {}).flat().some((p) => p.url === kurosawa.url)).toBe(false);
    // Still dressed unlike Kaito: the cold man of Kagami in a dark suit.
    const kaito = variantOf(GAME.cast!.kaito!.variant ?? 0, GAME.cast!.kaito!.dress);
    const look = variantOf(kurosawa.variant ?? 0, kurosawa.dress);
    expect((["hair", "top", "bottom"] as const).filter((k) => kaito[k] !== look[k])).toEqual(["hair", "top", "bottom"]);
  });

  it("keeps the cast's files within 80 MiB (decision 5)", () => {
    const files = new Set([...Object.values(GAME.cast ?? {}), ...Object.values(GAME.pools ?? {}).flat(), GAME.heroine, GAME.fixer, GAME.civilian, GAME.ganger, GAME.ripperdoc].map((s) => s?.url));
    files.delete(undefined);
    expect(files.size).toBeGreaterThanOrEqual(7);
    const bytes = [...files].reduce((sum, url) => sum + read(new URL(`../public/models/${url!.slice(url!.lastIndexOf("/") + 1)}`, import.meta.url)).byteLength, 0);
    console.info(`[cast] ${files.size} files, ${(bytes / 2 ** 20).toFixed(1)} MiB`);
    expect(bytes / 2 ** 20).toBeLessThanOrEqual(80);
  });

  it("keeps a pool for every background role, in the files of the role models", () => {
    expect(Object.keys(GAME.pools ?? {}).sort()).toEqual(["civilian", "corpo", "ganger", "vendor"]);
  });
});
