/** A point or a direction in the world (metres). */
export interface Point {
  x: number;
  y: number;
  z: number;
}

/** Size of a muzzle flash (metres): the flame's length along the barrel and its width across. */
export interface FlashSize {
  readonly length: number;
  readonly width: number;
  /** Smoke puffs a shot leaves at the muzzle. */
  readonly puffs: number;
}

/** A flame stays this long (seconds): 3 frames at 60 fps; it shows for one frame at least. */
export const FLASH_LIFE = 0.05;
/** Flames at once: more shots in the same moment take the oldest one's place. */
export const FLASH_POOL = 8;
/** Smoke puffs at once, for every gun together: a long burst takes the oldest puffs' places. */
export const SMOKE_POOL = 32;
/** Reduced flashes (ADR-0028): the flame this much smaller. */
export const REDUCED_FLASH = 0.6;
/** Opacity of a fresh puff. */
const PUFF_ALPHA = 0.36;
/** The puff fades in over this long (seconds), so it does not pop in front of the flame. */
const PUFF_FADE_IN = 0.06;

interface Flash {
  live: boolean;
  shooter: number;
  readonly at: Point;
  readonly dir: Point;
  size: FlashSize;
  age: number;
  /** Frames shown so far; the first one emits the smoke. */
  frames: number;
  roll: number;
  stretch: number;
}

interface Puff {
  live: boolean;
  readonly at: Point;
  readonly vel: Point;
  age: number;
  life: number;
  size: number;
  grow: number;
  roll: number;
}

const point = (): Point => ({ x: 0, y: 0, z: 0 });
const copy = (to: Point, from: Point): void => {
  to.x = from.x;
  to.y = from.y;
  to.z = from.z;
};
/** Repeatable jitter in 0..1 from a counter: the same burst looks the same, no global random. */
const jitter = (n: number): number => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const GOLDEN_ANGLE = 2.399963;

/** Writes a 4x4 matrix (Babylon's row-vector layout) with axes `x`, `y`, `z` scaled and placed at `at`. */
const writeMatrix = (out: Float32Array, i: number, x: Point, y: Point, z: Point, at: Point): void => {
  const o = i * 16;
  out[o] = x.x;
  out[o + 1] = x.y;
  out[o + 2] = x.z;
  out[o + 3] = 0;
  out[o + 4] = y.x;
  out[o + 5] = y.y;
  out[o + 6] = y.z;
  out[o + 7] = 0;
  out[o + 8] = z.x;
  out[o + 9] = z.y;
  out[o + 10] = z.z;
  out[o + 11] = 0;
  out[o + 12] = at.x;
  out[o + 13] = at.y;
  out[o + 14] = at.z;
  out[o + 15] = 1;
};

/**
 * Muzzle flashes and their smoke (no Babylon here, so tests run it frame by frame): fixed pools
 * of flames and puffs, nothing made per shot. A flame follows its shooter's muzzle for its few
 * frames, along the barrel; its smoke is left in the air where the first frame showed it, drifts
 * on along the barrel, slows, rises and spreads, and fades in half a second to a second.
 */
export class MuzzleState {
  readonly flashes: readonly Flash[] = Array.from({ length: FLASH_POOL }, () => ({
    live: false,
    shooter: 0,
    at: point(),
    dir: { x: 0, y: 0, z: 1 },
    size: { length: 0, width: 0, puffs: 0 },
    age: 0,
    frames: 0,
    roll: 0,
    stretch: 1,
  }));
  readonly puffs: readonly Puff[] = Array.from({ length: SMOKE_POOL }, () => ({ live: false, at: point(), vel: point(), age: 0, life: 1, size: 0, grow: 0, roll: 0 }));
  /** Reduced flashes: a smaller flame (and the renderer's darker colours, no light). */
  reduced = false;
  private shots = 0;
  private puffCursor = 0;
  private readonly ax = point();
  private readonly ay = point();
  private readonly az = point();

  /** A shot: a flame at `at` along `dir` (unit), sized for the gun, its smoke on the first frame. */
  fire(shooter: number, at: Point, dir: Point, size: FlashSize): void {
    let f = this.flashes.find((x) => !x.live);
    if (!f) f = this.flashes.reduce((a, b) => (b.frames > a.frames ? b : a));
    this.shots++;
    f.live = true;
    f.shooter = shooter;
    copy(f.at, at);
    copy(f.dir, dir);
    f.size = size;
    f.age = 0;
    f.frames = 0;
    f.roll = this.shots * GOLDEN_ANGLE;
    f.stretch = 0.85 + 0.3 * jitter(this.shots);
  }

  /**
   * One frame: `place` moves each flame to its shooter's muzzle as it is now (or leaves it), the
   * flames age, the smoke drifts. A flame shows on the frame after its shot whatever the frame
   * time, then lives `FLASH_LIFE`.
   */
  update(dt: number, place: (shooter: number, at: Point, dir: Point) => void): void {
    for (const f of this.flashes) {
      if (!f.live) continue;
      if (f.frames > 0) {
        f.age += dt;
        if (f.age >= FLASH_LIFE) {
          f.live = false;
          continue;
        }
      }
      place(f.shooter, f.at, f.dir);
      if (f.frames === 0) this.emitSmoke(f);
      f.frames++;
    }
    const drag = Math.exp(-2.6 * dt);
    for (const p of this.puffs) {
      if (!p.live) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.live = false;
        continue;
      }
      p.vel.x *= drag;
      p.vel.z *= drag;
      // Warm smoke rises, slower than it left the barrel.
      p.vel.y = p.vel.y * drag + 0.32 * dt;
      p.at.x += p.vel.x * dt;
      p.at.y += p.vel.y * dt;
      p.at.z += p.vel.z * dt;
    }
  }

  get liveFlashes(): number {
    return this.flashes.reduce((n, f) => n + (f.live ? 1 : 0), 0);
  }

  get livePuffs(): number {
    return this.puffs.reduce((n, p) => n + (p.live ? 1 : 0), 0);
  }

  /** Length and width of a flame on screen now (metres): shrinking over its life, smaller when reduced. */
  flameSize(f: Flash): { length: number; width: number } {
    const t = Math.min(1, f.age / FLASH_LIFE);
    const k = this.reduced ? REDUCED_FLASH : 1;
    return { length: f.size.length * f.stretch * (1 - 0.4 * t) * k, width: f.size.width * (1 - 0.25 * t) * k };
  }

  /** The shown flames' matrices (local +Z along the barrel, X and Y across), 16 floats each; returns how many. */
  writeFlashes(out: Float32Array): number {
    let n = 0;
    const { ax: x, ay: y, az: z } = this;
    for (const f of this.flashes) {
      if (!f.live || f.frames === 0 || n * 16 >= out.length) continue;
      const { length, width } = this.flameSize(f);
      across(f.dir, f.roll, x, y);
      scale(x, width);
      scale(y, width);
      z.x = f.dir.x * length;
      z.y = f.dir.y * length;
      z.z = f.dir.z * length;
      writeMatrix(out, n++, x, y, z, f.at);
    }
    return n;
  }

  /**
   * The live puffs as billboards facing the camera (`right`, `up`, `forward`: its axes) with their
   * colour (`tint`) and opacity, 16 and 4 floats each; returns how many.
   */
  writePuffs(matrices: Float32Array, colors: Float32Array, view: { right: Point; up: Point; forward: Point }, tint: readonly [number, number, number]): number {
    let n = 0;
    const { ax: x, ay: y, az: z } = this;
    for (const p of this.puffs) {
      if (!p.live || n * 16 >= matrices.length) continue;
      const t = p.age / p.life;
      const s = p.size + p.grow * Math.sqrt(t);
      const c = Math.cos(p.roll + t);
      const sn = Math.sin(p.roll + t);
      x.x = (view.right.x * c + view.up.x * sn) * s;
      x.y = (view.right.y * c + view.up.y * sn) * s;
      x.z = (view.right.z * c + view.up.z * sn) * s;
      y.x = (view.up.x * c - view.right.x * sn) * s;
      y.y = (view.up.y * c - view.right.y * sn) * s;
      y.z = (view.up.z * c - view.right.z * sn) * s;
      copy(z, view.forward);
      scale(z, s);
      writeMatrix(matrices, n, x, y, z, p.at);
      const o = n * 4;
      colors[o] = tint[0];
      colors[o + 1] = tint[1];
      colors[o + 2] = tint[2];
      colors[o + 3] = puffAlpha(p.age, p.life);
      n++;
    }
    return n;
  }

  /** Puffs at the muzzle, a little out along the barrel, blown on along it and spreading. */
  private emitSmoke(f: Flash): void {
    const { ax: x, ay: y } = this;
    across(f.dir, f.roll, x, y);
    for (let i = 0; i < f.size.puffs; i++) {
      const p = this.puffs[this.puffCursor % SMOKE_POOL] as Puff;
      this.puffCursor++;
      const seed = this.puffCursor * 3.1;
      const out = f.size.length * (0.3 + 0.6 * jitter(seed));
      const speed = 0.35 + 0.5 * jitter(seed + 1);
      const sx = (jitter(seed + 2) - 0.5) * 0.35;
      const sy = (jitter(seed + 3) - 0.5) * 0.35;
      p.live = true;
      p.at.x = f.at.x + f.dir.x * out;
      p.at.y = f.at.y + f.dir.y * out;
      p.at.z = f.at.z + f.dir.z * out;
      p.vel.x = f.dir.x * speed + x.x * sx + y.x * sy;
      p.vel.y = f.dir.y * speed + x.y * sx + y.y * sy + 0.12;
      p.vel.z = f.dir.z * speed + x.z * sx + y.z * sy;
      p.age = 0;
      p.life = 0.5 + 0.5 * jitter(seed + 4);
      p.size = f.size.width * 0.45;
      p.grow = f.size.width * (1.1 + 0.6 * jitter(seed + 5));
      p.roll = seed;
    }
  }
}

/** A puff's opacity: in over `PUFF_FADE_IN`, then out to nothing at the end of its life. */
export const puffAlpha = (age: number, life: number): number => {
  const t = Math.min(1, age / life);
  return PUFF_ALPHA * Math.min(1, age / PUFF_FADE_IN + 0.25) * (1 - t) ** 1.3;
};

const scale = (p: Point, k: number): void => {
  p.x *= k;
  p.y *= k;
  p.z *= k;
};

/** Two unit axes across a direction, turned `roll` about it. */
const across = (dir: Point, roll: number, x: Point, y: Point): void => {
  // Across the barrel and the world's up, or its X when the barrel points up or down.
  const vertical = Math.abs(dir.y) > 0.99;
  const ux = vertical ? 1 : 0;
  const uy = vertical ? 0 : 1;
  // x = up × dir, y = dir × x.
  let cx = uy * dir.z;
  let cy = -ux * dir.z;
  let cz = ux * dir.y - uy * dir.x;
  const len = Math.hypot(cx, cy, cz) || 1;
  cx /= len;
  cy /= len;
  cz /= len;
  const yx = dir.y * cz - dir.z * cy;
  const yy = dir.z * cx - dir.x * cz;
  const yz = dir.x * cy - dir.y * cx;
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  x.x = cx * c + yx * s;
  x.y = cy * c + yy * s;
  x.z = cz * c + yz * s;
  y.x = yx * c - cx * s;
  y.y = yy * c - cy * s;
  y.z = yz * c - cz * s;
};
