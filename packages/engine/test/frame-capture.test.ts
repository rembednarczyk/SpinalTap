import { describe, expect, it } from "vitest";
import { BabylonRenderer } from "../src/renderer/babylon-renderer";

/** A stage that counts the frames drawn on it; its canvas holds the last one (`preserveDrawingBuffer`). */
const fakeStage = () => {
  const drawn = { frames: 0 };
  const stage = {
    scene: { render: () => drawn.frames++ },
    engine: { getRenderingCanvas: () => ({ toDataURL: (type: string) => `data:${type};base64,frame-${drawn.frames}` }) },
  };
  return { stage, drawn };
};

describe("frame capture (G-031)", () => {
  it("reads the frame already on the canvas and draws none of its own", () => {
    const { stage, drawn } = fakeStage();
    stage.scene.render();
    const renderer = { stage } as unknown as BabylonRenderer;
    // A frame drawn here, past the GPU pacer, was a whole frame of SwiftShader work in front of
    // the readback: 1.3-5.8 s a capture under load.
    expect(BabylonRenderer.prototype.captureFrame.call(renderer)).toBe("data:image/png;base64,frame-1");
    expect(drawn.frames).toBe(1);
  });
});
