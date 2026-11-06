import { type InputFrame, degToRad } from "@seki/core";

/** How strongly the aim assist helps touch and pad look (ADR-0072); never the mouse. */
export type AimAssistLevel = "off" | "light" | "standard";

/**
 * An enemy the assist may slow over or snap to, seen along the aim axis (the ray the camera sits
 * on and the shots start from). The engine's own type: the app works it out from the
 * simulation's targets of the last step, so the engine never reads `sim`.
 */
export interface AimTarget {
  /** The turn that puts the crosshair on its chest, radians, as `lookYaw` adds it. */
  readonly yaw: number;
  /** The same for the pitch (positive looks down, as `lookPitch`). */
  readonly pitch: number;
  /** The angle between the aim axis and its chest, radians. */
  readonly angle: number;
  /** Half the angular width of its silhouette, radians. */
  readonly radius: number;
  /** From the aim origin to its chest, metres. */
  readonly distance: number;
}

/** The slowdown zone: the silhouette's angular radius times this. */
export const AIM_ZONE_SCALE = 1.5;
/** The look multiplier at the centre of a target, per level; it rises to 1 at the zone's edge. */
export const AIM_SLOWDOWN: Readonly<Record<AimAssistLevel, number>> = { off: 1, light: 0.75, standard: 0.55 };
/** A target pulls the aim on entering the sights when its silhouette reaches this close to the axis. */
export const SNAP_CONE = degToRad(6);
/** The pull covers this share of the angle to the chest, and never more than `SNAP_MAX`. */
export const SNAP_SHARE = 0.6;
export const SNAP_MAX = degToRad(4);
/** The pull is spread over this long, seconds. */
export const SNAP_TIME = 0.15;

/** A turn of the view, radians. */
export interface LookTurn {
  readonly yaw: number;
  readonly pitch: number;
}

/**
 * The look multiplier over the targets: from `AIM_SLOWDOWN[level]` with the axis on a chest to
 * 1 at the edge of the zone (1.5 × the silhouette's radius) and beyond. The strongest one counts.
 */
export const slowdownFactor = (targets: readonly AimTarget[], level: AimAssistLevel): number => {
  const least = AIM_SLOWDOWN[level];
  let factor = 1;
  for (const t of targets) {
    const zone = t.radius * AIM_ZONE_SCALE;
    if (zone <= 0 || t.angle >= zone) continue;
    factor = Math.min(factor, least + (1 - least) * (t.angle / zone));
  }
  return factor;
};

/**
 * The pull on entering the sights: towards the chest nearest the axis among the targets whose
 * silhouette reaches into `SNAP_CONE`, by `SNAP_SHARE` of the angle and at most `SNAP_MAX`.
 * Null when none does.
 */
export const snapTurn = (targets: readonly AimTarget[]): LookTurn | null => {
  let best: AimTarget | null = null;
  for (const t of targets) {
    if (t.angle - t.radius > SNAP_CONE || t.angle <= 1e-9) continue;
    if (!best || t.angle < best.angle) best = t;
  }
  if (!best) return null;
  const share = Math.min(SNAP_SHARE, SNAP_MAX / best.angle);
  return { yaw: best.yaw * share, pitch: best.pitch * share };
};

/** The frame with its look turned by `k`. */
export const scaleFrameLook = (frame: InputFrame, k: number): InputFrame =>
  k === 1 || (frame.lookYaw === 0 && frame.lookPitch === 0) ? frame : { ...frame, lookYaw: frame.lookYaw * k, lookPitch: frame.lookPitch * k };

/**
 * The aim assist of the input adapter (ADR-0072): a slowdown over a target for touch (and, from
 * stage 4, pad) look, and a short pull towards it when such a control raises the sights. It
 * changes only the look of the frames, so the simulation and replays of recorded frames stay as
 * they are. The app hands it the targets of the last step and the weapon before each poll.
 */
export class AimAssist {
  level: AimAssistLevel = "standard";
  /** The weapon in hand aims down sights; without one nothing is assisted. Set every step. */
  adsWeapon = false;
  /** The targets of the last step, along the aim axis. */
  targets: readonly AimTarget[] = [];
  private aimed = false;
  /** The rest of the pull and its time, while it lasts. */
  private pull: { yaw: number; pitch: number; left: number } | null = null;

  /** Whether the assist works now. */
  get on(): boolean {
    return this.level !== "off" && this.adsWeapon;
  }

  /** Whether a pull is under way (tests, debugging). */
  get pulling(): boolean {
    return this.pull !== null;
  }

  /** Slows the look of an assisted device's frame (touch, pad) over a target; the mouse never comes here. */
  slow(frame: InputFrame): InputFrame {
    return this.on ? scaleFrameLook(frame, slowdownFactor(this.targets, this.level)) : frame;
  }

  /**
   * The adapter, every poll: the frame's aim after the latches and the touch fire button, and
   * whether an assisted control (touch, pad) asked for it. Its rise from such a control starts
   * the pull; a rise from the mouse or the keyboard does not.
   */
  observe(aim: boolean, assisted: boolean): void {
    const rise = aim && !this.aimed;
    this.aimed = aim;
    if (!aim) this.pull = null;
    if (!rise || !assisted || !this.on) return;
    const turn = snapTurn(this.targets);
    this.pull = turn ? { ...turn, left: SNAP_TIME } : null;
  }

  /**
   * After the app's own scaling (zoom, ADS sensitivity, inverted Y), so the pull is in the
   * simulation's radians: adds this step's share of it. A turn against it, the sights let go or
   * the assist off end it. No tracking: the pull aims where the target was on the rise.
   */
  apply(frame: InputFrame, dt: number): InputFrame {
    const p = this.pull;
    if (!p) return frame;
    if (!frame.aim || !this.on || frame.lookYaw * p.yaw + frame.lookPitch * p.pitch < 0) {
      this.pull = null;
      return frame;
    }
    const k = Math.min(1, dt / p.left);
    const yaw = p.yaw * k;
    const pitch = p.pitch * k;
    p.yaw -= yaw;
    p.pitch -= pitch;
    p.left -= dt;
    if (p.left <= 1e-6) this.pull = null;
    return { ...frame, lookYaw: frame.lookYaw + yaw, lookPitch: frame.lookPitch + pitch };
  }

  /** Menus and dialogue: no pull carries over, the next aim is a new rise. */
  reset(): void {
    this.aimed = false;
    this.pull = null;
  }
}
