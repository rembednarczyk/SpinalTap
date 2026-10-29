import { type BaseTexture, Constants, DynamicTexture, type Scene, ShaderMaterial, Texture } from "../../babylon";
import { prng } from "../city-kit-data";
import { drawGlyph } from "../signage";
import { MAP_SIGN_BLADES, MAP_SIGN_BOARDS } from "./sign-plan";

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
 * The map city's neon (ADR-0044), additive like the street signage (ADR-0030): atlas boards
 * and blades with a hum, holo-ads with glyph rain, a ring logo or a figure (fresnel edges,
 * scanlines, rare dropouts and slice glitches unless flashes are reduced), lit name plaques
 * from the names atlas, neon tubes and their streaks on the wet ground.
 */
const FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUV;
varying vec4 vColor;
varying vec2 vMeta;
varying vec3 vWorld;
varying float vFacing;
uniform sampler2D atlas;
uniform sampler2D names;
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
void main(void) {
  float kind = floor(vMeta.y + 0.5);
  float seed = vMeta.x;
  vec2 uv = vUV;
  vec3 col = vColor.rgb;
  float a = 0.0;
  float hum = 0.92 + 0.08 * sin(time * 2.3 + seed * 5.0 + vWorld.x) * (1.0 - reduce);
  if (kind > 5.5) {
    // A round sign on an Old Town bracket (ADR-0048): a neon rim and a glyph of strokes.
    vec2 q = uv * 2.0 - 1.0;
    float r = length(q);
    float disc = 1.0 - step(1.0, r);
    float rim = disc * step(0.82, r);
    vec2 g = (q * 0.66 + 0.5) * 4.0;
    vec2 cell = floor(g);
    vec2 fr = fract(g);
    float h = hash(cell + floor(seed * 37.0));
    float strokes = max(step(0.55, h) * step(abs(fr.y - 0.5), 0.13), step(h, 0.3) * step(abs(fr.x - 0.5), 0.13));
    float glyph = strokes * step(0.0, g.x) * step(g.x, 4.0) * step(0.0, g.y) * step(g.y, 4.0) * step(r, 0.7);
    a = (rim * 1.15 + glyph * 0.95 + disc * 0.08) * hum;
    col = mix(col, vec3(1.0), glyph * 0.3);
  } else if (kind < 0.5 || kind > 4.5) {
    vec2 c = clamp(uv, 0.004, 0.996);
    float cell = floor(seed + 0.5);
    vec2 auv = kind > 4.5 ? vec2((cell + c.x) / 8.0, 0.5 + c.y * 0.5) : vec2((mod(cell, 2.0) + c.x) / 2.0, 0.5 - (floor(cell / 2.0) + 1.0) / 8.0 + c.y / 8.0);
    float m = texture2D(atlas, auv).r;
    a = (m * 1.1 + 0.07) * hum;
    col = mix(col, vec3(1.0), m * 0.35);
  } else if (kind < 1.5) {
    float burst = step(0.93, hash(vec2(floor(time * 3.0), seed * 17.0))) * (1.0 - reduce);
    uv.x += burst * (hash(vec2(floor(uv.y * 9.0), floor(time * 12.0))) - 0.5) * 0.18;
    float style = floor(fract(seed * 7.13) * 3.0);
    float shape = 0.0;
    if (style < 0.5) {
      vec2 g = vec2(uv.x * 6.0, uv.y * 14.0 + time * 0.9 * (0.5 + seed));
      float glyph = step(0.45, hash(floor(g) * 7.1 + floor(fract(g) * 3.0) + floor(time * 0.5 + seed * 9.0)));
      shape = glyph * step(0.12, fract(g.x)) * step(fract(g.x), 0.88) * step(0.1, fract(g.y));
    } else if (style < 1.5) {
      float r = length((uv - vec2(0.5, 0.64)) * vec2(1.0, 1.4));
      float ring = 1.0 - step(0.045, abs(r - 0.2 - 0.015 * sin(time * 2.0)));
      float bars = step(uv.y, 0.36) * step(0.08, uv.y) * step(0.4, fract(uv.y * 14.0)) * step(uv.x, 0.15 + 0.75 * hash(vec2(floor(uv.y * 14.0), seed)));
      shape = max(ring, bars);
    } else {
      float head = 1.0 - step(0.16, length((uv - vec2(0.5, 0.66)) * vec2(1.0, 0.8)));
      float body = step(uv.y, 0.45) * (1.0 - step(0.42 - uv.y * 0.3, abs(uv.x - 0.5)));
      shape = max(head, body) * (0.55 + 0.45 * step(0.5, fract((uv.x + uv.y) * 10.0 - time * 0.4)));
    }
    float inside = step(0.0, uv.x) * step(uv.x, 1.0);
    float frame = 1.0 - step(0.03, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
    float scan = 0.7 + 0.3 * sin(uv.y * 160.0 + time * 6.0);
    float flick = 1.0 - 0.55 * step(0.97, hash(vec2(floor(time * 8.0), seed * 31.0))) * (1.0 - reduce);
    float fres = 1.0 - vFacing;
    a = ((shape * 0.5 + 0.06) * (1.0 - 0.6 * fres) + frame * (0.55 + 0.8 * fres)) * scan * flick * inside;
    col = mix(col, vec3(1.0) - col * 0.4, fres * 0.5) * mix(1.2, 0.8, uv.y);
  } else if (kind < 2.5) {
    float row = floor(seed + 0.5);
    vec2 nuv = vec2((mod(row, 2.0) + clamp(uv.x, 0.003, 0.997)) / 2.0, 1.0 - (floor(row / 2.0) + 1.0 - clamp(uv.y, 0.01, 0.99)) / 16.0);
    float m = texture2D(names, nuv).r;
    a = (m * 1.2 + 0.1) * hum;
    col = mix(col * vec3(1.0, 0.85, 0.6), vec3(1.0), m * 0.5);
  } else if (kind < 3.5) {
    a = (0.6 + 0.4 * (1.0 - abs(uv.y * 2.0 - 1.0))) * hum;
  } else {
    float acrossK = 1.0 - abs(uv.x * 2.0 - 1.0);
    float x = uv.x * 22.0;
    float h = mix(hash(vec2(floor(x), seed)), hash(vec2(floor(x) + 1.0, seed)), smoothstep(0.0, 1.0, fract(x)));
    float ripple = 0.65 + 0.35 * sin(uv.y * 40.0 + h * 6.28 + time * 1.5 * (1.0 - reduce));
    float puddle = smoothstep(0.42, 0.62, noise(vWorld.xz * 0.45 + seed * 13.0));
    a = pow(acrossK, 1.5) * pow(1.0 - uv.y, 1.3) * mix(0.25, 1.0, h * h) * ripple * mix(0.3, 1.0, puddle);
  }
  float dist = length(cameraPosition - vWorld);
  float fog = 1.0 - exp(-pow(dist * fogDensity * 0.6, 2.0));
  a *= vColor.a * intensity * (1.0 - 0.85 * fog);
  gl_FragColor = vec4(col * a, a);
}
`;

const FONT = `"Rajdhani", "Arial Narrow", "Noto Sans CJK JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif`;

const isCjk = (ch: string): boolean => /[\u3000-\u9fff\uff00-\uffef]/.test(ch);

/**
 * Whether the browser has a Japanese font: a kana drawn the same as an unassigned code point
 * means it falls back to the missing-glyph box. Without one the Japanese becomes pseudo-kanji.
 */
export const canDrawJapanese = (ctx: CanvasRenderingContext2D): boolean => {
  const draw = (ch: string) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = "#fff";
    ctx.font = `28px ${FONT}`;
    ctx.textBaseline = "top";
    ctx.fillText(ch, 2, 2);
    return Array.from(ctx.getImageData(0, 0, 32, 32).data).join(",");
  };
  return draw("ラ") !== draw("\u{10fffd}");
};

/** Draws a label centred at (cx, cy): Latin as text, Japanese as text or pseudo-kanji. */
const drawLabel = (ctx: CanvasRenderingContext2D, label: string, cx: number, cy: number, size: number, maxWidth: number, japanese: boolean, rand: () => number): void => {
  ctx.font = `bold ${size}px ${FONT}`;
  if (japanese || ![...label].some(isCjk)) {
    ctx.fillText(label, cx, cy, maxWidth);
    return;
  }
  const latin = [...label].filter((c) => !isCjk(c)).join("").trim();
  const glyphs = [...label].filter(isCjk).length;
  const gs = size * 0.8;
  const width = Math.min(ctx.measureText(latin).width, maxWidth - glyphs * gs);
  const start = cx - (width + glyphs * gs) / 2;
  if (latin) ctx.fillText(latin, start + width / 2, cy, width);
  for (let k = 0; k < glyphs; k++) drawGlyph(ctx, start + width + k * gs + gs * 0.08, cy - gs / 2, gs * 0.84, rand);
};

/** The Lublin sign atlas (1024²): eight blades with vertical lettering on top, eight boards below. */
export const drawMapSignAtlas = (ctx: CanvasRenderingContext2D, japanese: boolean, size = 1024): void => {
  const rand = prng(0x1ab11);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const bw = size / 8;
  const bh = size / 2;
  MAP_SIGN_BLADES.forEach((label, i) => {
    const x = i * bw;
    ctx.lineWidth = 5;
    ctx.strokeRect(x + 10, 10, bw - 20, bh - 20);
    const chars = [...label];
    const step = (bh - 40) / Math.max(chars.length, 1);
    chars.forEach((ch, k) => drawLabel(ctx, ch, x + bw / 2, 20 + step * (k + 0.5), Math.min(76, step * 0.9), bw - 24, japanese, rand));
  });
  const cw = size / 2;
  const ch = size / 8;
  MAP_SIGN_BOARDS.forEach((label, i) => {
    const x = (i % 2) * cw;
    const y = bh + Math.floor(i / 2) * ch;
    ctx.lineWidth = 5;
    ctx.strokeRect(x + 10, y + 10, cw - 20, ch - 20);
    drawLabel(ctx, label, x + cw / 2, y + ch / 2 + 4, 66, cw - 50, japanese, rand);
  });
};

/** Rows of the names atlas: 2 columns x 16 rows of 512 x 64. */
export const NAME_SLOTS = 32;

export const drawName = (ctx: CanvasRenderingContext2D, slot: number, name: string): void => {
  const x = (slot % 2) * 512;
  const y = Math.floor(slot / 2) * 64;
  ctx.fillStyle = "#000000";
  ctx.fillRect(x, y, 512, 64);
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 4, y + 4, 504, 56);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold 40px ${FONT}`;
  ctx.fillText(name.toUpperCase(), x + 256, y + 34, 480);
};

/** The sign material of the map city with its two atlases. */
export class MapSignMaterial {
  readonly material: ShaderMaterial;
  private readonly names: DynamicTexture | null;
  private readonly slots = new Map<string, number>();
  private time = 0;

  /** `atlas` replaces the drawn atlases (tests without a canvas); names then go undrawn. */
  constructor(scene: Scene, atlas?: BaseTexture) {
    const m = new ShaderMaterial("map-signs", scene, { vertexSource: VERTEX, fragmentSource: FRAGMENT }, {
      attributes: ["position", "normal", "color", "uv", "uv2"],
      uniforms: ["viewProjection", "cameraPosition", "time", "intensity", "fogDensity", "reduce"],
      samplers: ["atlas", "names"],
      needAlphaBlending: true,
    });
    if (atlas) {
      m.setTexture("atlas", atlas);
      m.setTexture("names", atlas);
      this.names = null;
    } else {
      const tex = new DynamicTexture("map-sign-atlas", { width: 1024, height: 1024 }, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
      const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
      const japanese = canDrawJapanese(ctx);
      drawMapSignAtlas(ctx, japanese);
      tex.update();
      m.setTexture("atlas", tex);
      this.names = new DynamicTexture("map-names", { width: 1024, height: 1024 }, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
      const nctx = this.names.getContext() as unknown as CanvasRenderingContext2D;
      nctx.fillStyle = "#000000";
      nctx.fillRect(0, 0, 1024, 1024);
      this.names.update();
      m.setTexture("names", this.names);
    }
    m.alphaMode = Constants.ALPHA_ONEONE;
    m.disableDepthWrite = true;
    m.setFloat("time", 0);
    m.setFloat("intensity", 1);
    m.setFloat("reduce", 0);
    m.setFloat("fogDensity", 0.02);
    this.material = m;
  }

  /** Row of a landmark's name in the names atlas, drawn on first use; null when full. */
  slotFor(name: string): number | null {
    const known = this.slots.get(name);
    if (known !== undefined) return known;
    if (this.slots.size >= NAME_SLOTS) return null;
    const slot = this.slots.size;
    this.slots.set(name, slot);
    if (this.names) {
      drawName(this.names.getContext() as unknown as CanvasRenderingContext2D, slot, name);
      this.names.update();
    }
    return slot;
  }

  setDaylight(daylight: number, fogDensity: number): void {
    const t = Math.max(0, Math.min(1, daylight));
    this.material.setFloat("intensity", 1 - 0.55 * t);
    this.material.setFloat("fogDensity", fogDensity);
  }

  setReduceFlashes(on: boolean): void {
    this.material.setFloat("reduce", on ? 1 : 0);
  }

  update(dt: number): void {
    this.time += dt;
    this.material.setFloat("time", this.time);
  }
}
