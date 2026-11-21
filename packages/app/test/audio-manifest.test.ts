import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WEAPON_LEVELS, WEAPON_MEASURED, audioFiles, audioSampleManifest, weaponClass } from "../src/audio-manifest";

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

  it("plays the weapons' sounds at their class's level: every shot alike, the handling well under a shot (user's notes of 21.11)", () => {
    const m = audioSampleManifest("https://game.test/audio/");
    const heard = (cue: keyof typeof WEAPON_MEASURED) => WEAPON_MEASURED[cue] + 20 * Math.log10(m.cues?.[cue]?.gain ?? 1);
    for (const cue of Object.keys(WEAPON_MEASURED) as (keyof typeof WEAPON_MEASURED)[]) expect(Math.abs(heard(cue) - WEAPON_LEVELS[weaponClass(cue)]), cue).toBeLessThan(0.1);
    expect(WEAPON_LEVELS.shot - WEAPON_LEVELS.handling).toBeGreaterThanOrEqual(6);
    // The shotgun's shells and pump, too loud before (7 to 10 dB over its shot), now under it.
    for (const cue of ["reload-round", "shotgun-pump", "draw-shotgun"] as const) expect(heard(cue), cue).toBeLessThan(heard("shot-shotgun") - 6);
  });
});
