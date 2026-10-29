import type { ChunkDef } from "@seki/sim";
import { WORLD_CHUNKS } from "@seki/sim";
import { type BaseTexture, Constants, DynamicTexture, type Mesh, type Scene, ShaderMaterial, Texture } from "../babylon";
import type { LightingRig } from "../npr/lighting";
import { sinkToMesh } from "./dressing";
import { ATLAS_BLADES, SIGNAGE_BLADES, SIGNAGE_BOARDS, planSignage } from "./signage-plan";
import { prng } from "./city-kit-data";

const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec4 color;
attribute vec2 uv;
attribute vec2 uv2;
uniform mat4 viewProjection;
uniform vec3 cameraPosition;
varying vec2 vUV;
varying vec4 vColor;
varying vec2 vMeta;
varying vec3 vWorld;
varying float vFacing;
void main(void) {
  vUV = uv;
  vColor = color;
  vMeta = uv2;
  vWorld = position;
  vFacing = abs(dot(normalize(normal), normalize(cameraPosition - position)));
  gl_Position = viewProjection * vec4(position, 1.0);
}
`;

/**
 * Signs read from the atlas (white glyphs tinted per sign), holo-ads (procedural: glyph rain, a
 * ring logo or a figure, with fresnel edges, scanlines, flicker and a slice glitch) and the
 * neon on the wet street, broken up by a puddle mask. Additive: black adds nothing.
 */
const FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUV;
varying vec4 vColor;
varying vec2 vMeta;
varying vec3 vWorld;
varying float vFacing;
uniform sampler2D atlas;
uniform vec3 cameraPosition;
uniform float time;
uniform float intensity;
uniform float fogDensity;
uniform float reduce;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec2 atlasUV(float cell, vec2 uv) {
  if (cell < ${ATLAS_BLADES}.0) return vec2((cell + uv.x) / ${ATLAS_BLADES}.0, 0.5 + uv.y * 0.5);
  float c = cell - ${ATLAS_BLADES}.0;
  float col = mod(c, 2.0);
  float row = floor(c / 2.0);
  return vec2((col + uv.x) / 2.0, 0.5 - (row + 1.0) / 8.0 + uv.y / 8.0);
}
void main(void) {
  float kind = vMeta.y;
  float seed = vMeta.x;
  vec2 uv = vUV;
  vec3 col = vColor.rgb;
  float a = 0.0;
  if (kind < 0.5) {
    // Atlas sign: tube glyphs, a faint backing glow, a slow hum.
    float m = texture2D(atlas, atlasUV(floor(seed + 0.5), clamp(uv, 0.004, 0.996))).r;
    float hum = 0.92 + 0.08 * sin(time * 2.3 + seed * 5.0) * (1.0 - reduce);
    a = (m * 1.1 + 0.06) * hum;
    col = mix(col, vec3(1.0), m * 0.35);
  } else if (kind < 1.5) {
    // Holo-ad. Glitch: a slice slides sideways now and then (never with reduced flashes).
    float burst = step(0.93, hash(vec2(floor(time * 3.0), seed * 17.0))) * (1.0 - reduce);
    float slice = floor(uv.y * 9.0);
    uv.x += burst * (hash(vec2(slice, floor(time * 12.0))) - 0.5) * 0.18;
    float style = floor(fract(seed * 7.13) * 3.0);
    float shape = 0.0;
    if (style < 0.5) {
      vec2 g = vec2(uv.x * 6.0, uv.y * 14.0 + time * 0.9 * (0.5 + seed));
      vec2 cell = floor(g);
      vec2 sub = floor(fract(g) * 3.0);
      float glyph = step(0.45, hash(cell * 7.1 + sub + floor(time * 0.5 + seed * 9.0)));
      float gap = step(0.12, fract(g.x)) * step(fract(g.x), 0.88) * step(0.1, fract(g.y));
      shape = glyph * gap;
    } else if (style < 1.5) {
      float r = length((uv - vec2(0.5, 0.64)) * vec2(1.0, 1.4));
      float ring = 1.0 - step(0.045, abs(r - 0.2 - 0.015 * sin(time * 2.0)));
      float row = floor(uv.y * 14.0);
      float bars = step(uv.y, 0.36) * step(0.08, uv.y) * step(0.4, fract(uv.y * 14.0)) * step(uv.x, 0.15 + 0.75 * hash(vec2(row, seed)));
      shape = max(ring, bars);
    } else {
      vec2 p = uv - vec2(0.5, 0.0);
      float head = 1.0 - step(0.16, length((uv - vec2(0.5, 0.66)) * vec2(1.0, 0.8)));
      float body = step(uv.y, 0.45) * (1.0 - step(0.42 - uv.y * 0.3, abs(p.x)));
      float stripes = 0.55 + 0.45 * step(0.5, fract((uv.x + uv.y) * 10.0 - time * 0.4));
      shape = max(head, body) * stripes;
    }
    float inside = step(0.0, uv.x) * step(uv.x, 1.0);
    float frame = 1.0 - step(0.03, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
    float scan = 0.7 + 0.3 * sin(uv.y * 160.0 + time * 6.0);
    // Flicker: a rare dropout, a few frames long (never with reduced flashes).
    float flick = 1.0 - 0.55 * step(0.97, hash(vec2(floor(time * 8.0), seed * 31.0))) * (1.0 - reduce);
    // Fresnel: seen edge-on the projection thins out and its rim burns brighter.
    float fres = 1.0 - vFacing;
    a = ((shape * 0.5 + 0.06) * (1.0 - 0.6 * fres) + frame * (0.55 + 0.8 * fres)) * scan * flick * inside;
    col = mix(col, vec3(1.0) - col * 0.4, fres * 0.5) * mix(1.2, 0.8, uv.y);
  } else {
    // Neon on wet asphalt: broken streaks fading away from the wall, brightest in the puddles.
    float acrossK = 1.0 - abs(uv.x * 2.0 - 1.0);
    float alongK = 1.0 - uv.y;
    float x = uv.x * 22.0;
    float k = smoothstep(0.0, 1.0, fract(x));
    float h = mix(hash(vec2(floor(x), seed)), hash(vec2(floor(x) + 1.0, seed)), k);
    float ripple = 0.65 + 0.35 * sin(uv.y * 40.0 + h * 6.28 + time * 1.5 * (1.0 - reduce));
    float puddle = smoothstep(0.42, 0.62, noise(vWorld.xz * 0.45 + seed * 13.0));
    a = pow(acrossK, 1.5) * pow(alongK, 1.3) * mix(0.25, 1.0, h * h) * ripple * mix(0.3, 1.0, puddle);
  }
  float dist = length(cameraPosition - vWorld);
  float fog = 1.0 - exp(-pow(dist * fogDensity * 0.6, 2.0));
  a *= vColor.a * intensity * (1.0 - 0.85 * fog);
  gl_FragColor = vec4(col * a, a);
}
`;

/** Pseudo-kanji: a few strokes on a 3x3 grid, for the labels that are not Latin. */
export const drawGlyph = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rand: () => number) => {
  const t = Math.max(3, s * 0.12);
  for (let k = 0; k < 4 + Math.floor(rand() * 3); k++) {
    const gx = Math.floor(rand() * 3);
    const gy = Math.floor(rand() * 3);
    if (rand() < 0.5) ctx.fillRect(x + (gx * s) / 3, y + (gy * s) / 3 + s / 6 - t / 2, (s / 3) * (1 + Math.floor(rand() * 2)), t);
    else ctx.fillRect(x + (gx * s) / 3 + s / 6 - t / 2, y + (gy * s) / 3, t, (s / 3) * (1 + Math.floor(rand() * 2)));
  }
};

/** The sign atlas: white tube lettering on black, tinted per sign in the shader. */
export const drawSignAtlas = (ctx: CanvasRenderingContext2D, size = 1024): void => {
  const rand = prng(0x5a7145);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const bw = size / ATLAS_BLADES;
  const bh = size / 2;
  SIGNAGE_BLADES.forEach((label, i) => {
    const x = i * bw;
    ctx.lineWidth = 5;
    ctx.strokeRect(x + 10, 10, bw - 20, bh - 20);
    const chars = label.length > 1 ? [...label] : ["", "", "", ""];
    const step = (bh - 40) / Math.max(chars.length, 1);
    ctx.font = `bold ${Math.min(76, step * 0.9)}px "Rajdhani", "Arial Narrow", sans-serif`;
    chars.forEach((ch, k) => {
      const cy = 20 + step * (k + 0.5);
      if (ch) ctx.fillText(ch, x + bw / 2, cy);
      else drawGlyph(ctx, x + bw / 2 - 34, cy - 34, 68, rand);
    });
  });
  const cw = size / 2;
  const ch = size / 8;
  SIGNAGE_BOARDS.forEach((label, i) => {
    const x = (i % 2) * cw;
    const y = bh + Math.floor(i / 2) * ch;
    ctx.lineWidth = 5;
    ctx.strokeRect(x + 10, y + 10, cw - 20, ch - 20);
    if (label.length > 1) {
      ctx.font = `bold 78px "Rajdhani", "Arial Narrow", sans-serif`;
      ctx.fillText(label, x + cw / 2, y + ch / 2 + 4, cw - 50);
    } else {
      for (let k = 0; k < 5; k++) drawGlyph(ctx, x + 40 + k * 90, y + 26, 76, rand);
    }
  });
};

const drawnAtlas = (scene: Scene): DynamicTexture => {
  const tex = new DynamicTexture("sign-atlas", { width: 1024, height: 1024 }, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
  drawSignAtlas(tex.getContext() as unknown as CanvasRenderingContext2D);
  tex.update();
  return tex;
};

/** One mesh, one material: every sign, holo-ad and street reflection of the city (ADR-0030). */
export class Signage {
  readonly mesh: Mesh | null;
  readonly material: ShaderMaterial;
  private readonly atlas: BaseTexture;
  private time = 0;

  /** `atlas` replaces the drawn one (tests without a canvas). */
  constructor(scene: Scene, chunks: readonly ChunkDef[] = WORLD_CHUNKS, atlas?: BaseTexture) {
    this.atlas = atlas ?? drawnAtlas(scene);
    const m = new ShaderMaterial("signage", scene, { vertexSource: VERTEX, fragmentSource: FRAGMENT }, {
      attributes: ["position", "normal", "color", "uv", "uv2"],
      uniforms: ["viewProjection", "cameraPosition", "time", "intensity", "fogDensity", "reduce"],
      samplers: ["atlas"],
      needAlphaBlending: true,
    });
    m.setTexture("atlas", this.atlas);
    m.alphaMode = Constants.ALPHA_ONEONE;
    m.disableDepthWrite = true;
    m.setFloat("time", 0);
    m.setFloat("intensity", 1);
    m.setFloat("reduce", 0);
    this.material = m;
    const sink = planSignage(chunks);
    this.mesh = sink.empty ? null : sinkToMesh(scene, "signage", sink, true);
    if (this.mesh) {
      this.mesh.material = m;
      // Spans the whole city: never worth a culling test.
      this.mesh.alwaysSelectAsActiveMesh = true;
    }
  }

  setDaylight(rig: LightingRig, daylight: number): void {
    const t = Math.max(0, Math.min(1, daylight));
    this.material.setFloat("fogDensity", rig.fogDensity);
    this.material.setFloat("intensity", 1 - 0.55 * t);
  }

  setReduceFlashes(on: boolean): void {
    this.material.setFloat("reduce", on ? 1 : 0);
  }

  update(dt: number, frozen: boolean): void {
    if (frozen) return;
    this.time += dt;
    this.material.setFloat("time", this.time);
  }

  /** Compiles the shader before the first frame that needs it. */
  warmUp(done?: () => void): void {
    if (!this.mesh) return;
    this.material.forceCompilation(this.mesh, () => done?.());
  }
}
