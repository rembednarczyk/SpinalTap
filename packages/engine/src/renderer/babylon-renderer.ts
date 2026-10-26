import { type AbstractMesh, Vector3 } from "../babylon";
import type { CameraMode, EffectDescriptor, EntityId, RenderPort, Transform, ViewDescriptor } from "@seki/core";
import { CameraRig } from "../camera/camera-rig";
import { Effects } from "../effects/effects";
import { createRain } from "../effects/rain";
import { Grading } from "../npr/grading";
import { ToonMaterials } from "../npr/toon-material";
import { type CharacterRig, animateRig, buildCivilian, buildFixer, buildGanger, buildHeroine } from "./characters";
import { type PropView, buildBlock, buildLamp, buildNeon } from "./props";
import type { Stage } from "./stage";

type Spawned =
  | { kind: "character"; rig: CharacterRig; transform: Transform }
  | { kind: "prop"; prop: PropView; lightKey: string | null };

const v3 = (p: { x: number; y: number; z: number }) => new Vector3(p.x, p.y, p.z);

/** RenderPort over Babylon.js. Turns entity view descriptors into NPR meshes and drives the camera. */
export class BabylonRenderer implements RenderPort {
  readonly materials: ToonMaterials;
  readonly rig: CameraRig;
  readonly grading: Grading;
  private readonly effects: Effects;
  private readonly rain: ReturnType<typeof createRain> | null;
  private readonly entities = new Map<EntityId, Spawned>();
  private readonly blockers = new Set<AbstractMesh>();
  private cameraTarget: EntityId | null = null;

  constructor(private readonly stage: Stage) {
    const { scene } = stage;
    this.materials = new ToonMaterials(scene);
    this.rig = new CameraRig(scene, this.materials, (m) => this.blockers.has(m));
    this.rig.onBodyVisibility = (visible) => this.setPlayerBodyVisible(visible);
    this.grading = new Grading(scene, this.rig.camera, { reference: stage.options.reference });
    this.effects = new Effects(scene, stage.glow);
    this.rain = stage.options.reference ? null : createRain(scene);
  }

  spawn(id: EntityId, view: ViewDescriptor, t: Transform): void {
    if (this.entities.has(id)) this.despawn(id);
    const { scene } = this.stage;
    const name = `e${id}`;
    switch (view.kind) {
      case "heroine":
      case "npc":
      case "enemy": {
        const build =
          view.kind === "heroine" ? buildHeroine : view.kind === "enemy" ? buildGanger : view.preset === "fixer" ? buildFixer : buildCivilian;
        const rig = build(scene, this.materials, name);
        this.entities.set(id, { kind: "character", rig, transform: t });
        this.applyTransform(rig, t);
        return;
      }
      case "block":
      case "neon":
      case "lamp": {
        const at = v3(t.position);
        const prop =
          view.kind === "block"
            ? buildBlock(scene, this.materials, name, view, at)
            : view.kind === "neon"
              ? buildNeon(scene, name, view, at)
              : buildLamp(scene, this.materials, name, view.color, at);
        for (const m of prop.glowing) this.stage.glow.addIncludedOnlyMesh(m);
        for (const m of prop.blockers) this.blockers.add(m);
        const lightKey = prop.light ? name : null;
        if (prop.light && lightKey) this.materials.addLight(lightKey, prop.light);
        this.entities.set(id, { kind: "prop", prop, lightKey });
        return;
      }
    }
  }

  updateTransform(id: EntityId, t: Transform): void {
    const e = this.entities.get(id);
    if (e?.kind !== "character") return;
    e.transform = t;
    this.applyTransform(e.rig, t);
  }

  despawn(id: EntityId): void {
    const e = this.entities.get(id);
    if (!e) return;
    this.entities.delete(id);
    if (e.kind === "character") {
      e.rig.root.dispose(false, false);
      return;
    }
    for (const m of e.prop.blockers) this.blockers.delete(m);
    if (e.lightKey) this.materials.removeLight(e.lightKey);
    e.prop.root.dispose(false, false);
  }

  setCameraMode(mode: CameraMode): void {
    this.rig.setMode(mode);
  }

  attachCamera(id: EntityId): void {
    this.cameraTarget = id;
  }

  playEffect(effect: EffectDescriptor): void {
    switch (effect.kind) {
      case "muzzle-flash": {
        const own = effect.shooterId === this.cameraTarget;
        const from = (own ? this.rig.muzzlePosition() : null) ?? v3(effect.from);
        this.effects.muzzleFlash(from, v3(effect.to));
        if (own) this.rig.kick();
        return;
      }
      case "hit-spark":
        this.effects.hitSpark(v3(effect.at), effect.critical);
        return;
      case "memory-glitch":
        this.grading.glitch();
        return;
    }
  }

  /** Per-frame presentation update: animation, camera, VFX, rain. Call before scene.render(). */
  frame(dt: number): void {
    for (const e of this.entities.values()) if (e.kind === "character") animateRig(e.rig, e.transform.speed, dt);
    const target = this.cameraTarget === null ? undefined : this.entities.get(this.cameraTarget);
    this.rig.update(target?.kind === "character" ? target.transform : null, dt);
    this.effects.update(dt);
    this.grading.update(dt);
    this.rain?.follow(this.rig.camera.position);
  }

  get entityCount(): number {
    return this.entities.size;
  }

  private applyTransform(rig: CharacterRig, t: Transform): void {
    rig.root.position.set(t.position.x, t.position.y, t.position.z);
    rig.root.rotation.y = t.yaw;
  }

  private setPlayerBodyVisible(visible: boolean): void {
    const target = this.cameraTarget === null ? undefined : this.entities.get(this.cameraTarget);
    if (target?.kind !== "character") return;
    if (target.rig.root.isEnabled() !== visible) target.rig.root.setEnabled(visible);
  }
}
