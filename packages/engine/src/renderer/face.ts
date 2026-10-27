import type { AbstractMesh, MorphTarget } from "../babylon";
import { FACE_SHAPES, type FaceShape, type VrmExpressions } from "./vrm-meta";

/** Seconds between blinks: a relaxed adult blinks every two to six seconds. */
const BLINK_GAP: readonly [number, number] = [2, 6];
/** Closing, closed and opening times of one blink. */
const BLINK_CLOSE = 0.06;
const BLINK_HOLD = 0.04;
const BLINK_OPEN = 0.09;
/** Mouth shapes while talking: a new vowel this often, eased towards in this time. */
const SYLLABLE = 0.11;
const MOUTH_EASE = 0.06;
const TALK_VOWELS: readonly FaceShape[] = ["a", "i", "u", "e", "o", "a", "o"];

interface Bound {
  readonly target: MorphTarget;
  readonly weight: number;
}

/**
 * Blinks and moves the mouth of an imported model through its VRM expressions (morph targets).
 * Every driven target keeps a tiny non-zero influence, so Babylon never changes the count of
 * active targets, which would recompile the shader on each blink.
 */
export class FaceRig {
  private readonly weights = new Map<FaceShape, number>();
  private blinkIn: number;
  private blinkT = -1;
  private talkLeft = 0;
  private syllable = 0;
  private vowel: FaceShape = "a";
  private openness = 0;

  private constructor(
    private readonly binds: ReadonlyMap<FaceShape, readonly Bound[]>,
    private readonly random: () => number,
  ) {
    this.blinkIn = this.gap();
    this.apply();
  }

  /** Binds the expressions to the instance's meshes (named `${prefix}${node}` or `..._primitiveN`); null without any. */
  static create(meshes: readonly AbstractMesh[], expressions: VrmExpressions | null, prefix: string, random: () => number = Math.random): FaceRig | null {
    if (!expressions) return null;
    const binds = new Map<FaceShape, Bound[]>();
    for (const shape of FACE_SHAPES) {
      for (const b of expressions[shape] ?? []) {
        const name = `${prefix}${b.node}`;
        for (const m of meshes) {
          if (m.name !== name && !m.name.startsWith(`${name}_primitive`)) continue;
          const manager = m.morphTargetManager;
          const target = manager?.getTarget(b.index);
          if (!manager || !target) continue;
          manager.optimizeInfluencers = false;
          const list = binds.get(shape) ?? [];
          list.push({ target, weight: b.weight });
          binds.set(shape, list);
        }
      }
    }
    return binds.size > 0 ? new FaceRig(binds, random) : null;
  }

  has(shape: FaceShape): boolean {
    return this.binds.has(shape);
  }

  /** Moves the mouth for about `seconds` (a line of dialogue); 0 closes it. */
  talk(seconds: number): void {
    this.talkLeft = Math.max(0, seconds);
  }

  update(dt: number): void {
    // Blink.
    let blink = 0;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      const t = this.blinkT;
      blink = t < BLINK_CLOSE ? t / BLINK_CLOSE : t < BLINK_CLOSE + BLINK_HOLD ? 1 : Math.max(0, 1 - (t - BLINK_CLOSE - BLINK_HOLD) / BLINK_OPEN);
      if (t > BLINK_CLOSE + BLINK_HOLD + BLINK_OPEN) {
        this.blinkT = -1;
        this.blinkIn = this.gap();
      }
    } else if ((this.blinkIn -= dt) <= 0) {
      this.blinkT = 0;
    }
    this.weights.set("blink", blink);

    // Mouth: a new vowel each syllable while talking, eased; closes when the line ends.
    const talking = this.talkLeft > 0;
    this.talkLeft = Math.max(0, this.talkLeft - dt);
    if (talking && (this.syllable -= dt) <= 0) {
      this.syllable = SYLLABLE * (0.7 + this.random() * 0.6);
      this.vowel = TALK_VOWELS[Math.floor(this.random() * TALK_VOWELS.length)] ?? "a";
    }
    const goal = talking ? 0.45 + this.random() * 0.4 : 0;
    this.openness += (goal - this.openness) * Math.min(1, dt / MOUTH_EASE);
    for (const v of ["a", "i", "u", "e", "o"] as const) {
      const prev = this.weights.get(v) ?? 0;
      const want = v === this.vowel ? this.openness : 0;
      this.weights.set(v, prev + (want - prev) * Math.min(1, dt / MOUTH_EASE));
    }
    this.apply();
  }

  /** Current weight of a shape (for tests and debugging). */
  weight(shape: FaceShape): number {
    return this.weights.get(shape) ?? 0;
  }

  private gap(): number {
    return BLINK_GAP[0] + this.random() * (BLINK_GAP[1] - BLINK_GAP[0]);
  }

  private apply(): void {
    const totals = new Map<MorphTarget, number>();
    for (const [shape, list] of this.binds) {
      const w = this.weights.get(shape) ?? 0;
      for (const b of list) totals.set(b.target, (totals.get(b.target) ?? 0) + w * b.weight);
    }
    // Never exactly zero: see the class comment.
    for (const [target, w] of totals) target.influence = Math.max(1e-4, Math.min(1, w));
  }
}
