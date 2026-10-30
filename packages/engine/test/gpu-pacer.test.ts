import { describe, expect, it } from "vitest";
import { type FenceGl, GpuPacer } from "../src/renderer/gpu-pacer";

/** Fences the test finishes by hand, as the GPU would. */
const fakeGl = () => {
  const fences: { done: boolean; deleted: boolean }[] = [];
  const context = { lost: false, nullStatus: false };
  const gl: FenceGl = {
    SYNC_GPU_COMMANDS_COMPLETE: 1,
    SYNC_STATUS: 2,
    SIGNALED: 3,
    fenceSync: () => {
      const f = { done: false, deleted: false };
      fences.push(f);
      return f as unknown as WebGLSync;
    },
    // A lost context answers null for every fence (WebGL spec).
    getSyncParameter: (sync) => (context.nullStatus ? null : (sync as unknown as { done: boolean }).done ? 3 : 4),
    deleteSync: (sync) => {
      (sync as unknown as { deleted: boolean }).deleted = true;
    },
    isContextLost: () => context.lost,
  };
  return { gl, fences, context };
};

describe("GPU pacer (G-029)", () => {
  it("draws on while the GPU keeps up", () => {
    const { gl, fences } = fakeGl();
    const pacer = new GpuPacer(gl);
    for (let i = 0; i < 10; i++) {
      expect(pacer.canDraw).toBe(true);
      pacer.drawn();
      // A fast GPU: the frame is done before the next one, or a frame late as Chrome may report it.
      if (i > 0) fences[i - 1]!.done = true;
    }
    expect(fences.slice(0, -2).every((f) => f.deleted)).toBe(true);
  });

  it("holds the next frame while two drawn frames are unfinished, and resumes as one finishes", () => {
    const { gl, fences } = fakeGl();
    const pacer = new GpuPacer(gl);
    pacer.drawn();
    pacer.drawn();
    expect(pacer.canDraw).toBe(false);
    expect(pacer.canDraw).toBe(false);
    fences[0]!.done = true;
    expect(pacer.canDraw).toBe(true);
    expect(fences[0]!.deleted).toBe(true);
    expect(fences[1]!.deleted).toBe(false);
  });

  it("draws again after a context loss: old fences never signal (G-029)", () => {
    const { gl, context } = fakeGl();
    const pacer = new GpuPacer(gl);
    pacer.drawn();
    pacer.drawn();
    context.lost = true;
    context.nullStatus = true;
    expect(pacer.canDraw).toBe(true);
    // Restored: the fences made before the loss are gone, new ones pace as before.
    context.lost = false;
    context.nullStatus = false;
    expect(pacer.canDraw).toBe(true);
    pacer.drawn();
    pacer.drawn();
    expect(pacer.canDraw).toBe(false);
  });

  it("counts a fence whose status reads null as finished", () => {
    const { gl, context } = fakeGl();
    const pacer = new GpuPacer(gl);
    pacer.drawn();
    pacer.drawn();
    context.nullStatus = true;
    expect(pacer.canDraw).toBe(true);
  });

  it("forgets the fences in flight on reset (context lost or restored)", () => {
    const { gl } = fakeGl();
    const pacer = new GpuPacer(gl);
    pacer.drawn();
    pacer.drawn();
    pacer.reset();
    expect(pacer.canDraw).toBe(true);
  });

  it("draws every frame without WebGL2 fences", () => {
    const pacer = new GpuPacer(null);
    for (let i = 0; i < 5; i++) {
      expect(pacer.canDraw).toBe(true);
      pacer.drawn();
    }
  });
});
