import { describe, expect, it } from "vitest";
import type { AudioListenerPose } from "@seki/core";
import { FootstepClock, STEP_MIN_SPEED, stepInterval } from "../src/audio/footsteps";
import { DEFAULT_VOLUMES, DUCK_LEVEL, MixState } from "../src/audio/mixer";
import { A_MINOR_PCS, COMBAT_HOLD, LAYERS, LAYER_MIX, LOOP_STEPS, MusicDirector, MusicSequencer, STEPS_PER_BAR, midiToHz } from "../src/audio/music";
import { emitterMix, falloff, neonEmitters } from "../src/audio/spatial";
import { PRIORITY, VoicePool } from "../src/audio/voice-pool";

describe("MusicDirector", () => {
  it("starts in exploration", () => {
    expect(new MusicDirector().mood(0)).toBe("explore");
  });

  it("enters combat on shots and falls back after the hold", () => {
    const d = new MusicDirector();
    d.notify("enemy-shot", 10);
    expect(d.mood(10)).toBe("combat");
    expect(d.mood(10 + COMBAT_HOLD - 0.1)).toBe("combat");
    expect(d.mood(10 + COMBAT_HOLD + 0.1)).toBe("explore");
  });

  it("ignores non-combat cues", () => {
    const d = new MusicDirector();
    d.notify("ui-select", 0);
    d.notify("purchase", 0);
    expect(d.mood(0)).toBe("explore");
  });

  it("calms down sooner after a kill", () => {
    const d = new MusicDirector();
    d.notify("shot", 0);
    d.notify("kill", 1);
    expect(d.mood(1 + COMBAT_HOLD / 2 + 0.1)).toBe("explore");
  });

  it("plays overdrive for the ability duration, then combat", () => {
    const d = new MusicDirector();
    d.notify("overdrive", 0);
    expect(d.mood(3.9)).toBe("overdrive");
    expect(d.mood(4.5)).toBe("combat");
  });

  it("lets dialogue override everything and an explicit base mood stick", () => {
    const d = new MusicDirector();
    d.notify("shot", 0);
    d.setBase("dialog");
    expect(d.mood(0)).toBe("dialog");
    d.setBase("combat");
    expect(d.mood(1000)).toBe("combat");
    d.setBase("overdrive");
    expect(d.mood(1000)).toBe("overdrive");
    expect(d.baseMood).toBe("overdrive");
  });
});

describe("layer mix", () => {
  const active = (m: keyof typeof LAYER_MIX) => LAYERS.filter((l) => LAYER_MIX[m][l] > 0).length;

  it("keeps drums out of exploration and dialogue", () => {
    expect(LAYER_MIX.explore.drums).toBe(0);
    expect(LAYER_MIX.dialog.drums).toBe(0);
  });

  it("builds up from dialogue to overdrive", () => {
    expect(active("dialog")).toBeLessThan(active("explore"));
    expect(active("explore")).toBeLessThan(active("combat"));
    expect(active("overdrive")).toBe(LAYERS.length);
    for (const l of LAYERS) for (const m of Object.keys(LAYER_MIX) as (keyof typeof LAYER_MIX)[]) expect(LAYER_MIX[m][l]).toBeLessThanOrEqual(1);
  });
});

describe("MusicSequencer", () => {
  const seq = new MusicSequencer();

  it("stays in A minor", () => {
    for (let s = 0; s < LOOP_STEPS; s++) for (const e of seq.at(s)) if (e.layer !== "drums") expect(A_MINOR_PCS.has(e.midi % 12)).toBe(true);
  });

  it("loops and accepts any step index", () => {
    expect(seq.at(LOOP_STEPS + 5)).toBe(seq.at(5));
    expect(seq.at(-1)).toBe(seq.at(LOOP_STEPS - 1));
  });

  it("puts a chord on every bar and a kick on the downbeat", () => {
    for (let bar = 0; bar < LOOP_STEPS / STEPS_PER_BAR; bar++) {
      const down = seq.at(bar * STEPS_PER_BAR);
      expect(down.filter((e) => e.layer === "pad")).toHaveLength(3);
      expect(down.some((e) => e.drum === "kick")).toBe(true);
    }
    expect(seq.at(1).some((e) => e.layer === "pad")).toBe(false);
  });

  it("is reproducible from its seed", () => {
    const flat = (q: MusicSequencer) => Array.from({ length: LOOP_STEPS }, (_, i) => q.at(i));
    expect(flat(new MusicSequencer(7))).toEqual(flat(new MusicSequencer(7)));
    expect(flat(new MusicSequencer(7))).not.toEqual(flat(new MusicSequencer(8)));
  });

  it("converts MIDI to Hz", () => {
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(midiToHz(57)).toBeCloseTo(220);
  });
});

describe("VoicePool", () => {
  it("admits voices up to capacity and frees them when they end", () => {
    const p = new VoicePool<string>(2);
    expect(p.claim("a", 1, 0, 1)).toEqual({ ok: true, evicted: null });
    expect(p.claim("b", 1, 0, 2)).toEqual({ ok: true, evicted: null });
    expect(p.size).toBe(2);
    p.prune(1.5);
    expect(p.size).toBe(1);
  });

  it("steals the oldest voice of the lowest priority", () => {
    const p = new VoicePool<string>(3);
    p.claim("music-old", PRIORITY.music, 0, 10);
    p.claim("drop", PRIORITY.ambience, 1, 10);
    p.claim("music-new", PRIORITY.music, 2, 10);
    expect(p.claim("shot", PRIORITY.sfx, 3, 10)).toEqual({ ok: true, evicted: "drop" });
    expect(p.claim("shot2", PRIORITY.sfx, 4, 10)).toEqual({ ok: true, evicted: "music-old" });
  });

  it("refuses a voice when everything playing matters more", () => {
    const p = new VoicePool<string>(1);
    p.claim("ui", PRIORITY.ui, 0, 10);
    expect(p.canClaim(PRIORITY.ambience, 1)).toBe(false);
    expect(p.claim("drop", PRIORITY.ambience, 1, 10)).toEqual({ ok: false });
    expect(p.canClaim(PRIORITY.ui, 1)).toBe(true);
    expect(p.canClaim(PRIORITY.ambience, 11)).toBe(true);
  });

  it("drains every voice", () => {
    const p = new VoicePool<number>(4);
    p.claim(1, 0, 0, 1);
    p.claim(2, 0, 0, 1);
    expect(p.drain()).toEqual([1, 2]);
    expect(p.size).toBe(0);
  });
});

describe("MixState", () => {
  it("starts from the defaults and clamps settings to 0..1", () => {
    const m = new MixState();
    expect(m.get("music")).toBe(DEFAULT_VOLUMES.music);
    m.set("sfx", 3);
    m.set("ambience", -1);
    m.set("master", Number.NaN);
    expect([m.get("sfx"), m.get("ambience"), m.get("master")]).toEqual([1, 0, 0]);
  });

  it("ducks only the music bus", () => {
    const m = new MixState();
    m.set("music", 0.5);
    m.setDucked(true);
    expect(m.isDucked).toBe(true);
    expect(m.gain("music")).toBeCloseTo(0.5 * DUCK_LEVEL);
    expect(m.gain("sfx")).toBe(m.get("sfx"));
    m.setDucked(false);
    expect(m.gain("music")).toBe(0.5);
  });
});

describe("positional ambience", () => {
  const at = (x: number, z: number, yaw = 0): AudioListenerPose => ({ position: { x, y: 0, z }, yaw, speed: 0 });

  it("falls off with distance and is silent beyond the range", () => {
    expect(falloff(0)).toBe(1);
    expect(falloff(2)).toBe(1);
    expect(falloff(10)).toBeLessThan(falloff(5));
    expect(falloff(29.9)).toBeGreaterThan(0);
    expect(falloff(29.9)).toBeLessThan(0.01);
    expect(falloff(30)).toBe(0);
  });

  it("pans by the listener's heading", () => {
    const sign = [{ position: { x: 5, y: 0, z: 0 }, level: 1 }];
    // Facing +Z (yaw 0), +X is to the right.
    expect(emitterMix(at(0, 0), sign).pan).toBeCloseTo(1);
    // Facing -Z, the same sign is on the left.
    expect(emitterMix(at(0, 0, Math.PI), sign).pan).toBeCloseTo(-1);
    // Straight ahead: centred.
    expect(emitterMix(at(5, -5), sign).pan).toBeCloseTo(0);
    expect(emitterMix(at(0, 0), []).gain).toBe(0);
  });

  it("hums louder under the Neon Koi sign than in the middle of nowhere", () => {
    const neon = neonEmitters();
    // The street's signs and the screens and strips inside the clinic and the bar (ADR-0038).
    expect(neon).toHaveLength(15);
    const near = emitterMix(at(6, 2), neon);
    const far = emitterMix(at(0, -60), neon);
    expect(near.gain).toBeGreaterThan(0.5);
    expect(far.gain).toBe(0);
    expect(near.gain).toBeLessThanOrEqual(1);
  });
});

describe("FootstepClock", () => {
  const stepsIn = (speed: number, seconds: number) => {
    const c = new FootstepClock();
    let n = 0;
    for (let t = 0; t < seconds; t += 1 / 60) n += c.advance(speed, 1 / 60);
    return n;
  };

  it("is silent when standing", () => {
    expect(stepsIn(0, 5)).toBe(0);
    expect(stepsIn(STEP_MIN_SPEED / 2, 5)).toBe(0);
  });

  it("steps about twice a second walking and faster when sprinting", () => {
    expect(stepsIn(4.2, 10)).toBeGreaterThanOrEqual(19);
    expect(stepsIn(4.2, 10)).toBeLessThanOrEqual(21);
    expect(stepsIn(6.9, 10)).toBeGreaterThan(stepsIn(4.2, 10));
    expect(stepInterval(100)).toBe(0.26);
  });

  it("takes the first step soon after starting to move", () => {
    const c = new FootstepClock();
    c.advance(0, 0.1);
    let t = 0;
    while (c.advance(4.2, 0.01) === 0) t += 0.01;
    expect(t).toBeLessThan(0.2);
  });

  it("alternates feet", () => {
    const c = new FootstepClock();
    expect([c.nextFoot(), c.nextFoot(), c.nextFoot()]).toEqual([-1, 1, -1]);
  });
});
