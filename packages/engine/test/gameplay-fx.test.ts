import { describe, expect, it } from "vitest";
import { FlashLimiter, MAX_FLASHES_PER_SECOND } from "../src/effects/flash-limiter";
import { GameplayFxState, HEAT_PULSE_MAX_HZ, heatPulseHz } from "../src/effects/gameplay-fx";

const DT = 1 / 60;

/** Runs `seconds` of frames, calling `each` before every frame; returns the uniform samples. */
const run = (fx: GameplayFxState, seconds: number, each: (frame: number) => void = () => {}) => {
  const out = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    each(i);
    fx.limiter.advance(DT);
    fx.update(DT);
    out.push(fx.uniforms);
  }
  return out;
};

/** Flash onsets: frames where the signal jumps up after holding or falling. */
const onsets = (values: readonly number[], step = 0.02): number => {
  let n = 0;
  let rising = false;
  for (let i = 1; i < values.length; i++) {
    const up = values[i]! - values[i - 1]! > step;
    if (up && !rising) n++;
    rising = up;
  }
  return n;
};

describe("flash limiter", () => {
  it("allows three flashes in any second, then refuses until the window moves", () => {
    const l = new FlashLimiter();
    expect(l.tryFlash()).toBe(true);
    expect(l.tryFlash()).toBe(true);
    expect(l.tryFlash()).toBe(true);
    expect(l.tryFlash()).toBe(false);
    expect(l.recent).toBe(MAX_FLASHES_PER_SECOND);
    l.advance(0.5);
    expect(l.tryFlash()).toBe(false);
    l.advance(0.51);
    expect(l.tryFlash()).toBe(true);
    expect(l.recent).toBe(1);
  });

  it("leaves less room while a steady pulse reserves its share", () => {
    const l = new FlashLimiter();
    l.reserve(1);
    expect(l.tryFlash()).toBe(true);
    expect(l.tryFlash()).toBe(true);
    expect(l.tryFlash()).toBe(false);
    l.reserve(0);
    expect(l.tryFlash()).toBe(true);
  });
});

describe("gameplay post-process state (ADR-0030)", () => {
  it("is idle until something happens, and idle again after it fades", () => {
    const fx = new GameplayFxState();
    expect(fx.active).toBe(false);
    fx.hurtBy(20);
    expect(fx.active).toBe(true);
    const u = run(fx, 0.05)[0]!;
    expect(u.aberration).toBeGreaterThan(0.3);
    expect(u.glitch).toBeGreaterThan(0);
    expect(u.hurt).toBeGreaterThan(0.3);
    run(fx, 2);
    expect(fx.active).toBe(false);
  });

  it("scales the hit with the damage", () => {
    const small = new GameplayFxState();
    small.hurtBy(2);
    const big = new GameplayFxState();
    big.hurtBy(40);
    expect(run(big, DT)[0]!.hurt).toBeGreaterThan(run(small, DT)[0]!.hurt);
  });

  it("glitches on quickhack uploads, harder when one lands", () => {
    const fx = new GameplayFxState();
    fx.hack("started");
    const started = run(fx, DT)[0]!.glitch;
    run(fx, 1.5);
    fx.hack("applied");
    expect(run(fx, DT)[0]!.glitch).toBeGreaterThan(started);
  });

  it("never flashes more than three times a second, however fast the hits come", () => {
    const fx = new GameplayFxState();
    // A burst of 12 hits a second for two seconds (an SMG at point blank).
    const samples = run(fx, 2, (i) => {
      if (i % 5 === 0) fx.hurtBy(15);
    });
    for (let start = 0; start + 61 <= samples.length; start += 3) {
      const window = samples.slice(start, start + 61);
      expect(onsets(window.map((u) => u.aberration))).toBeLessThanOrEqual(MAX_FLASHES_PER_SECOND);
      expect(onsets(window.map((u) => u.hurt))).toBeLessThanOrEqual(MAX_FLASHES_PER_SECOND);
    }
    // It does flash, up to the ceiling: three a second over the two seconds.
    expect(onsets([0, ...samples.map((u) => u.aberration)])).toBeGreaterThanOrEqual(2 * MAX_FLASHES_PER_SECOND - 1);
  });

  it("with reduced flashes shows no aberration or glitch and fades the red in gently", () => {
    const fx = new GameplayFxState();
    fx.setReduceFlashes(true);
    fx.hurtBy(40);
    fx.hack("applied");
    const samples = run(fx, 1.5);
    expect(samples.every((u) => u.aberration === 0 && u.glitch === 0)).toBe(true);
    expect(samples.every((u) => u.reduce === 1 && u.time === 0)).toBe(true);
    // The red rises over several frames instead of snapping in.
    expect(samples[0]!.hurt).toBeLessThan(0.1);
    expect(Math.max(...samples.map((u) => u.hurt))).toBeGreaterThan(0.2);
    for (let i = 1; i < samples.length; i++) expect(Math.abs(samples[i]!.hurt - samples[i - 1]!.hurt)).toBeLessThan(0.06);
  });

  it("switching reduced flashes on mid-glitch cuts the glitch at once", () => {
    const fx = new GameplayFxState();
    fx.hack("applied");
    run(fx, DT);
    fx.setReduceFlashes(true);
    expect(fx.uniforms.glitch).toBe(0);
    expect(fx.uniforms.aberration).toBe(0);
    expect(fx.reduceFlashes).toBe(true);
  });

  it("fades the scanner look in and out", () => {
    const fx = new GameplayFxState();
    fx.setScanning(true);
    const on = run(fx, 0.5);
    expect(on[0]!.scan).toBeGreaterThan(0);
    expect(on[0]!.scan).toBeLessThan(0.2);
    expect(on.at(-1)!.scan).toBe(1);
    fx.setScanning(false);
    run(fx, 0.5);
    expect(fx.uniforms.scan).toBe(0);
    expect(fx.active).toBe(false);
  });

  it("pulses red and blue at the edges with heat, at most once a second", () => {
    expect(heatPulseHz(0)).toBe(0);
    expect(heatPulseHz(1)).toBeLessThan(heatPulseHz(3));
    expect(heatPulseHz(3)).toBeLessThanOrEqual(HEAT_PULSE_MAX_HZ);
    const fx = new GameplayFxState();
    fx.setHeat(3, false);
    const samples = run(fx, 4);
    const tail = samples.slice(-120);
    expect(Math.max(...tail.map((u) => u.heat))).toBeGreaterThan(0.6);
    // Red (heatMix 0) and blue (1) both come round.
    expect(Math.min(...tail.map((u) => u.heatMix))).toBeLessThan(0.1);
    expect(Math.max(...tail.map((u) => u.heatMix))).toBeGreaterThan(0.9);
    // Red peaks: local minima of heatMix.
    let peaks = 0;
    for (let i = 1; i < tail.length - 1; i++) if (tail[i]!.heatMix < tail[i - 1]!.heatMix && tail[i]!.heatMix <= tail[i + 1]!.heatMix) peaks++;
    expect(peaks).toBeLessThanOrEqual(2 * HEAT_PULSE_MAX_HZ);
    // The pulse keeps a flash a second for itself: hits get only two.
    expect(fx.limiter.tryFlash()).toBe(true);
    expect(fx.limiter.tryFlash()).toBe(true);
    expect(fx.limiter.tryFlash()).toBe(false);
  });

  it("glows at half strength while the hunters only search, and fades out at heat 0", () => {
    const hunted = new GameplayFxState();
    hunted.setHeat(3, false);
    hunted.setReduceFlashes(true);
    const searching = new GameplayFxState();
    searching.setHeat(3, true);
    searching.setReduceFlashes(true);
    expect(run(searching, 3).at(-1)!.heat).toBeCloseTo(run(hunted, 3).at(-1)!.heat / 2, 1);
    hunted.setHeat(0, false);
    run(hunted, 3);
    expect(hunted.uniforms.heat).toBe(0);
    expect(hunted.active).toBe(false);
  });

  it("with reduced flashes drifts the heat colours slowly at steady brightness", () => {
    const fx = new GameplayFxState();
    fx.setReduceFlashes(true);
    fx.setHeat(2, false);
    const tail = run(fx, 4).slice(-60);
    const heats = tail.map((u) => u.heat);
    expect(Math.max(...heats) - Math.min(...heats)).toBeLessThan(0.01);
    for (let i = 1; i < tail.length; i++) expect(Math.abs(tail[i]!.heatMix - tail[i - 1]!.heatMix)).toBeLessThan(0.01);
  });
});
