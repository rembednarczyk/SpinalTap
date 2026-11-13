import { describe, expect, it } from "vitest";
import { manifestFiles, modelChoiceOf, modelPoolKey, pickFromPool, resolveModel, startFiles } from "../src/renderer/model-cast";
import type { CharacterModelManifest } from "../src/renderer/model-library";

const MANIFEST: CharacterModelManifest = {
  heroine: { url: "seki.vrm" },
  fixer: { url: "kaito.vrm", scale: 1.03 },
  civilian: { url: "civilian.vrm" },
  ganger: { url: "ganger.vrm" },
  cast: { ume: { url: "ume.vrm" }, kurosawa: { url: "kaito.vrm", variant: 1 } },
  pools: { civilian: [{ url: "a.vrm", weight: 3 }, { url: "b.vrm" }], corpo: [{ url: "suit.vrm" }] },
};

/** ADR-0076: the model by the name, then by the role's pool and the look, then by the role. */
describe("the model a character wears", () => {
  it("is the named character's own when the manifest has it", () => {
    expect(resolveModel(MANIFEST, modelChoiceOf({ kind: "npc", preset: "civilian", cast: "ume", look: 5 }))?.url).toBe("ume.vrm");
    expect(resolveModel(MANIFEST, modelChoiceOf({ kind: "npc", preset: "fixer", cast: "kurosawa" }))).toEqual({ url: "kaito.vrm", variant: 1 });
  });

  it("comes from the role's pool by the look for the background and for a name without a model", () => {
    const urls = new Set<string>();
    for (let look = 0; look < 200; look++) urls.add(resolveModel(MANIFEST, modelChoiceOf({ kind: "npc", preset: "civilian", cast: "hana", look }))!.url);
    expect(urls).toEqual(new Set(["a.vrm", "b.vrm"]));
    expect(resolveModel(MANIFEST, modelChoiceOf({ kind: "enemy", preset: "corpo", look: 9 }))?.url).toBe("suit.vrm");
  });

  it("falls back to the role's model without a pool, without a look and for the heroine", () => {
    expect(resolveModel(MANIFEST, modelChoiceOf({ kind: "enemy", preset: "ganger", look: 9 }))?.url).toBe("ganger.vrm");
    expect(resolveModel(MANIFEST, modelChoiceOf({ kind: "enemy", preset: "corpo" }))?.url).toBe("ganger.vrm");
    expect(resolveModel(MANIFEST, modelChoiceOf({ kind: "npc", preset: "fixer", cast: "kaito" }))?.url).toBe("kaito.vrm");
    expect(resolveModel(MANIFEST, modelChoiceOf({ kind: "npc", preset: "ripperdoc", look: 3 }))).toBeUndefined();
    expect(resolveModel(MANIFEST, modelChoiceOf({ kind: "heroine" }))?.url).toBe("seki.vrm");
    // A manifest of the old shape (role keys only) dresses everyone as before.
    expect(resolveModel({ civilian: { url: "civilian.vrm" } }, modelChoiceOf({ kind: "npc", preset: "civilian", cast: "ume", look: 1 }))?.url).toBe("civilian.vrm");
  });

  it("draws a pool by its weights, the same file for the same look", () => {
    const pool = [{ url: "a", weight: 3 }, { url: "b" }, { url: "none", weight: 0 }];
    const counts = new Map<string, number>();
    for (let look = 0; look < 4000; look++) {
      const u = pickFromPool(pool, look)!.url;
      counts.set(u, (counts.get(u) ?? 0) + 1);
    }
    expect(counts.get("none")).toBeUndefined();
    expect(counts.get("a")! / 4000).toBeCloseTo(0.75, 1);
    expect(pickFromPool(pool, 123456)).toBe(pickFromPool(pool, 123456));
    expect(pickFromPool([], 1)).toBeNull();
    expect(pickFromPool([{ url: "z", weight: 0 }], 1)).toBeNull();
  });

  it("draws a weight that is no number as the default 1 and a negative one as 0, never always the last file (G-488)", () => {
    const pool = [{ url: "a", weight: "abc" as unknown as number }, { url: "b" }, { url: "c", weight: -5 }];
    const counts = new Map<string, number>();
    for (let look = 0; look < 4000; look++) {
      const u = pickFromPool(pool, look)!.url;
      counts.set(u, (counts.get(u) ?? 0) + 1);
    }
    expect(counts.get("c")).toBeUndefined();
    expect(counts.get("a")! / 4000).toBeCloseTo(0.5, 1);
    expect(pickFromPool([{ url: "z", weight: Number.NaN }], 1)!.url).toBe("z");
  });

  it("pools instances by file, scale, turn and variant, and loads each file once", () => {
    expect(modelPoolKey({ url: "kaito.vrm", scale: 1.03 })).not.toBe(modelPoolKey({ url: "kaito.vrm", scale: 1.03, variant: 1 }));
    expect(modelPoolKey({ url: "kaito.vrm" })).toBe(modelPoolKey({ url: "kaito.vrm", scale: 1, yaw: 0, variant: 0 }));
    expect(manifestFiles(MANIFEST).map((s) => s.url)).toEqual(["seki.vrm", "kaito.vrm", "civilian.vrm", "ganger.vrm", "ume.vrm", "a.vrm", "b.vrm", "suit.vrm"]);
  });
});

/** The heroine's model loads behind the first loading screen in every view (the user's decision, 13.11). */
describe("the files the first loading screen waits for", () => {
  it("hold Seki's model even with no character in the scene and the camera in first person", () => {
    expect(startFiles(MANIFEST, []).map((f) => f.url)).toContain("seki.vrm");
    expect(startFiles(MANIFEST, [null, null]).map((f) => f.url)[0]).toBe("seki.vrm");
  });
});
