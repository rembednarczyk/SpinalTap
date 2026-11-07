import { type Graph, applyBus } from "./audio-graph";
import { SpeechDucker } from "./ducking";
import type { MixState } from "./mixer";
import type { SampleBank } from "./samples";

/** Where the recording of a voiced line lives; the app resolves it, the engine never builds paths. */
export type VoiceUrl = (key: string) => string;

/** What is spoken now, read-only (debug overlay, tests). */
export interface SpeechState {
  /** Key of the voiced line speaking now, null when silent. */
  readonly line: string | null;
  /** Linear factor of the duck under speech on music and radio, 1 at rest. */
  readonly duck: number;
}

/**
 * Spoken lines on the dialogue bus (ADR-0060 stage 1): one line at a time, fetched and decoded
 * by key on first use and cached. A key without a recording (missing file, undecodable bytes,
 * no `VoiceUrl`) plays nothing and never throws, so the subtitle stays on its own. While a line
 * plays, its ducker holds the music and radio buses of `mix` down.
 */
export class DialogueLines implements SpeechState {
  private readonly ducker = new SpeechDucker();
  private source: AudioBufferSourceNode | null = null;
  /** Bumped by every play and stop, so a line that finishes loading after either stays silent. */
  private token = 0;
  private lastKey: string | null = null;

  constructor(
    private readonly bank: SampleBank,
    private readonly url: VoiceUrl | undefined,
    private readonly mix: MixState,
  ) {}

  get line(): string | null {
    return this.source ? this.lastKey : null;
  }

  get duck(): number {
    return this.ducker.factor;
  }

  /** Moves the speech duck to `now` and eases music and radio to it when it changed. */
  applyDuck(g: Graph, now: number): void {
    const factor = this.ducker.update(now);
    if (factor === this.mix.speechDuck) return;
    this.mix.setSpeechDuck(factor);
    applyBus(g, this.mix, "music", now);
    applyBus(g, this.mix, "radio", now);
  }

  /** Resolves true when the line started, false when it has no recording or was superseded. */
  async play(g: Graph, key: string): Promise<boolean> {
    const token = ++this.token;
    this.cut(g.ctx.currentTime);
    if (!this.url) return false;
    let buffer: AudioBuffer | null;
    try {
      buffer = await this.bank.request(g.ctx, this.url(key));
    } catch {
      buffer = null;
    }
    if (!buffer || token !== this.token) return false;
    const now = g.ctx.currentTime;
    const src = g.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(g.buses.dialogue);
    src.onended = () => {
      if (this.source !== src) return;
      this.source = null;
      this.lastKey = null;
    };
    src.start(now);
    this.source = src;
    this.lastKey = key;
    this.ducker.speak(now, now + buffer.duration);
    return true;
  }

  /** Cuts the line speaking now and any line still loading; music and radio rise back. */
  stop(now: number): void {
    this.token++;
    this.cut(now);
  }

  private cut(now: number): void {
    const src = this.source;
    this.source = null;
    this.lastKey = null;
    if (src) {
      try {
        src.stop(now);
      } catch {
        // Already stopped.
      }
      src.disconnect();
    }
    this.ducker.stop(now);
  }
}
