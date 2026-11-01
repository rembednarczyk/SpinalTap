import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { type BaseTexture, Scene } from "../src/babylon";
import { QUALITY_TIERS, WET_PRESETS, qualityTier } from "../src/npr/quality";
import { ToonMaterials } from "../src/npr/toon-material";
import { TOON_FRAGMENT } from "../src/npr/toon-shader";
import { PROBE_MIN_INTERVAL, ProbeSchedule, WetProbe } from "../src/renderer/wet-probe";

describe("wet asphalt tiers (ADR-0036)", () => {
  it("keep only strips on low, a probe on medium, a bigger probe on high and no SSR anywhere", () => {
    expect(QUALITY_TIERS.low.wetProbe).toBeNull();
    expect(QUALITY_TIERS.medium.wetProbe).toBe(128);
    expect(QUALITY_TIERS.high.wetProbe).toBeGreaterThan(QUALITY_TIERS.medium.wetProbe!);
    expect(qualityTier(undefined)).toBe(QUALITY_TIERS.high);
    // Medium keeps the line art (it is the look) and drops the costly extras.
    expect(QUALITY_TIERS.medium.lineArt).toBe(true);
    expect(QUALITY_TIERS.medium.shadowMap).toBeLessThan(QUALITY_TIERS.high.shadowMap);
    expect(QUALITY_TIERS.medium.splashes).toBe(false);
  });

  it("compile the probe only into the wet presets, and only when there is a probe", () => {
    const scene = new Scene(new NullEngine());
    const plain = new ToonMaterials(scene);
    plain.get("asphalt");
    expect(plain.reflectiveCount).toBe(0);
    const materials = new ToonMaterials(scene);
    materials.setEnvironment({ uniqueId: 1 } as unknown as BaseTexture, WET_PRESETS);
    const asphalt = materials.get("asphalt");
    const concrete = materials.get("concrete");
    materials.get("dressing");
    expect(asphalt.options.defines).toContain("ENV_REFLECT");
    expect(asphalt.options.samplers).toContain("envSampler");
    expect(concrete.options.defines).not.toContain("ENV_REFLECT");
    expect(materials.reflectiveCount).toBe(2);
    expect(TOON_FRAGMENT).toContain("uniform samplerCube envSampler");
  });
});

describe("probe schedule", () => {
  it("renders on start, on a new district and when something changed, at most once a second", () => {
    const s = new ProbeSchedule();
    expect(s.update(0.016)).toBe(true);
    expect(s.update(0.016)).toBe(false);
    s.setDistrict("targ");
    expect(s.update(0.1)).toBe(false);
    expect(s.update(PROBE_MIN_INTERVAL)).toBe(true);
    s.setDistrict("targ");
    expect(s.update(5)).toBe(false);
    s.invalidate();
    s.invalidate();
    expect(s.update(0.016)).toBe(true);
    expect(s.update(5)).toBe(false);
    s.setDistrict(null);
    expect(s.update(5)).toBe(false);
  });
});

describe("wet probe settling (G-114)", () => {
  it("stays pending while the schedule holds back a render, so a perf sample waits it out", () => {
    const probe = new WetProbe(new Scene(new NullEngine()), 16, () => []);
    const eye = { x: 0, z: 0 };
    expect(probe.pending).toBe(true);
    probe.update(0.016, eye);
    expect(probe.pending).toBe(false);
    // The city changed 0.3 s after the last render: the next one waits out the interval.
    probe.update(0.3, eye);
    probe.schedule.invalidate();
    for (let i = 0; i < 6; i++) {
      expect(probe.pending).toBe(true);
      probe.update(0.1, eye);
    }
    const renders = probe.renderCount;
    probe.update(0.2, eye);
    expect(probe.renderCount).toBe(renders + 1);
    expect(probe.pending).toBe(false);
    probe.update(5, eye);
    expect(probe.renderCount).toBe(renders + 1);
  });
});
