import { Color4, DynamicTexture, ParticleSystem, type Scene, Vector3 } from "../babylon";

/** Camera-following rain: stretched additive particles in a box around the viewer. */
export const createRain = (scene: Scene): { system: ParticleSystem; follow: (p: Vector3) => void } => {
  const tex = new DynamicTexture("rain-tex", { width: 8, height: 64 }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(200,235,255,0.9)");
  ctx.fillStyle = g;
  ctx.fillRect(3, 0, 2, 64);
  tex.update();
  tex.hasAlpha = true;

  const ps = new ParticleSystem("rain", 2600, scene);
  ps.particleTexture = tex;
  const emitter = new Vector3(0, 12, 0);
  ps.emitter = emitter;
  ps.minEmitBox = new Vector3(-18, 0, -18);
  ps.maxEmitBox = new Vector3(18, 4, 18);
  ps.direction1 = new Vector3(-0.6, -1, 0.2);
  ps.direction2 = new Vector3(-0.4, -1, 0.3);
  ps.minEmitPower = 16;
  ps.maxEmitPower = 22;
  ps.minLifeTime = 0.55;
  ps.maxLifeTime = 0.8;
  ps.emitRate = 3200;
  ps.minSize = 0.05;
  ps.maxSize = 0.08;
  ps.minScaleY = 10;
  ps.maxScaleY = 16;
  ps.color1 = new Color4(0.6, 0.8, 0.95, 0.7);
  ps.color2 = new Color4(0.75, 0.9, 1, 0.5);
  ps.colorDead = new Color4(0.6, 0.8, 1, 0);
  ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
  ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  ps.updateSpeed = 1 / 60;
  ps.start();
  return { system: ps, follow: (p) => emitter.set(p.x, p.y + 10, p.z) };
};
