import { type Graph, buildGraph, defaultContext } from "./audio-graph";
import type { MixState } from "./mixer";

/**
 * The WebAudio context and its graph (ADR-0009). Created once, on the first user gesture;
 * when the context is unavailable or throws, the host stays closed for good and every
 * caller falls back to a silent no-op.
 */
export class AudioContextHost {
  private g: Graph | null = null;
  private failed = false;

  constructor(private readonly createContext: () => AudioContext | null = defaultContext) {}

  /** The graph, null before the first successful `open()`. */
  get graph(): Graph | null {
    return this.g;
  }

  /** Builds the graph on the first call. True only when it was built just now. Never throws. */
  open(mix: MixState): boolean {
    if (this.failed || this.g) return false;
    try {
      // Unbound, as before the split: the factory gets no `this`.
      const create = this.createContext;
      const ctx = create();
      if (!ctx) {
        this.failed = true;
        return false;
      }
      this.g = buildGraph(ctx, mix);
    } catch {
      this.failed = true;
      this.g = null;
      return false;
    }
    return true;
  }

  /** Resumes a suspended context (autoplay policy). Never throws. */
  resume(): void {
    const ctx = this.g?.ctx;
    if (!ctx || ctx.state !== "suspended") return;
    try {
      void ctx.resume().catch(() => undefined);
    } catch {
      // Some browsers throw synchronously outside a gesture; the next gesture retries.
    }
  }
}
