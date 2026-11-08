import type { AbstractMesh, Scene } from "../babylon";
import type { ToonMaterials } from "../npr/toon-material";
import type { CharacterRig } from "./characters";
import type { Loadouts } from "./loadout";
import { type ModelChoice, manifestFiles, modelPoolKey, resolveModel } from "./model-cast";
import { type Donors, type WornVariant, dressVariant, lends } from "./model-dress";
import type { CharacterModelManifest, CharacterModelSpec, ModelInstance, ModelLibrary } from "./model-library";
import { HumanoidRetarget } from "./model-rig";
import { type ModelVariant, VariantBudget, backgroundVariantOf, variantOf } from "./model-variant";
import { SpringBones, humanoidColliders } from "./spring-bones";

/** An imported model dressed over a procedural rig, which keeps animating invisibly. */
export interface Dressed {
  readonly model: ModelInstance;
  readonly retarget: HumanoidRetarget;
  /** Hair and cloth secondary motion, if the model has such bones. */
  readonly springs: SpringBones | null;
  /** Pool key: the model file with its scale, turn and variant (`modelPoolKey`). */
  readonly poolKey: string;
  /** The variant it wears (ADR-0076), taken off before the model goes back to the pool. */
  readonly worn: WornVariant;
  /** Its number, and the file whose background budget counts it (null for a named character's). */
  readonly variant: number;
  readonly budget: string | null;
}

/** The variant a character wears: its number, its look, and the file whose background budget counts it. */
interface Wearing {
  readonly id: number;
  readonly look: ModelVariant;
  readonly budget: string | null;
}

interface Attach {
  readonly poolKey: string;
  readonly who: string;
  readonly name: string;
  readonly wearing: Wearing;
  readonly donors: Donors;
}

const NO_DONORS: Donors = { torso: [], legs: [] };

export interface CharacterModelsDeps {
  readonly library: ModelLibrary;
  readonly loadouts: Loadouts;
  readonly addCaster: (mesh: AbstractMesh) => void;
  /** For the variants' materials and accessories (ADR-0076). */
  readonly scene: Scene;
  readonly materials: ToonMaterials;
}

/**
 * Imported models over the characters' procedural rigs (ADR-0031 part behind `CharacterViews`):
 * the manifest, loading in the background, the dressed rigs, their variants (ADR-0076) and a
 * pool of released models per file, so a cleared scene (new game, load, streaming) dresses the
 * next characters at once.
 */
export class CharacterModels {
  private manifest: CharacterModelManifest = {};
  private readonly dressed = new Map<CharacterRig, Dressed>();
  /** Rigs whose model is still loading, so a manifest arriving meanwhile does not dress them twice. */
  private readonly loading = new Set<CharacterRig>();
  private readonly pool = new Map<string, ModelInstance[]>();
  /** Background variants dressed per file (at most four different ones, ADR-0076 §3). */
  private readonly budget = new VariantBudget();
  /** Tops and trousers the other files of a file's base lend it, loading and loaded. */
  private readonly donors = new Map<string, Promise<Donors>>();
  private readonly donorsReady = new Map<string, Donors>();

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

  /** Different background variants of a file dressed now. */
  variantsOf(url: string): number {
    return this.budget.countOf(url);
  }

  /** Takes a new manifest; the caller dresses the characters already on screen. */
  setManifest(manifest: CharacterModelManifest): void {
    this.manifest = manifest;
    this.donors.clear();
    this.donorsReady.clear();
  }

  /** Starts loading every model of the manifest, one promise per file (ADR-0057). */
  preload(): Promise<unknown>[] {
    return manifestFiles(this.manifest).map((spec) => this.deps.library.preload(spec));
  }

  /** Loads the model in the background and swaps it in once ready, if the rig still exists. */
  dress(rig: CharacterRig, choice: ModelChoice | null, name: string): void {
    const spec = choice ? resolveModel(this.manifest, choice) : undefined;
    // A rig whose model is still on its way is dressed once: a manifest arriving meanwhile must
    // not start a second model, nor count its variant twice in the budget.
    if (!spec || !choice || this.loading.has(rig)) return;
    const poolKey = modelPoolKey(spec);
    const who = choice.cast ?? choice.fallback;
    const wearing = this.wearing(spec, choice, rig.aiming);
    const needs = wearing.look.topFrom !== null || wearing.look.bottomFrom !== null;
    // A model released by a cleared scene (new game, load, streaming) is reused at once.
    const pooled = this.pool.get(poolKey)?.pop();
    const ready = needs ? this.donorsReady.get(spec.url) : NO_DONORS;
    if (pooled && ready) {
      this.attach(rig, pooled, { poolKey, who, name, wearing, donors: ready });
      return;
    }
    this.loading.add(rig);
    Promise.all([pooled ?? this.deps.library.instantiate(spec, `${name}-m`), needs ? this.donorsOf(spec) : NO_DONORS])
      .then(([model, donors]) => {
        this.loading.delete(rig);
        if (rig.root.isDisposed()) {
          this.giveBack(wearing);
          return this.pooled(model, poolKey);
        }
        this.attach(rig, model, { poolKey, who, name, wearing, donors });
      })
      .catch((err: unknown) => {
        this.loading.delete(rig);
        this.giveBack(wearing);
        console.warn(`[models] ${spec.url} failed to load`, err);
      });
  }

  /** Returns the rig's model, if any, to the pool; the loadout must be off its bones first. */
  release(rig: CharacterRig): void {
    const d = this.dressed.get(rig);
    if (d) {
      d.worn.undo();
      this.giveBack({ id: d.variant, budget: d.budget });
      this.pooled(d.model, d.poolKey);
    }
    this.dressed.delete(rig);
    rig.reach = null;
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

  /**
   * The variant of a character: a named one's from the manifest (with its hand-made `dress`),
   * a background one's from its look within the file's budget, the file's own for the rest.
   */
  private wearing(spec: CharacterModelSpec, choice: ModelChoice, armed: boolean): Wearing {
    if (choice.cast !== undefined || choice.look === undefined || spec.variant !== undefined || spec.dress !== undefined) {
      const id = spec.variant ?? 0;
      return { id, look: variantOf(id, spec.dress), budget: null };
    }
    const id = this.budget.take(spec.url, backgroundVariantOf(choice.look));
    // Older looks only for the street's people (ADR-0076 decision 7), never for a fighter.
    const elders = !armed && (choice.pool === "civilian" || choice.pool === "vendor");
    return { id, look: variantOf(id, undefined, elders), budget: spec.url };
  }

  private giveBack(w: { readonly id: number; readonly budget: string | null }): void {
    if (w.budget !== null) this.budget.give(w.budget, w.id);
  }

  /** The tops and trousers of the other files of `spec`'s VRoid base; Seki's jacket is hers alone. */
  private donorsOf(spec: CharacterModelSpec): Promise<Donors> {
    let pending = this.donors.get(spec.url);
    if (pending) return pending;
    const { library } = this.deps;
    const heroine = this.manifest.heroine?.url;
    const files = manifestFiles(this.manifest)
      .filter((f) => f.url !== spec.url)
      .sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
    pending = Promise.all([library.clothOf(spec), ...files.map((f) => library.clothOf(f).catch(() => null))]).then(([own, ...cloth]) => {
      const lenders = files.flatMap((f, i) => {
        const c = cloth[i];
        return c && lends(c, own.family) ? [{ url: f.url, cloth: c }] : [];
      });
      const donors: Donors = {
        torso: lenders.flatMap((l) => (l.url !== heroine && l.cloth.torso ? [l.cloth.torso] : [])),
        legs: lenders.flatMap((l) => (l.cloth.legs ? [l.cloth.legs] : [])),
      };
      this.donorsReady.set(spec.url, donors);
      return donors;
    });
    this.donors.set(spec.url, pending);
    return pending;
  }

  private attach(rig: CharacterRig, model: ModelInstance, at: Attach): void {
    model.root.setEnabled(true);
    const retarget = HumanoidRetarget.create(rig, model.root, model.prefix);
    if (!retarget) {
      console.warn(`[models] ${at.poolKey}: no humanoid bones found, keeping the procedural ${at.who}`);
      this.giveBack(at.wearing);
      model.dispose();
      return;
    }
    for (const m of rig.meshes) m.setEnabled(false);
    // A smaller or taller model gets smaller or bigger accessories, within reason (as the loadouts' add-ons).
    const ratio = retarget.headHeight / (rig.head.position.y || 1);
    const fit = Number.isFinite(ratio) && ratio > 0 ? Math.min(1.25, Math.max(0.8, ratio)) : 1;
    const worn = dressVariant(this.deps, `${at.name}-v`, model.meshes, { retarget, body: rig.root, fit, rig, model }, at.wearing.look, at.donors);
    for (const m of model.meshes) if (m.getTotalVertices() > 0) this.deps.addCaster(m);
    const springs = SpringBones.create(model.root, { vrm: model.springs, prefix: model.prefix, colliders: humanoidColliders(model.root, model.prefix) });
    this.dressed.set(rig, { model, retarget, springs, poolKey: at.poolKey, worn, variant: at.wearing.id, budget: at.wearing.budget });
    // The rig solves a two-handed hold for the model's arms, which it no longer shows itself.
    rig.reach = retarget.reach;
    // The gun in the model's hand and the garment add-ons on its bones.
    this.deps.loadouts.setModel(rig, { retarget, meshes: model.meshes });
  }

  /** Detaches a model, resets its pose and keeps it for the next character of the same look. */
  private pooled(model: ModelInstance, poolKey: string): void {
    model.root.parent = null;
    model.root.setEnabled(false);
    model.resetPose();
    const pool = this.pool.get(poolKey) ?? [];
    pool.push(model);
    this.pool.set(poolKey, pool);
  }
}
