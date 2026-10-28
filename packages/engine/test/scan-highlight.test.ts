import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Color3, MeshBuilder, Scene } from "../src/babylon";
import { OUTLINE_COLOR, applyOutline } from "../src/npr/outline";
import { SCAN_COLORS, ScanHighlight, scanClassOfTarget, scanClassOfView } from "../src/renderer/scan-highlight";

describe("scanner highlight (ADR-0030)", () => {
  it("marks enemies red, people cyan, cameras and devices yellow", () => {
    expect(scanClassOfView({ kind: "enemy", preset: "ganger" })).toBe("hostile");
    expect(scanClassOfView({ kind: "npc", preset: "civilian" })).toBe("civilian");
    expect(scanClassOfView({ kind: "heroine" })).toBeNull();
    expect(scanClassOfView({ kind: "lamp", color: "#fff" })).toBeNull();
    expect(scanClassOfTarget("camera", null)).toBe("device");
    expect(scanClassOfTarget("device", "civilian")).toBe("device");
    expect(scanClassOfTarget("person", "hostile")).toBe("hostile");
    expect(scanClassOfTarget("person", null)).toBe("civilian");
    expect(scanClassOfTarget(undefined, null)).toBeNull();
    expect(Color3.FromHexString(SCAN_COLORS.hostile).r).toBeGreaterThan(0.9);
    expect(Color3.FromHexString(SCAN_COLORS.device).g).toBeGreaterThan(0.7);
    expect(Color3.FromHexString(SCAN_COLORS.civilian).b).toBeGreaterThan(0.9);
  });

  it("tints outlines, fills the focus and undoes all of it", () => {
    const scene = new Scene(new NullEngine());
    const body = MeshBuilder.CreateBox("body", { size: 1 }, scene);
    applyOutline(body);
    const camera = MeshBuilder.CreateBox("cam", { size: 0.3 }, scene);
    const h = new ScanHighlight();
    h.mark([body], "hostile", false, 1);
    expect(body.outlineColor.equals(Color3.FromHexString(SCAN_COLORS.hostile))).toBe(true);
    expect(body.outlineWidth).toBeGreaterThan(0.018);
    expect(body.renderOverlay).toBeFalsy();
    // A camera has no outline of its own: only the focus gives it one, with a fill.
    h.mark([camera], "device", false, 1);
    expect(camera.renderOutline).toBeFalsy();
    h.mark([camera], "device", true, 1);
    expect(camera.renderOutline).toBe(true);
    expect(camera.renderOverlay).toBe(true);
    h.release(new Set([body]));
    expect(camera.renderOutline).toBe(false);
    expect(camera.renderOverlay).toBe(false);
    expect(body.outlineColor).not.toBe(OUTLINE_COLOR);
    h.release();
    expect(body.outlineColor).toBe(OUTLINE_COLOR);
    expect(body.outlineWidth).toBeCloseTo(0.018);
    expect(h.marked).toBe(0);
    scene.dispose();
  });
});
