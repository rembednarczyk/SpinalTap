import type { AudioCue } from "@seki/core";

/**
 * Recorded variants of one sound. A variant is picked at random (never the same one twice in a
 * row when there is a choice) and played at a slightly random pitch, so repeated steps and
 * shots do not sound machine-gunned.
 */
export interface SampleSet {
  /** Absolute or page-relative URLs; the app resolves them, the engine never builds paths. */
  readonly urls: readonly string[];
  /** Linear gain of the recording (default 1). */
  readonly gain?: number;
  /** Random pitch spread: playback rate is 1 ± pitch (default 0.04). */
  readonly pitch?: number;
  /** Alley reverb send 0..1; defaults to the synth recipe's send. */
  readonly send?: number;
  /** Also play the synth recipe underneath (e.g. the bright tick of a critical hit). */
  readonly layerSynth?: boolean;
}

export interface RainLoop {
  readonly url: string;
  readonly gain?: number;
  /** Level of the synthesized rain kept underneath the recording, 0..1 (default 0.3). */
  readonly synthLevel?: number;
}

/** Sound manifest handed over by the application (ADR-0013, addendum). */
export interface AudioSampleManifest {
  readonly cues?: Partial<Readonly<Record<AudioCue, SampleSet>>>;
  readonly footsteps?: SampleSet;
  readonly rain?: RainLoop;
}

/** Every URL a manifest references, without duplicates. */
export const manifestUrls = (m: AudioSampleManifest): string[] => {
  const out = new Set<string>();
  for (const set of Object.values(m.cues ?? {})) for (const u of set?.urls ?? []) out.add(u);
  for (const u of m.footsteps?.urls ?? []) out.add(u);
  if (m.rain) out.add(m.rain.url);
  return [...out];
};

/** Index of the variant to play; avoids repeating `last` when there is more than one. */
export const pickVariant = (count: number, rnd: () => number, last = -1): number => {
  if (count <= 1) return 0;
  if (last < 0 || last >= count) return Math.min(count - 1, Math.floor(rnd() * count));
  // Draw among the others and skip over the last one.
  const i = Math.min(count - 2, Math.floor(rnd() * (count - 1)));
  return i >= last ? i + 1 : i;
};

/** Playback rate 1 ± spread, clamped to a sane range. */
export const pitchRate = (spread: number, rnd: () => number): number => {
  const s = Math.min(0.5, Math.max(0, spread));
  return 1 + (rnd() * 2 - 1) * s;
};

export type FetchBytes = (url: string) => Promise<ArrayBuffer>;

const defaultFetch: FetchBytes = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`audio ${res.status}: ${url}`);
  return res.arrayBuffer();
};

type Entry = { state: "pending" } | { state: "ready"; buffer: AudioBuffer } | { state: "failed" };

/** decodeAudioData with both the promise form and the old callback-only form (Safari < 14.1). */
const decode = (ctx: BaseAudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> =>
  new Promise<AudioBuffer>((resolve, reject) => {
    const p: Promise<AudioBuffer> | undefined = ctx.decodeAudioData(bytes, resolve, reject);
    if (p && typeof p.then === "function") p.then(resolve, reject);
  });

/**
 * Lazily fetched and decoded recordings, cached by URL. A URL is fetched at most once, even when
 * requested many times; a missing file or a codec the browser cannot decode marks it failed,
 * and callers fall back to synthesis. Never throws.
 */
export class SampleBank {
  private readonly entries = new Map<string, Entry>();
  private readonly inflight = new Set<Promise<void>>();

  constructor(private readonly fetchBytes: FetchBytes = defaultFetch) {}

  /** Starts loading every URL not yet requested. */
  load(ctx: BaseAudioContext, urls: readonly string[]): void {
    for (const url of urls) {
      if (this.entries.has(url)) continue;
      this.entries.set(url, { state: "pending" });
      const job = (async () => {
        try {
          const buffer = await decode(ctx, await this.fetchBytes(url));
          this.entries.set(url, { state: "ready", buffer });
        } catch {
          this.entries.set(url, { state: "failed" });
        }
      })();
      this.inflight.add(job);
      void job.finally(() => this.inflight.delete(job));
    }
  }

  /** Decoded buffer, or null while pending, after a failure or when never requested. */
  get(url: string): AudioBuffer | null {
    const e = this.entries.get(url);
    return e?.state === "ready" ? e.buffer : null;
  }

  status(url: string): Entry["state"] | undefined {
    return this.entries.get(url)?.state;
  }

  /** Resolves when nothing is loading (tests, debug). */
  async settled(): Promise<void> {
    while (this.inflight.size > 0) await Promise.all([...this.inflight]);
  }
}

/**
 * Chooses a ready recording for a sample set: the picked variant, or any other ready one while
 * the rest are still loading. Null means "use the synth".
 */
export class VariantPicker {
  private readonly last = new Map<SampleSet, number>();

  constructor(
    private readonly bank: SampleBank,
    private readonly rnd: () => number,
  ) {}

  pick(set: SampleSet | undefined): { readonly buffer: AudioBuffer; readonly rate: number; readonly index: number } | null {
    if (!set || set.urls.length === 0) return null;
    const ready: number[] = [];
    for (let i = 0; i < set.urls.length; i++) if (this.bank.get(set.urls[i]!)) ready.push(i);
    if (ready.length === 0) return null;
    const lastIndex = this.last.get(set) ?? -1;
    const k = pickVariant(ready.length, this.rnd, ready.indexOf(lastIndex));
    const index = ready[k]!;
    this.last.set(set, index);
    return { buffer: this.bank.get(set.urls[index]!)!, rate: pitchRate(set.pitch ?? 0.04, this.rnd), index };
  }
}
