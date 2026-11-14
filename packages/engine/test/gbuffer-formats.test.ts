import { describe, expect, it } from "vitest";
import { Constants } from "../src/babylon";
import { contactOcclusionFragment } from "../src/npr/contact-shade";
import { GB_FORMAT, GB_TYPE, type GBufferCaps, gbufferBytes, gbufferFormats, normalDecodeGlsl } from "../src/npr/gbuffer-formats";
import { lineArtFragment } from "../src/npr/line-art";

const DESKTOP: GBufferCaps = {
  webGLVersion: 2,
  isWebGPU: false,
  textureFloatRender: true,
  textureFloatLinearFiltering: true,
  textureHalfFloatRender: true,
  textureHalfFloatLinearFiltering: true,
};
/** Typical phone GPU: renders to floats, filters only half floats. */
const PHONE: GBufferCaps = { ...DESKTOP, textureFloatLinearFiltering: false };

describe("geometry buffer formats (frame profile 14.11)", () => {
  it("mirrors Babylon's texture constants", () => {
    expect(GB_TYPE.float).toBe(Constants.TEXTURETYPE_FLOAT);
    expect(GB_TYPE.halfFloat).toBe(Constants.TEXTURETYPE_HALF_FLOAT);
    expect(GB_TYPE.rgb10a2).toBe(Constants.TEXTURETYPE_UNSIGNED_INT_2_10_10_10_REV);
    expect(GB_FORMAT.r).toBe(Constants.TEXTUREFORMAT_R);
    expect(GB_FORMAT.rgba).toBe(Constants.TEXTUREFORMAT_RGBA);
  });

  it("keeps depth in one 32-bit float channel and normals in ten bits where floats filter", () => {
    const f = gbufferFormats(DESKTOP);
    expect(f[0]).toEqual({ textureType: GB_TYPE.float, textureFormat: GB_FORMAT.r, samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE });
    expect(f[1]).toEqual({ textureType: GB_TYPE.rgb10a2, textureFormat: GB_FORMAT.rgba, samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE });
    // 16 + 16 bytes a pixel before, 4 + 4 after.
    expect(gbufferBytes({}, DESKTOP)).toBe(32);
    expect(gbufferBytes(f, DESKTOP)).toBe(8);
  });

  it("falls back to a half-float depth channel where 32-bit floats do not filter", () => {
    const f = gbufferFormats(PHONE);
    expect(f[0]?.textureType).toBe(GB_TYPE.halfFloat);
    expect(f[0]?.textureFormat).toBe(GB_FORMAT.r);
    expect(gbufferBytes({}, PHONE)).toBe(16);
    expect(gbufferBytes(f, PHONE)).toBe(6);
  });

  it("leaves depth on Babylon's default where no float target renders", () => {
    const f = gbufferFormats({ ...PHONE, textureFloatRender: false, textureHalfFloatRender: false });
    expect(f[0]).toBeUndefined();
    expect(f[1]?.textureType).toBe(GB_TYPE.rgb10a2);
  });

  it("changes nothing on WebGL1 or WebGPU", () => {
    expect(gbufferFormats({ ...DESKTOP, webGLVersion: 1 })).toEqual({});
    expect(gbufferFormats({ ...DESKTOP, webGLVersion: 2, isWebGPU: true })).toEqual({});
  });
});

/** The GLSL decode, run in TypeScript: the stored texel to the unit normal. */
const decode = (encoded: boolean, t: readonly [number, number, number]): [number, number, number] => {
  const v = t.map((c) => (encoded ? c * 2 - 1 : c) + 1e-5);
  const l = Math.hypot(...v);
  return [v[0]! / l, v[1]! / l, v[2]! / l];
};
/** What Babylon writes for RGB10_A2 (ENCODE_NORMAL), quantised to ten bits. */
const store = (n: readonly [number, number, number]): [number, number, number] => n.map((c) => Math.round((c * 0.5 + 0.5) * 1023) / 1023) as [number, number, number];

describe("normal encoding", () => {
  it("decodes n * 0.5 + 0.5 back to the signed normal within the crease test's step", () => {
    expect(normalDecodeGlsl(true)).toContain("t.xyz * 2.0 - 1.0");
    expect(normalDecodeGlsl(false)).not.toContain("* 2.0 - 1.0");
    for (const n of [
      [0, 1, 0],
      [0, 0, -1],
      [-0.6, 0.8, 0],
      [0.48, -0.6, -0.64],
    ] as const) {
      const d = decode(true, store(n));
      const dot = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
      // The line art draws a crease at 1 - dot > 0.35: ten bits stay three orders below it.
      expect(1 - dot).toBeLessThan(1e-4);
    }
  });

  it("decodes in both shaders that read normals", () => {
    for (const encoded of [false, true]) {
      const expected = normalDecodeGlsl(encoded).trim();
      expect(lineArtFragment(false, encoded)).toContain(expected);
      expect(lineArtFragment(true, encoded)).toContain(expected);
      expect(contactOcclusionFragment(encoded)).toContain(expected);
    }
    expect(lineArtFragment(true, true)).toContain("decodeNormal(texture2D(normalSampler, uv))");
    expect(contactOcclusionFragment(true)).toContain("decodeNormal(texture2D(normalSampler, vUV))");
  });
});
