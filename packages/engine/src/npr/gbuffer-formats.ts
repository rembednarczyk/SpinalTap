/**
 * Formats of the geometry buffer the line art and the contact shade read (frame profile 14.11).
 *
 * Babylon's default is RGBA float for every target: 16 bytes of depth and 16 of normals per pixel,
 * of which the passes use one channel and three. On the phone about 80% of the frame scales with
 * the pixel count, and the line art reads 9 depth and 5 normal samples a pixel, the contact shade
 * about 45 more, so the buffer's size is bandwidth on every one of them.
 *
 * - Depth (linear view depth) in one channel: R32F where the GPU renders to and filters 32-bit
 *   floats, else R16F (WebGL2 filters half floats; where 32-bit ones are not filterable Babylon
 *   already fell back to half floats, so the precision there does not change).
 * - Normals (view space, signed) in RGB10_A2: Babylon writes them as n * 0.5 + 0.5 for this type
 *   (`normalsAreUnsigned`), and the shaders decode with `decodeNormal`. Ten bits a channel keep
 *   the dot products of the crease test well under its threshold's step.
 *
 * Bilinear sampling stays: the line art samples at fractions of a pixel on tall screens.
 */

/** Babylon's texture constants (`Constants.TEXTURETYPE_*`, `TEXTUREFORMAT_*`); the test checks them. */
export const GB_TYPE = { float: 1, halfFloat: 2, rgb10a2: 11 } as const;
export const GB_FORMAT = { r: 6, rgba: 5 } as const;
const BILINEAR = 2;

/** The engine capabilities the choice depends on. */
export interface GBufferCaps {
  readonly webGLVersion: number;
  readonly isWebGPU: boolean;
  readonly textureFloatRender: boolean;
  readonly textureFloatLinearFiltering: boolean;
  readonly textureHalfFloatRender: boolean;
  readonly textureHalfFloatLinearFiltering: boolean;
}

export interface GBufferTarget {
  readonly textureType: number;
  readonly textureFormat: number;
  readonly samplingMode: number;
}

/** Targets by Babylon's texture-type index (0 depth, 1 normal); empty means Babylon's default. */
export type GBufferFormats = Readonly<Record<number, GBufferTarget>>;

const DEPTH_INDEX = 0;
const NORMAL_INDEX = 1;

/** The lighter targets this GPU can render to and filter; what it cannot stays on the default. */
export const gbufferFormats = (caps: GBufferCaps): GBufferFormats => {
  // WebGL1 has no single-channel float targets and WebGPU does not filter 32-bit floats by default.
  if (caps.isWebGPU || caps.webGLVersion < 2) return {};
  const formats: Record<number, GBufferTarget> = {
    [NORMAL_INDEX]: { textureType: GB_TYPE.rgb10a2, textureFormat: GB_FORMAT.rgba, samplingMode: BILINEAR },
  };
  if (caps.textureFloatRender && caps.textureFloatLinearFiltering) {
    formats[DEPTH_INDEX] = { textureType: GB_TYPE.float, textureFormat: GB_FORMAT.r, samplingMode: BILINEAR };
  } else if (caps.textureHalfFloatRender && caps.textureHalfFloatLinearFiltering) {
    formats[DEPTH_INDEX] = { textureType: GB_TYPE.halfFloat, textureFormat: GB_FORMAT.r, samplingMode: BILINEAR };
  }
  return formats;
};

/** Bytes per pixel of one target (Babylon's default: RGBA in floats, half floats without float filtering, else bytes). */
export const targetBytes = (target: GBufferTarget | undefined, caps: GBufferCaps): number => {
  if (!target) return caps.textureFloatLinearFiltering ? 16 : caps.textureHalfFloatLinearFiltering ? 8 : 4;
  if (target.textureType === GB_TYPE.rgb10a2) return 4;
  const channel = target.textureType === GB_TYPE.float ? 4 : target.textureType === GB_TYPE.halfFloat ? 2 : 1;
  return channel * (target.textureFormat === GB_FORMAT.r ? 1 : 4);
};

/** Bytes per pixel of the depth and normal targets together. */
export const gbufferBytes = (formats: GBufferFormats, caps: GBufferCaps): number =>
  targetBytes(formats[DEPTH_INDEX], caps) + targetBytes(formats[NORMAL_INDEX], caps);

/**
 * GLSL `decodeNormal`: the view-space normal from the stored one. With `encoded` the buffer holds
 * n * 0.5 + 0.5; the small offset keeps an empty (sky) texel from normalising a zero vector.
 */
export const normalDecodeGlsl = (encoded: boolean): string => /* glsl */ `
vec3 decodeNormal(vec4 t) { return normalize(${encoded ? "t.xyz * 2.0 - 1.0" : "t.xyz"} + 1e-5); }
`;
