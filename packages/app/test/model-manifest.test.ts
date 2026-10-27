import { describe, expect, it } from "vitest";
import { parseModelManifest } from "../src/model-manifest";

describe("parseModelManifest", () => {
  it("resolves model URLs against the manifest and keeps known characters only", () => {
    const manifest = parseModelManifest(
      { heroine: { url: "seki.vrm", scale: 1.1 }, fixer: { scale: 2 }, dragon: { url: "x.glb" } },
      "https://example.test/game/models/manifest.json",
    );
    expect(manifest).toEqual({ heroine: { url: "https://example.test/game/models/seki.vrm", scale: 1.1 } });
  });

  it("treats anything but an object as an empty manifest", () => {
    expect(parseModelManifest(null, "https://example.test/")).toEqual({});
    expect(parseModelManifest("nope", "https://example.test/")).toEqual({});
  });
});
