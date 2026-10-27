import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { audioFiles, audioSampleManifest } from "../src/audio-manifest";

const DIR = join(import.meta.dirname, "../public/audio");

describe("audio sample manifest", () => {
  it("resolves every file against the audio folder", () => {
    const m = audioSampleManifest("https://example.test/game/audio/");
    expect(m.cues?.shot?.urls[0]).toBe("https://example.test/game/audio/gun-pistol-ppq-near.ogg");
    expect(m.rain?.url).toBe("https://example.test/game/audio/rain-loop.ogg");
    expect(m.footsteps?.urls).toHaveLength(5);
    for (const set of Object.values(m.cues ?? {})) for (const u of set?.urls ?? []) expect(u.startsWith("https://example.test/game/audio/")).toBe(true);
  });

  it("names only files that ship, each credited in the README, within the size budget", () => {
    const shipped = new Set(readdirSync(DIR).filter((f) => f.endsWith(".ogg")));
    const readme = readFileSync(join(DIR, "README.md"), "utf8");
    for (const f of audioFiles()) {
      expect(shipped.has(f), f).toBe(true);
      expect(readme.includes(f), `README lists ${f}`).toBe(true);
    }
    // No stray recordings: everything in the folder is used.
    expect([...shipped].sort()).toEqual([...new Set(audioFiles())].sort());
    const bytes = [...shipped].reduce((n, f) => n + statSync(join(DIR, f)).size, 0);
    expect(bytes).toBeLessThan(4 * 1024 * 1024);
  });
});
