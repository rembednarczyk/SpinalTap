/** Interval timer of the audio scheduler, with injectable `setInterval`/`clearInterval` for tests. */
export class TickTimer {
  private id: unknown = null;

  constructor(
    private readonly set: (fn: () => void, ms: number) => unknown = (fn, ms) => globalThis.setInterval(fn, ms),
    private readonly clear: (id: unknown) => void = (id) => globalThis.clearInterval(id as ReturnType<typeof setInterval>),
  ) {}

  /** Starts calling `fn` every `ms` milliseconds; a running timer is left alone. */
  start(fn: () => void, ms: number): void {
    if (this.id !== null) return;
    this.id = this.set(fn, ms);
  }

  stop(): void {
    if (this.id === null) return;
    this.clear(this.id);
    this.id = null;
  }
}
