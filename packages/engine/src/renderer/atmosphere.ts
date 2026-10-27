import { Color3, Color4, Constants, DynamicTexture, type Mesh, MeshBuilder, MeshClass, ParticleSystem, type Scene, ShaderMaterial, Vector3 } from "../babylon";
import { type LightingRig, mixHex } from "../npr/lighting";

const SKY_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main(void) {
  vDir = position;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

/** Night sky over a lit city: dark zenith, warm-teal city glow at the horizon, under-lit cloud banks. */
const SKY_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 cityGlow;
uniform vec3 cloudLit;
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main(void) {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.1, 1.0);
  vec3 col = mix(horizon, zenith, smoothstep(0.0, 0.55, h));
  col += cityGlow * pow(1.0 - clamp(h, 0.0, 1.0), 6.0);
  // Cloud banks projected on a plane, lit from below by the city.
  vec2 uv = d.xz / max(d.y, 0.08) * 0.35;
  float c = smoothstep(0.48, 0.78, fbm(uv + vec2(3.1, 7.7)));
  float lit = pow(1.0 - clamp(h, 0.0, 1.0), 2.0);
  col = mix(col, cloudLit * (0.45 + 0.55 * lit), c * smoothstep(0.04, 0.25, h) * 0.75);
  gl_FragColor = vec4(col, 1.0);
}
`;

const SKYLINE_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
uniform mat4 world;
uniform mat4 viewProjection;
varying vec3 vWorldPos;
varying vec3 vNormal;
void main(void) {
  vec4 wp = world * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normal;
  gl_Position = viewProjection * wp;
}
`;

/** Distant towers: flat silhouettes fading into haze towards the ground, scattered lit windows. */
const SKYLINE_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vWorldPos;
varying vec3 vNormal;
uniform vec3 silhouette;
uniform vec3 haze;
uniform vec3 cameraPosition;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(void) {
  float height = clamp(vWorldPos.y / 90.0, 0.0, 1.0);
  vec3 col = mix(haze, silhouette, smoothstep(0.0, 0.6, height));
  if (abs(vNormal.y) < 0.5) {
    float u = abs(vNormal.x) > 0.5 ? vWorldPos.z : vWorldPos.x;
    vec2 g = vec2(u / 3.0, vWorldPos.y / 3.6);
    vec2 cell = floor(g);
    vec2 f = fract(g);
    float inWin = step(0.3, f.x) * step(f.x, 0.7) * step(0.35, f.y) * step(f.y, 0.7);
    float h = hash(cell + vNormal.xz * 13.0);
    vec3 win = h > 0.93 ? vec3(0.45, 0.9, 1.0) : vec3(1.0, 0.68, 0.38);
    col = mix(col, win * 0.7, inWin * step(0.82, h) * (0.4 + 0.6 * height));
  }
  // Rim of the roofline catches the city glow.
  if (vNormal.y > 0.5) col += haze * 0.25;
  gl_FragColor = vec4(col, 1.0);
}
`;

const CONE_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
uniform mat4 world;
uniform mat4 viewProjection;
uniform vec3 cameraPosition;
varying float vFacing;
varying float vHeight;
void main(void) {
  vec4 wp = world * vec4(position, 1.0);
  vec3 n = normalize(mat3(world) * normal);
  vFacing = abs(dot(n, normalize(cameraPosition - wp.xyz)));
  vHeight = position.y;
  gl_Position = viewProjection * wp;
}
`;

/** Fake volumetric light: brightest along the view axis of the cone, fading towards the ground. */
const CONE_FRAGMENT = /* glsl */ `
precision highp float;
varying float vFacing;
varying float vHeight;
uniform vec3 lightColor;
uniform float intensity;
uniform float coneHeight;
void main(void) {
  float t = clamp(vHeight / coneHeight + 0.5, 0.0, 1.0);
  float a = pow(vFacing, 2.5) * mix(0.15, 1.0, t) * intensity;
  gl_FragColor = vec4(lightColor * a, a);
}
`;

const STREAK_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUV;
void main(void) {
  vUV = uv;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

/** Neon reflected in wet asphalt: broken vertical streaks fading away from the source. */
const STREAK_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUV;
uniform vec3 lightColor;
uniform float intensity;
uniform float time;
float hash(float x) { return fract(sin(x * 91.7) * 43758.5453); }
void main(void) {
  float across = 1.0 - abs(vUV.x * 2.0 - 1.0);
  float along = 1.0 - vUV.y;
  // Smoothly interpolated lanes: fine broken streaks instead of hard bands up close.
  float x = vUV.x * 36.0;
  float lane = floor(x);
  float k = smoothstep(0.0, 1.0, fract(x));
  float h = mix(hash(lane), hash(lane + 1.0), k);
  float ripple = 0.6 + 0.4 * sin(vUV.y * 52.0 + h * 6.28 + time * 1.7);
  float streaks = mix(0.25, 1.0, h * h) * ripple;
  float a = pow(across, 1.6) * pow(along, 1.4) * streaks * intensity;
  gl_FragColor = vec4(lightColor * a, a);
}
`;

/** Small deterministic PRNG so the skyline is identical every run (reference snapshots). */
const lcg = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

const additive = (scene: Scene, name: string, vertex: string, fragment: string, uniforms: string[], attributes: string[]): ShaderMaterial => {
  const m = new ShaderMaterial(name, scene, { vertexSource: vertex, fragmentSource: fragment }, { attributes, uniforms, needAlphaBlending: true });
  m.alphaMode = Constants.ALPHA_ONEONE;
  m.disableDepthWrite = true;
  m.backFaceCulling = false;
  return m;
};

interface Flicker {
  readonly material: { emissiveColor: Color3 };
  readonly base: Color3;
  readonly seed: number;
}

const NIGHT_ZENITH = "#03060b";
const DAY_ZENITH = "#5d6b7c";
const NIGHT_CLOUDS = "#3a3442";
const DAY_CLOUDS = "#a3a9b4";
const NIGHT_SILHOUETTE = "#070b11";
const DAY_SILHOUETTE = "#4a5562";

/**
 * Everything that makes the street read as a place at night rather than boxes in fog: sky,
 * distant skyline, light shafts under lamps, neon reflections on wet asphalt, flickering signs.
 * Purely presentational; none of it exists in the simulation.
 */
export class Atmosphere {
  private readonly coneMaterials = new Map<string, ShaderMaterial>();
  private readonly streakMaterials = new Map<string, ShaderMaterial>();
  private readonly flickers: Flicker[] = [];
  private time = 0;
  private sky: ShaderMaterial | null = null;
  private skyline: ShaderMaterial | null = null;
  /** Meshes that must stay out of the G-buffer, shadow and picking. */
  readonly decorative: Mesh[] = [];

  constructor(
    private readonly scene: Scene,
    rig: LightingRig,
  ) {
    this.buildSky(rig);
    this.buildSkyline(rig);
  }

  /** A light shaft from a lamp head down to the street. */
  addLightCone(name: string, top: Vector3, color: string, height = 4.8): Mesh {
    const cone = MeshBuilder.CreateCylinder(name, { height, diameterTop: 0.3, diameterBottom: 4.2, tessellation: 24, cap: MeshClass.NO_CAP }, this.scene);
    cone.position.set(top.x, top.y - height / 2, top.z);
    cone.material = this.material(this.coneMaterials, color, () => {
      const m = additive(this.scene, `cone-${color}`, CONE_VERTEX, CONE_FRAGMENT, ["world", "viewProjection", "cameraPosition", "lightColor", "intensity", "coneHeight"], ["position", "normal"]);
      m.setColor3("lightColor", Color3.FromHexString(color));
      m.setFloat("intensity", 0.22);
      m.setFloat("coneHeight", height);
      return m;
    });
    return this.decorate(cone);
  }

  /**
   * A reflection streak on the ground in front of a light source. `towards` is the horizontal
   * direction the streak runs (away from the wall, into the street).
   */
  addReflection(name: string, at: Vector3, towards: Vector3, width: number, length: number, color: string, intensity = 0.5): Mesh {
    const plane = MeshBuilder.CreateGround(name, { width, height: length }, this.scene);
    const dir = new Vector3(towards.x, 0, towards.z).normalize();
    plane.position.set(at.x + dir.x * (length / 2), 0.03, at.z + dir.z * (length / 2));
    // The plane's local +Z is its length axis; point it along `dir` (uv.y = 0 at the far end).
    plane.rotation.y = Math.atan2(-dir.x, -dir.z);
    plane.material = this.material(this.streakMaterials, `${color}:${intensity}`, () => {
      const m = additive(this.scene, `streak-${color}`, STREAK_VERTEX, STREAK_FRAGMENT, ["worldViewProjection", "lightColor", "intensity", "time"], ["position", "uv"]);
      m.setColor3("lightColor", Color3.FromHexString(color));
      m.setFloat("intensity", intensity);
      return m;
    });
    return this.decorate(plane);
  }

  /** Registers a neon material that sputters now and then. */
  addFlicker(material: { emissiveColor: Color3 }, seed: number): void {
    this.flickers.push({ material, base: material.emissiveColor.clone(), seed });
  }

  /** Takes back a light cone or reflection (its prop streamed out). Shared materials stay. */
  removeDecoration(mesh: Mesh): void {
    const i = this.decorative.indexOf(mesh);
    if (i >= 0) this.decorative.splice(i, 1);
    mesh.dispose();
  }

  /**
   * Time of day (ADR-0017): the sky and the distant skyline follow the rig's haze; the zenith
   * and the cloud undersides pale with daylight. Uniforms only, the shaders stay as they are.
   */
  setDaylight(rig: LightingRig, daylight: number): void {
    const t = Math.max(0, Math.min(1, daylight));
    this.sky?.setColor3("zenith", Color3.FromHexString(mixHex(NIGHT_ZENITH, DAY_ZENITH, t)));
    this.sky?.setColor3("horizon", Color3.FromHexString(rig.fogColor));
    this.sky?.setColor3("cloudLit", Color3.FromHexString(mixHex(NIGHT_CLOUDS, DAY_CLOUDS, t)));
    this.skyline?.setColor3("silhouette", Color3.FromHexString(mixHex(NIGHT_SILHOUETTE, DAY_SILHOUETTE, t)));
    this.skyline?.setColor3("haze", Color3.FromHexString(rig.fogColor).scale(1.6 - 0.5 * t));
  }

  removeFlicker(material: { emissiveColor: Color3 }): void {
    const i = this.flickers.findIndex((f) => f.material === material);
    if (i >= 0) this.flickers.splice(i, 1);
  }

  update(dt: number, frozen: boolean): void {
    if (frozen) return;
    this.time += dt;
    for (const m of this.streakMaterials.values()) m.setFloat("time", this.time);
    for (const f of this.flickers) {
      // Mostly steady; every few seconds a burst of short dropouts.
      const cycle = (this.time + f.seed * 3.7) % 6.5;
      const burst = cycle > 5.6 && Math.sin(this.time * 47 + f.seed) > 0.1;
      const k = burst ? 0.18 : 1;
      f.material.emissiveColor.set(f.base.r * k, f.base.g * k, f.base.b * k);
    }
  }

  private material(cache: Map<string, ShaderMaterial>, key: string, make: () => ShaderMaterial): ShaderMaterial {
    let m = cache.get(key);
    if (!m) {
      m = make();
      cache.set(key, m);
    }
    return m;
  }

  private decorate(mesh: Mesh): Mesh {
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    this.decorative.push(mesh);
    return mesh;
  }

  private buildSky(rig: LightingRig): void {
    const sky = MeshBuilder.CreateSphere("sky", { diameter: 600, segments: 24, sideOrientation: MeshClass.BACKSIDE }, this.scene);
    const m = new ShaderMaterial("sky", this.scene, { vertexSource: SKY_VERTEX, fragmentSource: SKY_FRAGMENT }, {
      attributes: ["position"],
      uniforms: ["worldViewProjection", "zenith", "horizon", "cityGlow", "cloudLit"],
    });
    m.setColor3("zenith", Color3.FromHexString(NIGHT_ZENITH));
    m.setColor3("horizon", Color3.FromHexString(rig.fogColor));
    m.setColor3("cityGlow", Color3.FromHexString("#2c2a33"));
    m.setColor3("cloudLit", Color3.FromHexString(NIGHT_CLOUDS));
    m.disableDepthWrite = true;
    sky.material = m;
    this.sky = m;
    sky.infiniteDistance = true;
    sky.renderingGroupId = 0;
    this.decorate(sky);
  }

  private buildSkyline(rig: LightingRig): void {
    const rand = lcg(7);
    const towers: Mesh[] = [];
    for (let i = 0; i < 70; i++) {
      const angle = (i / 70) * Math.PI * 2 + rand() * 0.06;
      const dist = 75 + rand() * 90;
      const w = 10 + rand() * 18;
      const h = 30 + rand() * rand() * 110;
      const t = MeshBuilder.CreateBox(`tower-${i}`, { width: w, depth: w * (0.6 + rand() * 0.8), height: h }, this.scene);
      t.position.set(Math.sin(angle) * dist, h / 2 - 2, 7 + Math.cos(angle) * dist);
      t.rotation.y = rand() * Math.PI;
      t.bakeCurrentTransformIntoVertices();
      towers.push(t);
    }
    const merged = MeshClass.MergeMeshes(towers, true, true);
    if (!merged) return;
    merged.name = "skyline";
    const m = new ShaderMaterial("skyline", this.scene, { vertexSource: SKYLINE_VERTEX, fragmentSource: SKYLINE_FRAGMENT }, {
      attributes: ["position", "normal"],
      uniforms: ["world", "viewProjection", "silhouette", "haze", "cameraPosition"],
    });
    m.setColor3("silhouette", Color3.FromHexString(NIGHT_SILHOUETTE));
    m.setColor3("haze", Color3.FromHexString(rig.fogColor).scale(1.6));
    merged.material = m;
    this.skyline = m;
    this.decorate(merged);
  }
}

/** Soft round sprite for steam. */
const puffTexture = (scene: Scene): DynamicTexture => {
  const tex = new DynamicTexture("puff-tex", { width: 64, height: 64 }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,0.55)");
  g.addColorStop(0.5, "rgba(255,255,255,0.2)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  tex.update();
  tex.hasAlpha = true;
  return tex;
};

/** Steam rising from a vent or manhole, tinted by the street light around it. */
export const createSteam = (scene: Scene, at: Vector3, tint: Color4, rate = 18): ParticleSystem => {
  const ps = new ParticleSystem(`steam-${at.x}-${at.z}`, 120, scene);
  ps.particleTexture = puffTexture(scene);
  ps.emitter = at.clone();
  ps.minEmitBox = new Vector3(-0.3, 0, -0.3);
  ps.maxEmitBox = new Vector3(0.3, 0.05, 0.3);
  ps.direction1 = new Vector3(-0.15, 1, -0.1);
  ps.direction2 = new Vector3(0.2, 1, 0.15);
  ps.minEmitPower = 0.5;
  ps.maxEmitPower = 0.9;
  ps.minLifeTime = 2.5;
  ps.maxLifeTime = 4;
  ps.minSize = 0.6;
  ps.maxSize = 1.1;
  ps.addSizeGradient(0, 0.6);
  ps.addSizeGradient(1, 2.4);
  ps.emitRate = rate;
  ps.color1 = tint;
  ps.color2 = new Color4(tint.r * 0.8, tint.g * 0.9, tint.b, tint.a * 0.8);
  ps.colorDead = new Color4(tint.r, tint.g, tint.b, 0);
  ps.gravity = new Vector3(0.25, 0.1, 0);
  ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  ps.minAngularSpeed = -0.4;
  ps.maxAngularSpeed = 0.4;
  ps.start();
  return ps;
};

/** Raindrops bouncing off the asphalt in a box around the camera. */
export const createSplashes = (scene: Scene): { system: ParticleSystem; follow: (p: Vector3) => void } => {
  const tex = new DynamicTexture("splash-tex", { width: 16, height: 16 }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = "rgba(210,235,255,0.9)";
  ctx.beginPath();
  ctx.arc(8, 8, 3, 0, Math.PI * 2);
  ctx.fill();
  tex.update();
  tex.hasAlpha = true;
  const ps = new ParticleSystem("splashes", 900, scene);
  ps.particleTexture = tex;
  const emitter = new Vector3(0, 0.02, 0);
  ps.emitter = emitter;
  ps.minEmitBox = new Vector3(-9, 0, -9);
  ps.maxEmitBox = new Vector3(9, 0, 9);
  ps.direction1 = new Vector3(-0.6, 1, -0.6);
  ps.direction2 = new Vector3(0.6, 1.4, 0.6);
  ps.minEmitPower = 0.8;
  ps.maxEmitPower = 1.5;
  ps.minLifeTime = 0.12;
  ps.maxLifeTime = 0.22;
  ps.minSize = 0.025;
  ps.maxSize = 0.05;
  ps.emitRate = 2200;
  ps.gravity = new Vector3(0, -9.8, 0);
  ps.color1 = new Color4(0.7, 0.85, 1, 0.6);
  ps.color2 = new Color4(0.8, 0.9, 1, 0.4);
  ps.colorDead = new Color4(0.8, 0.9, 1, 0);
  ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  ps.start();
  return { system: ps, follow: (p) => emitter.set(p.x, 0.02, p.z) };
};
