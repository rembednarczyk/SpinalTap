import type { AbstractMesh } from "../babylon";
import type { CharacterRig } from "./characters";
import type { Loadouts } from "./loadout";
import type { CharacterModelKey, CharacterModelManifest, ModelInstance, ModelLibrary } from "./model-library";
import { HumanoidRetarget } from "./model-rig";
import { SpringBones, humanoidColliders } from "./spring-bones";

/** An imported model dressed over a procedural rig, which keeps animating invisibly. */
export interface Dressed {
  readonly model: ModelInstance;
  readonly retarget: HumanoidRetarget;
  /** Hair and cloth secondary motion, if the model has such bones. */
  readonly springs: SpringBones | null;
  /** Pool key: the model file. */
  readonly url: string;
}

export interface CharacterModelsDeps {
  readonly library: ModelLibrary;
  readonly loadouts: Loadouts;
  readonly addCaster: (mesh: AbstractMesh) => void;
}

/**
 * Imported models over the characters' procedural rigs (ADR-0031 part behind `CharacterViews`):
 * the manifest, loading in the background, the dressed rigs and a pool of released models per
 * file, so a cleared scene (new game, load, streaming) dresses the next characters at once.
 */
export class CharacterModels {
  private manifest: CharacterModelManifest = {};
  private readonly dressed = new Map<CharacterRig, Dressed>();
  /** Rigs whose model is still loading, so a manifest arriving meanwhile does not dress them twice. */
  private readonly loading = new Set<CharacterRig>();
  private readonly pool = new Map<string, ModelInstance[]>();

  constructor(private readonly deps: CharacterModelsDeps) {}

  /** Characters dressed in an imported model. */
  get dressedCount(): number {
    return this.dressed.size;
  }

  /** Models still loading for characters in the scene (tests wait for none before measuring). */
  get loadingCount(): number {
    return this.loading.size;
  }

  /** The model a rig wears, if it has one. */
  of(rig: CharacterRig): Dressed | undefined {
    return this.dressed.get(rig);
  }

  /** Takes a new manifest; the caller dresses the characters already on screen. */
  setManifest(manifest: CharacterModelManifest): void {
    this.manifest = manifest;
  }

  /** Starts loading every model of the manifest, one promise per file (ADR-0057). */
  preload(): Promise<unknown>[] {
    return Object.values(this.manifest).map((spec) => this.deps.library.preload(spec));
  }

  /** Loads the model in the background and swaps it in once ready, if the rig still exists. */
  dress(rig: CharacterRig, key: CharacterModelKey | null, name: string): void {
    const spec = key ? this.manifest[key] : undefined;
    if (!spec) return;
    // A model released by a cleared scene (new game, load, streaming) is reused at once.
    const pooled = this.pool.get(spec.url)?.pop();
    if (pooled) {
      this.attach(rig, pooled, spec.url, key);
      return;
    }
    this.loading.add(rig);
    this.deps.library
      .instantiate(spec, `${name}-m`)
      .then((model) => {
        this.loading.delete(rig);
        if (rig.root.isDisposed()) return this.pooled(model, spec.url);
        this.attach(rig, model, spec.url, key);
      })
      .catch((err: unknown) => {
        this.loading.delete(rig);
        console.warn(`[models] ${spec.url} failed to load`, err);
      });
  }

  /** Returns the rig's model, if any, to the pool; the loadout must be off its bones first. */
  release(rig: CharacterRig): void {
    const d = this.dressed.get(rig);
    if (d) this.pooled(d.model, d.url);
    this.dressed.delete(rig);
  }

  /** Follows the rigs: retargeted bones, springs and faces of the models on screen. */
  update(dt: number, clock: number): void {
    for (const d of this.dressed.values()) {
      if (!d.model.root.isEnabled()) continue;
      d.retarget.update();
      d.springs?.update(dt);
      d.model.face?.update(clock);
    }
  }

  private attach(rig: CharacterRig, model: ModelInstance, url: string, key: CharacterModelKey | null): void {
    model.root.setEnabled(true);
    const retarget = HumanoidRetarget.create(rig, model.root, model.prefix);
    if (!retarget) {
      console.warn(`[models] ${url}: no humanoid bones found, keeping the procedural ${key}`);
      model.dispose();
      return;
    }
    for (const m of rig.meshes) m.setEnabled(false);
    for (const m of model.meshes) if (m.getTotalVertices() > 0) this.deps.addCaster(m);
    const springs = SpringBones.create(model.root, { vrm: model.springs, prefix: model.prefix, colliders: humanoidColliders(model.root, model.prefix) });
    this.dressed.set(rig, { model, retarget, springs, url });
    // The gun in the model's hand and the garment add-ons on its bones.
    this.deps.loadouts.setModel(rig, { retarget, meshes: model.meshes });
  }

  /** Detaches a model, resets its pose and keeps it for the next character of the same look. */
  private pooled(model: ModelInstance, url: string): void {
    model.root.parent = null;
    model.root.setEnabled(false);
    model.resetPose();
    const pool = this.pool.get(url) ?? [];
    pool.push(model);
    this.pool.set(url, pool);
  }
}
