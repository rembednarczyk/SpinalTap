import { FlashLimiter } from "./flash-limiter";

/** What the gameplay post-process reads each frame (ADR-0030). All 0..1 unless noted. */
export interface FxUniforms {
  /** Chromatic aberration (hits, quickhacks). Always 0 with reduced flashes. */
  readonly aberration: number;
  /** Displaced slices of the frame. Always 0 with reduced flashes. */
  readonly glitch: number;
  /** Scanner look: scanlines, vignette, drained colour. */
  readonly scan: number;
  /** Red-blue glow at the frame edges while hunted. */
  readonly heat: number;
  /** 0 red .. 1 blue. */
  readonly heatMix: number;
  /** Red at the edges after a hit. */
  readonly hurt: number;
  /** Seconds, for the scanline crawl and the slice pattern; frozen with reduced flashes. */
  readonly time: number;
  /** 1 with reduced flashes: the shader keeps everything still. */
  readonly reduce: number;
}

/** Highest heat pulse rate, red peaks per second (one flash per peak). */
export const HEAT_PULSE_MAX_HZ = 1;

/** Heat pulse rate for a heat level 1..3: slow at 1, one a second at 3. */
export const heatPulseHz = (level: number): number => (level <= 0 ? 0 : Math.min(HEAT_PULSE_MAX_HZ, 0.5 + 0.25 * (Math.min(3, level) - 1)));

const approach = (v: number, target: number, rate: number, dt: number) => (v < target ? Math.min(target, v + rate * dt) : Math.max(target, v - rate * dt));

/**
 * Envelopes of the gameplay post-process: hits, scanner, quickhack uploads and heat, as pure
 * state, so the rules (reduced flashes, at most three flashes a second) are tested without a GPU.
 */
export class GameplayFxState {
  private aberration = 0;
  private glitch = 0;
  private scan = 0;
  private scanTarget = 0;
  private hurt = 0;
  private hurtTarget = 0;
  private heat = 0;
  private heatTarget = 0;
  private heatLevel = 0;
  private heatPhase = 0;
  private time = 0;
  private reduce = false;

  constructor(readonly limiter: FlashLimiter = new FlashLimiter()) {}

  setReduceFlashes(on: boolean): void {
    this.reduce = on;
    if (on) {
      this.aberration = 0;
      this.glitch = 0;
    }
    this.reserveHeat();
  }

  get reduceFlashes(): boolean {
    return this.reduce;
  }

  /** The player took `amount` damage. */
  hurtBy(amount: number): void {
    const s = Math.max(0.35, Math.min(1, 0.3 + amount / 40));
    if (!this.limiter.tryFlash()) {
      // The window is full: hold the red where it is instead of flashing again.
      this.hurtTarget = Math.max(this.hurtTarget, Math.min(this.hurt, s));
      return;
    }
    this.hurtTarget = Math.max(this.hurtTarget, s * (this.reduce ? 0.6 : 1));
    if (this.reduce) return;
    this.aberration = Math.max(this.aberration, s);
    this.glitch = Math.max(this.glitch, 0.45 * s);
  }

  /** A quickhack upload started or landed: a glitch impulse (none with reduced flashes). */
  hack(phase: "started" | "applied"): void {
    if (this.reduce || !this.limiter.tryFlash()) return;
    this.glitch = Math.max(this.glitch, phase === "applied" ? 0.9 : 0.6);
    this.aberration = Math.max(this.aberration, phase === "applied" ? 0.45 : 0.3);
  }

  setScanning(on: boolean): void {
    this.scanTarget = on ? 1 : 0;
  }

  /** Heat level 0..3; while the hunters only search, the edges glow at half strength. */
  setHeat(level: number, searching: boolean): void {
    this.heatLevel = Math.max(0, Math.min(3, Math.round(level)));
    this.heatTarget = this.heatLevel === 0 ? 0 : (this.heatLevel / 3) * (searching ? 0.5 : 1);
    this.reserveHeat();
  }

  private reserveHeat(): void {
    // The pulse is one red peak per cycle; with reduced flashes the colours only drift.
    this.limiter.reserve(this.heatLevel > 0 && !this.reduce ? Math.ceil(heatPulseHz(this.heatLevel)) : 0);
  }

  update(dt: number): void {
    const step = Math.max(0, Math.min(0.1, dt));
    if (!this.reduce) this.time += step;
    this.aberration = Math.max(0, this.aberration - step / 0.35);
    this.glitch = Math.max(0, this.glitch - step / 0.3);
    this.hurtTarget = Math.max(0, this.hurtTarget - step / (this.reduce ? 1.4 : 0.9));
    // A hit snaps the red in; with reduced flashes it fades in over a third of a second.
    this.hurt = this.reduce ? approach(this.hurt, this.hurtTarget, 3, step) : this.hurtTarget > this.hurt ? this.hurtTarget : approach(this.hurt, this.hurtTarget, 1.1, step);
    this.scan = approach(this.scan, this.scanTarget, this.reduce ? 2.5 : 5, step);
    this.heat = approach(this.heat, this.heatTarget, 0.8, step);
    const hz = this.reduce ? 0.12 : heatPulseHz(this.heatLevel);
    this.heatPhase = (this.heatPhase + hz * step) % 1;
  }

  get uniforms(): FxUniforms {
    // One red peak per cycle (phase 0), blue at mid-cycle, a little dimmer.
    const wave = 0.5 + 0.5 * Math.cos(this.heatPhase * Math.PI * 2);
    const heatMix = 1 - wave;
    const pulse = this.reduce ? 1 : 0.7 + 0.3 * wave;
    return {
      aberration: this.reduce ? 0 : this.aberration,
      glitch: this.reduce ? 0 : this.glitch,
      scan: this.scan,
      heat: this.heat * pulse,
      heatMix,
      hurt: this.hurt,
      time: this.time,
      reduce: this.reduce ? 1 : 0,
    };
  }

  /** Anything on screen: the post-process can stay detached otherwise. */
  get active(): boolean {
    return this.aberration > 0.001 || this.glitch > 0.001 || this.scan > 0.001 || this.hurt > 0.001 || this.heat > 0.001 || this.heatTarget > 0 || this.scanTarget > 0;
  }
}
