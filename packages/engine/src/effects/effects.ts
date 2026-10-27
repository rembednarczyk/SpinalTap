import { Color3, type GlowLayer, Matrix, type Mesh, MeshBuilder, type Scene, StandardMaterial, Vector3 } from "../babylon";

interface Live {
  mesh: Mesh;
  ttl: number;
  life: number;
  grow: number;
}

const POOL = 10;

/** Pooled, short-lived combat VFX: tracers, muzzle flashes and impact sparks. */
export class Effects {
  private readonly tracers: Mesh[] = [];
  private readonly flashes: Mesh[] = [];
  private readonly sparks: Mesh[] = [];
  private readonly live: Live[] = [];
  private cursor = { tracer: 0, flash: 0, spark: 0 };

  constructor(scene: Scene, glow: GlowLayer) {
    const emissive = (name: string, hex: string) => {
      const m = new StandardMaterial(name, scene);
      m.disableLighting = true;
      m.emissiveColor = Color3.FromHexString(hex);
      return m;
    };
    const tracerMat = emissive("fx-tracer", "#ffe7a8");
    const flashMat = emissive("fx-flash", "#fff2c0");
    const sparkMat = emissive("fx-spark", "#ffb347");
    const critMat = emissive("fx-crit", "#ff3d8b");
    for (let i = 0; i < POOL; i++) {
      const t = MeshBuilder.CreateCylinder(`fx-tracer-${i}`, { height: 1, diameter: 0.025, tessellation: 5 }, scene);
      t.bakeTransformIntoVertices(Matrix.RotationX(Math.PI / 2).multiply(Matrix.Translation(0, 0, 0.5)));
      t.material = tracerMat;
      const f = MeshBuilder.CreateSphere(`fx-flash-${i}`, { diameter: 0.16, segments: 6 }, scene);
      f.material = flashMat;
      const s = MeshBuilder.CreateSphere(`fx-spark-${i}`, { diameter: 0.12, segments: 6 }, scene);
      s.material = sparkMat;
      s.metadata = { normal: sparkMat, crit: critMat };
      for (const m of [t, f, s]) {
        m.isPickable = false;
        m.setEnabled(false);
        glow.addIncludedOnlyMesh(m);
      }
      this.tracers.push(t);
      this.flashes.push(f);
      this.sparks.push(s);
    }
  }

  muzzleFlash(from: Vector3, to: Vector3): void {
    const tracer = this.take(this.tracers, "tracer");
    const len = Vector3.Distance(from, to);
    tracer.position.copyFrom(from);
    tracer.scaling.set(1, 1, Math.max(0.01, len));
    tracer.lookAt(to);
    this.spawn(tracer, 0.06, 0);
    const flash = this.take(this.flashes, "flash");
    flash.position.copyFrom(from);
    this.spawn(flash, 0.05, 2);
  }

  hitSpark(at: Vector3, critical: boolean): void {
    const spark = this.take(this.sparks, "spark");
    const mats = spark.metadata as { normal: StandardMaterial; crit: StandardMaterial };
    spark.material = critical ? mats.crit : mats.normal;
    spark.position.copyFrom(at);
    this.spawn(spark, critical ? 0.22 : 0.14, critical ? 9 : 5);
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const fx = this.live[i];
      if (!fx) continue;
      fx.ttl -= dt;
      if (fx.ttl <= 0) {
        fx.mesh.setEnabled(false);
        this.live.splice(i, 1);
        continue;
      }
      const k = 1 + (1 - fx.ttl / fx.life) * fx.grow;
      if (fx.grow > 0) fx.mesh.scaling.setAll(k);
      fx.mesh.visibility = fx.ttl / fx.life;
    }
  }

  private take(pool: Mesh[], kind: keyof Effects["cursor"]): Mesh {
    const mesh = pool[this.cursor[kind] % pool.length] as Mesh;
    this.cursor[kind] += 1;
    const existing = this.live.findIndex((l) => l.mesh === mesh);
    if (existing >= 0) this.live.splice(existing, 1);
    return mesh;
  }

  private spawn(mesh: Mesh, life: number, grow: number): void {
    if (grow > 0) mesh.scaling.setAll(1);
    mesh.visibility = 1;
    mesh.setEnabled(true);
    this.live.push({ mesh, ttl: life, life, grow });
  }
}
