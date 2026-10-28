import { describe, expect, it } from "vitest";
import { FlashLimiter, MAX_FLASHES_PER_SECOND } from "../src/effects/flash-limiter";
import { GameplayFxState } from "../src/effects/gameplay-fx";
import { DASH_FOLLOW, DASH_TRAIL_LIFE, MAX_TRAILS, REFLECT_TRAIL_LIFE, TrailState, segment, trailFade } from "../src/effects/trails";

const DT = 1 / 60;
const at = { x: 0, y: 0, z: 0 };

describe("dash streaks (ADR-0036)", () => {
  it("leaves two streaks whose heads follow the dasher, then stay where the dash ended", () => {
    const trails = new TrailState(new FlashLimiter());
    trails.dash(7, at);
    expect(trails.trails.map((t) => t.kind)).toEqual(["dash", "dash-low"]);
    let z = 0;
    for (let t = 0; t < DASH_FOLLOW + 0.1; t += DT) {
      z += 12 * DT;
      trails.update(DT, (id) => (id === 7 ? { x: 0, y: 0, z } : null));
    }
    const [high, low] = trails.trails;
    expect(high!.from.y).toBeCloseTo(1.15);
    expect(low!.from.y).toBeCloseTo(0.45);
    // The head stopped following after DASH_FOLLOW, so it lags the dasher now.
    expect(high!.to.z).toBeGreaterThan(2);
    expect(high!.to.z).toBeLessThan(z);
    expect(segment(high!.from, high!.to).length).toBeCloseTo(high!.to.z, 5);
  });

  it("fades out and goes after its life", () => {
    const trails = new TrailState(new FlashLimiter());
    trails.dash(1, at);
    trails.update(DASH_TRAIL_LIFE / 2, () => null);
    const t = trails.trails[0]!;
    expect(trailFade(t.ttl, t.life)).toBeCloseTo(0.5, 5);
    trails.update(DASH_TRAIL_LIFE, () => null);
    expect(trails.trails).toHaveLength(0);
  });

  it("keeps at most MAX_TRAILS, dropping the oldest", () => {
    const trails = new TrailState(new FlashLimiter());
    for (let i = 0; i < MAX_TRAILS; i++) trails.dash(i, { x: i, y: 0, z: 0 });
    expect(trails.trails).toHaveLength(MAX_TRAILS);
    expect(trails.trails[0]!.from.x).toBe(MAX_TRAILS / 2);
  });
});

describe("reflected bullets (ADR-0036)", () => {
  it("draw a trail from the blade to the shooter's chest", () => {
    const trails = new TrailState(new FlashLimiter());
    trails.reflect({ x: 1, y: 1.3, z: 1 }, { x: 1, y: 0, z: 11 }, false);
    const t = trails.trails[0]!;
    expect(t.kind).toBe("reflect");
    expect(t.to).toEqual({ x: 1, y: 1.3, z: 11 });
    expect(t.life).toBe(REFLECT_TRAIL_LIFE);
  });

  it("light the street at most three times a second, together with every other flash", () => {
    const limiter = new FlashLimiter();
    const trails = new TrailState(limiter);
    let lit = 0;
    for (let i = 0; i < 60; i++) {
      limiter.advance(DT);
      if (trails.reflect(at, null, false)) lit++;
    }
    expect(lit).toBe(MAX_FLASHES_PER_SECOND);
    // Every reflection still shows its trail (the pool keeps the newest).
    expect(trails.trails).toHaveLength(MAX_TRAILS);
  });

  it("never flash with reduced flashes", () => {
    const limiter = new FlashLimiter();
    const trails = new TrailState(limiter);
    expect(trails.reflect(at, null, true)).toBe(false);
    expect(limiter.recent).toBe(0);
  });
});

describe("dash blur", () => {
  it("blurs the frame for a moment, without spending a flash", () => {
    const fx = new GameplayFxState();
    expect(fx.active).toBe(false);
    fx.dash(false);
    expect(fx.uniforms.blur).toBeCloseTo(0.85);
    expect(fx.active).toBe(true);
    expect(fx.limiter.recent).toBe(0);
    for (let i = 0; i < 30; i++) fx.update(DT);
    expect(fx.uniforms.blur).toBe(0);
    expect(fx.active).toBe(false);
  });

  it("is stronger in the air and halved with reduced flashes", () => {
    const fx = new GameplayFxState();
    fx.dash(true);
    expect(fx.uniforms.blur).toBe(1);
    const calm = new GameplayFxState();
    calm.setReduceFlashes(true);
    calm.dash(true);
    expect(calm.uniforms.blur).toBe(0.5);
  });
});
