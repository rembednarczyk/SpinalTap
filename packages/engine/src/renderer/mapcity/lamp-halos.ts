import type { StreetPropKind } from "@seki/core";
import { type Mesh, type Scene, Vector3 } from "../../babylon";
import type { RenderQuality } from "../../npr/quality";
import type { ToonMaterials } from "../../npr/toon-material";
import { sinkToMesh } from "../dressing";
import { MeshSink } from "../mesh-sink";
import { LampStreakFeed, type StreakLamp } from "./lamp-streak-feed";
import { planHalos, poolLights } from "./prop-batch";
import { type PropBlock, sortedPieces } from "./prop-block";
import { PropHaloMaterial } from "./prop-halo";
import { propModel } from "./prop-models";
import type { PropPoles } from "./prop-poles";
import { poleLights } from "./utility-poles";

/** The kinds that light the street at night and get halos. */
const LIT = (kind: StreetPropKind): boolean => kind.startsWith("lamp-") || kind === "floodlight";

/**
 * The halos of every lamp of the city (ADR-0047) in one additive mesh, outside the G-buffer,
 * shadow and glow: built from the blocks, shown at night, faded by day and into the fog.
 */
export class LampHalos {
  private readonly halo: PropHaloMaterial;
  private haloMesh: Mesh | null = null;
  private night = 1;
  private fog = -1;
  /** Their streaks on the wet street, drawn by the ground (ADR-0084). */
  private readonly streaks: LampStreakFeed;

  constructor(
    private readonly scene: Scene,
    materials: ToonMaterials,
    quality: RenderQuality,
  ) {
    this.halo = new PropHaloMaterial(scene);
    this.streaks = new LampStreakFeed(materials.wet, quality);
  }

  /** The halo mesh, or null while no lamp stands. */
  get mesh(): Mesh | null {
    return this.haloMesh;
  }

  /** The scene's fog density now: the halos fade into it when it changes. */
  setFog(fogDensity: number): void {
    if (fogDensity === this.fog) return;
    this.fog = fogDensity;
    this.halo.setLook(1 - this.night, this.fog);
  }

  /** Shows the halos at night only; the streaks of the lamps near the eye. */
  show(eye: { x: number; z: number }): void {
    this.haloMesh?.setEnabled(this.night > 0.02);
    const cam = this.scene.activeCamera;
    const f = cam ? cam.getDirection(Vector3.Forward()) : null;
    this.streaks.aim(eye, f ? { x: f.x, z: f.z } : null);
  }

  /** Day 0 .. 1, clamped (ADR-0017): the halos go out by day. */
  setDaylight(day: number): void {
    this.night = 1 - day;
    this.halo.setLook(day, Math.max(this.fog, 0));
    this.streaks.setNight(this.night);
  }

  /** Builds the halos again for the lamps of the blocks, in the order of their keys. */
  build(blocks: ReadonlyMap<string, PropBlock>, poles: PropPoles): void {
    this.haloMesh?.dispose(false, false);
    this.haloMesh = null;
    const sink = new MeshSink();
    const pole = poles.pole;
    const poleLit = pole ? poleLights(pole) : [];
    const lamps: StreakLamp[] = [];
    for (const key of [...blocks.keys()].sort()) {
      for (const p of sortedPieces(blocks.get(key)!)) {
        if (!LIT(p.prop)) continue;
        const lights = poles.isPole(p) ? poleLit : propModel(p.prop, p.shape).lights;
        planHalos(sink, p, lights);
        for (const l of poolLights(p, lights)) lamps.push({ ...l, seed: lamps.length % 97 });
      }
    }
    this.streaks.setLamps(lamps);
    if (sink.empty) return;
    this.haloMesh = sinkToMesh(this.scene, "props-halo", sink, true);
    this.haloMesh.material = this.halo.material;
    this.haloMesh.setEnabled(false);
  }
}
