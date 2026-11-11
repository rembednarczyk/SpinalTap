/**
 * Which character model files to let go of (ADR-0076 §4, stage 4b), behind `CharacterModels`.
 *
 * A file goes once no character in the scene wears it or waits for it: after `MODEL_LINGER_S`
 * seconds of frames (the scene moved on: another district, another act; a step back over the
 * streaming edge does not fetch it again), at once when a new scene replaces the old one (a new
 * game, a loaded save), and at once, longest unused first, while more files than the quality's
 * limit are in memory. The kept files never go: Seki's and the donors' (`donorFiles`), since a
 * donor let go of would change the cloth the background looks borrow (G-560, "Determinism").
 */

/** Seconds a file nobody wears stays in memory under the limit. */
export const MODEL_LINGER_S = 30;

export interface ModelFilesNow {
  /** Character model files in memory, the kept ones too (they count towards the limit). */
  readonly loaded: readonly string[];
  /** Files a character in the scene wears or waits for. */
  readonly used: ReadonlySet<string>;
  /** Files that never go. */
  readonly kept: ReadonlySet<string>;
}

export class ModelMemory {
  /** Seconds each unused file has gone unworn. */
  private readonly idle = new Map<string, number>();

  constructor(
    private readonly limit: number,
    private readonly linger = MODEL_LINGER_S,
  ) {}

  /**
   * Advances the unused files' clocks by `dt` and names the files to let go of now; `all` lets go
   * of every unused one (a new scene).
   */
  sweep(dt: number, files: ModelFilesNow, all = false): string[] {
    const unused: [string, number][] = [];
    for (const url of [...this.idle.keys()]) if (!files.loaded.includes(url)) this.idle.delete(url);
    for (const url of files.loaded) {
      if (files.used.has(url) || files.kept.has(url)) {
        this.idle.delete(url);
        continue;
      }
      const t = (this.idle.get(url) ?? 0) + dt;
      this.idle.set(url, t);
      unused.push([url, t]);
    }
    // Longest unused first; by name between equals, so the order does not hang on the load order.
    unused.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    let over = files.loaded.length - this.limit;
    const out: string[] = [];
    for (const [url, t] of unused) {
      if (!all && over <= 0 && t < this.linger) continue;
      out.push(url);
      this.idle.delete(url);
      over--;
    }
    return out;
  }
}
