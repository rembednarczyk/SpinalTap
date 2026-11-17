import type { Point } from "./muzzle-state";

/**
 * Blasts (ADR-0082 stage 3c: W-3's charges going off) without Babylon, so tests run them frame by
 * frame: a fireball of flat flame-coloured puffs, smoke rising and spreading, debris thrown out and
 * falling, and the flash's light. Every particle is a function of its blast's age and its own
 * seed, so nothing is made per blast and the same blast looks the same. On High a blast is a cloud
 * of particles; without them (`particles` false, low and medium quality) it is one fireball and
 * one smoke puff, no debris.
 */

/** Blasts at once: one more takes the oldest one's place. */
export const MAX_BLASTS = 4;
/** Particles of one blast with them (High) and without (one fireball, one smoke puff). */
export const PER_BLAST = { fire: 7, smoke: 10, debris: 12 } as const;
export const SIMPLE_BLAST = { fire: 1, smoke: 1, debris: 0 } as const;
/** The longest a fireball puff lives (s). */
export const FIRE_LIFE = 0.8;
/** The flash lights the place this long (s). */
export const FLASH_LIFE = 0.4;
/** A blast is over this long after it went off (s): its last smoke is gone. */
export const BLAST_LIFE = 4.4;
/**
 * The longest step of a frame (s): a hitch (a slow frame, the loading of a chunk) does not skip
 * the fireball, it plays at least this many frames.
 */
export const MAX_STEP = 1 / 20;
/** The flash's peak, over a muzzle flash's 1: lit across the blast's radius. */
const FLASH_PEAK = 1.6;
/** Reduced flashes (ADR-0028): the fireball's colours this much darker. */
const REDUCED_FIRE = 0.55;
/** Debris falls this fast (m/s²). */
const GRAVITY = 9.81;

interface Blast {
  readonly at: Point;
  radius: number;
  age: number;
  serial: number;
  /** It lights the place (the flash budget allowed it). */
  lit: boolean;
}

/** Repeatable jitter in 0..1 from a counter: the same blast looks the same, no global random. */
const jitter = (n: number): number => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const GOLDEN_ANGLE = 2.399963;

/** Writes a 4x4 matrix (Babylon's row-vector layout) with axes `x`, `y`, `z` and the origin `at`. */
const put = (out: Float32Array, o: number, v: Point, w: number): void => {
  out[o] = v.x;
  out[o + 1] = v.y;
  out[o + 2] = v.z;
  out[o + 3] = w;
};
const writeMatrix = (out: Float32Array, i: number, x: Point, y: Point, z: Point, at: Point): void => {
  const o = i * 16;
  put(out, o, x, 0);
  put(out, o + 4, y, 0);
  put(out, o + 8, z, 0);
  put(out, o + 12, at, 1);
};

const writeColor = (out: Float32Array, i: number, r: number, g: number, b: number, a: number): void => {
  const o = i * 4;
  out[o] = r;
  out[o + 1] = g;
  out[o + 2] = b;
  out[o + 3] = a;
};

/** The camera's axes in the world, for the billboards. */
export interface BlastView {
  readonly right: Point;
  readonly up: Point;
  readonly forward: Point;
}

export class ExplosionState {
  private readonly blasts: Blast[] = [];
  private serial = 0;
  private readonly x: Point = { x: 0, y: 0, z: 0 };
  private readonly y: Point = { x: 0, y: 0, z: 0 };
  private readonly z: Point = { x: 0, y: 0, z: 0 };
  private readonly p: Point = { x: 0, y: 0, z: 0 };
  /** Reduced flashes: a darker fireball and no light (the renderer asks `flash`). */
  reduced = false;

  /** `particles`: the cloud of High; without, one fireball and one puff a blast. */
  constructor(readonly particles: boolean) {}

  /** Particles of one blast at this quality. */
  get perBlast(): { readonly fire: number; readonly smoke: number; readonly debris: number } {
    return this.particles ? PER_BLAST : SIMPLE_BLAST;
  }

  /** A blast at `at`, `radius` metres round it; `lit`: its flash lights the place. */
  add(at: Point, radius: number, lit = true): void {
    this.serial++;
    let b = this.blasts.length < MAX_BLASTS ? undefined : this.blasts.reduce((a, c) => (c.age > a.age ? c : a));
    if (!b) {
      b = { at: { x: 0, y: 0, z: 0 }, radius: 0, age: 0, serial: 0, lit: false };
      this.blasts.push(b);
    }
    b.at.x = at.x;
    b.at.y = at.y;
    b.at.z = at.z;
    b.radius = Math.max(0.5, radius);
    b.age = 0;
    b.serial = this.serial;
    b.lit = lit;
  }

  /** One frame: the blasts age (at most `MAX_STEP`), the spent ones go. */
  update(dt: number): void {
    const step = Math.max(0, Math.min(MAX_STEP, dt));
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i] as Blast;
      b.age += step;
      if (b.age >= BLAST_LIFE) this.blasts.splice(i, 1);
    }
  }

  /** Blasts still showing something. */
  get live(): number {
    return this.blasts.length;
  }

  /** Forget every blast (a new game, a load). */
  clear(): void {
    this.blasts.length = 0;
  }

  /** The flash of the newest blast still lit: where and how bright (0 none; always none when reduced). */
  flash(): { readonly at: Point; readonly intensity: number } | null {
    if (this.reduced) return null;
    let newest: Blast | null = null;
    for (const b of this.blasts) if (b.lit && b.age < FLASH_LIFE && (!newest || b.age < newest.age)) newest = b;
    if (!newest) return null;
    return { at: { x: newest.at.x, y: newest.at.y + 0.6, z: newest.at.z }, intensity: FLASH_PEAK * (1 - newest.age / FLASH_LIFE) ** 1.5 };
  }

  /** The axes of a billboard of size `s` facing the camera, turned `roll` in its plane. */
  private billboard(view: BlastView, s: number, roll: number): void {
    const c = Math.cos(roll) * s;
    const sn = Math.sin(roll) * s;
    const { right: r, up: u, forward: f } = view;
    this.x.x = r.x * c + u.x * sn;
    this.x.y = r.y * c + u.y * sn;
    this.x.z = r.z * c + u.z * sn;
    this.y.x = u.x * c - r.x * sn;
    this.y.y = u.y * c - r.y * sn;
    this.y.z = u.z * c - r.z * sn;
    this.z.x = f.x * s;
    this.z.y = f.y * s;
    this.z.z = f.z * s;
  }

  /**
   * The fireballs' puffs facing the camera, 16 and 4 floats each: they swell in a few frames, rise
   * and burn from pale yellow through orange to a dark red as they shrink away. Returns how many.
   */
  writeFire(matrices: Float32Array, colors: Float32Array, view: BlastView): number {
    let n = 0;
    const per = this.perBlast.fire;
    const dark = this.reduced ? REDUCED_FIRE : 1;
    for (const b of this.blasts) {
      for (let i = 0; i < per && n * 16 < matrices.length; i++) {
        const seed = b.serial * 31 + i * 7;
        const life = per === 1 ? FIRE_LIFE * 0.85 : FIRE_LIFE * (0.6 + 0.4 * jitter(seed));
        const t = b.age / life;
        if (t >= 1) continue;
        const swell = Math.min(1, b.age / 0.08);
        const size = b.radius * (per === 1 ? 0.3 : 0.14 + 0.1 * jitter(seed + 1)) * swell * (1 - t * t);
        const a = i * GOLDEN_ANGLE + b.serial;
        const out = i === 0 ? 0 : b.radius * 0.16 * (0.5 + 0.5 * jitter(seed + 2)) * Math.min(1, b.age / 0.25);
        this.p.x = b.at.x + Math.cos(a) * out;
        this.p.y = b.at.y + 0.2 + (i === 0 ? 0 : b.radius * 0.1 * jitter(seed + 3)) + 0.9 * b.age;
        this.p.z = b.at.z + Math.sin(a) * out;
        this.billboard(view, size, seed);
        writeMatrix(matrices, n, this.x, this.y, this.z, this.p);
        writeColor(colors, n, dark, (0.95 - 0.65 * t) * dark, Math.max(0, 0.7 - 1.2 * t) * dark, 1);
        n++;
      }
    }
    return n;
  }

  /**
   * The smoke over each blast facing the camera: puffs leave the fireball a little after it, rise,
   * spread and fade over about three seconds, in `tint` (the time of day's grey). Returns how many.
   */
  writeSmoke(matrices: Float32Array, colors: Float32Array, view: BlastView, tint: readonly [number, number, number]): number {
    let n = 0;
    const per = this.perBlast.smoke;
    for (const b of this.blasts) {
      for (let i = 0; i < per && n * 16 < matrices.length; i++) {
        const seed = b.serial * 53 + i * 11;
        const age = b.age - (per === 1 ? 0.12 : 0.1 + 0.25 * jitter(seed));
        const life = 2.8 + 1.2 * jitter(seed + 1);
        if (age <= 0 || age >= life) continue;
        const t = age / life;
        const a = i * GOLDEN_ANGLE + b.serial * 0.7;
        const out = per === 1 ? 0 : b.radius * 0.3 * (0.4 + 0.6 * jitter(seed + 2)) * (1 - Math.exp(-2 * age));
        this.p.x = b.at.x + Math.cos(a) * out;
        this.p.y = b.at.y + 0.5 + (1.2 + 0.6 * jitter(seed + 3)) * age ** 0.8;
        this.p.z = b.at.z + Math.sin(a) * out;
        const size = b.radius * (per === 1 ? 0.2 + 0.3 * Math.sqrt(t) : 0.1 + 0.2 * Math.sqrt(t));
        this.billboard(view, size, seed + t);
        writeMatrix(matrices, n, this.x, this.y, this.z, this.p);
        writeColor(colors, n, tint[0], tint[1], tint[2], 0.82 * Math.min(1, age / 0.2) * (1 - t) ** 1.2);
        n++;
      }
    }
    return n;
  }

  /**
   * The debris (High only): chunks thrown out and up, tumbling and falling, shrinking away before
   * they would reach the floor; a few glow hot and cool to charcoal. 16 and 4 floats each.
   */
  writeDebris(matrices: Float32Array, colors: Float32Array): number {
    let n = 0;
    const per = this.perBlast.debris;
    for (const b of this.blasts) {
      for (let i = 0; i < per && n * 16 < matrices.length; i++) {
        const seed = b.serial * 71 + i * 13;
        const life = 0.8 + 0.4 * jitter(seed);
        const t = b.age / life;
        if (t >= 1) continue;
        const a = i * GOLDEN_ANGLE + b.serial * 1.3;
        const speed = (0.4 + 0.5 * jitter(seed + 1)) * b.radius;
        const up = (0.3 + 0.4 * jitter(seed + 2)) * b.radius;
        const age = b.age;
        this.p.x = b.at.x + Math.cos(a) * speed * age;
        this.p.y = b.at.y + up * age - 0.5 * GRAVITY * age * age;
        this.p.z = b.at.z + Math.sin(a) * speed * age;
        const size = (0.07 + 0.12 * jitter(seed + 3)) * Math.min(1, (1 - t) / 0.3);
        this.tumble(seed, age, size);
        writeMatrix(matrices, n, this.x, this.y, this.z, this.p);
        const hot = jitter(seed + 4) < 0.3 ? Math.max(0, 1 - 1.6 * t) : 0;
        writeColor(colors, n, 0.17 + 0.83 * hot, 0.15 + 0.4 * hot, 0.14 + 0.02 * hot, 1);
        n++;
      }
    }
    return n;
  }

  /** A chunk's axes: turned about the vertical and tipped over as it flies, scaled to `s` (a flat slab). */
  private tumble(seed: number, age: number, s: number): void {
    const yaw = seed + (4 + 6 * jitter(seed + 5)) * age;
    const tip = (5 + 8 * jitter(seed + 6)) * age;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const ct = Math.cos(tip);
    const st = Math.sin(tip);
    // R = Ry(yaw) · Rx(tip), rows as the matrix's axes; the slab is 1 x 0.45 x 0.7 of its size.
    this.x.x = cy * s;
    this.x.y = 0;
    this.x.z = -sy * s;
    this.y.x = sy * st * 0.45 * s;
    this.y.y = ct * 0.45 * s;
    this.y.z = cy * st * 0.45 * s;
    this.z.x = sy * ct * 0.7 * s;
    this.z.y = -st * 0.7 * s;
    this.z.z = cy * ct * 0.7 * s;
  }
}
