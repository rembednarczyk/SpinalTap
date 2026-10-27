/** Priorities for the shared voice budget: higher wins when the pool is full. */
export const PRIORITY = {
  ambience: 0,
  footstep: 1,
  music: 2,
  sfx: 3,
  ui: 4,
} as const;

interface Slot<T> {
  readonly payload: T;
  readonly priority: number;
  readonly start: number;
  readonly end: number;
}

export type Claim<T> = { readonly ok: false } | { readonly ok: true; readonly evicted: T | null };

/**
 * Fixed budget of simultaneous voices. Voices expire by time (no callbacks needed); when the
 * pool is full the oldest voice of the lowest priority is stolen, but only by a voice of at
 * least the same priority, so rain drops never cut a gunshot.
 */
export class VoicePool<T> {
  private readonly slots: Slot<T>[] = [];

  constructor(readonly capacity: number) {}

  get size(): number {
    return this.slots.length;
  }

  /** Drops voices that finished before `now`. */
  prune(now: number): void {
    for (let i = this.slots.length - 1; i >= 0; i--) if (this.slots[i]!.end <= now) this.slots.splice(i, 1);
  }

  /** Whether `claim` with this priority would succeed now (cheap pre-check before building nodes). */
  canClaim(priority: number, now: number): boolean {
    this.prune(now);
    if (this.slots.length < this.capacity) return true;
    let lowest = Infinity;
    for (const s of this.slots) lowest = Math.min(lowest, s.priority);
    return lowest <= priority;
  }

  claim(payload: T, priority: number, now: number, end: number): Claim<T> {
    this.prune(now);
    if (this.slots.length < this.capacity) {
      this.slots.push({ payload, priority, start: now, end });
      return { ok: true, evicted: null };
    }
    let victim = -1;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i]!;
      const v = victim < 0 ? null : this.slots[victim]!;
      if (!v || s.priority < v.priority || (s.priority === v.priority && s.start < v.start)) victim = i;
    }
    const v = this.slots[victim]!;
    if (v.priority > priority) return { ok: false };
    this.slots.splice(victim, 1);
    this.slots.push({ payload, priority, start: now, end });
    return { ok: true, evicted: v.payload };
  }

  /** Removes and returns every voice, e.g. for stopAll. */
  drain(): T[] {
    const all = this.slots.map((s) => s.payload);
    this.slots.length = 0;
    return all;
  }
}
