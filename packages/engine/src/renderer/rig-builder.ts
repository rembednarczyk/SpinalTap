import { CreateLathe, type Mesh, MeshBuilder, MeshClass, type Scene, TransformNode, Vector3 } from "../babylon";
import type { PresetName } from "../npr/presets";
import type { ToonMaterials } from "../npr/toon-material";

export type Profile = readonly (readonly [radius: number, y: number])[];

/** Collects the loose parts of a procedural character, each with its toon preset. */
export class RigBuilder {
  readonly meshes: Mesh[] = [];
  readonly presets = new Map<Mesh, PresetName>();
  constructor(
    readonly scene: Scene,
    readonly materials: ToonMaterials,
    readonly name: string,
  ) {}

  node(name: string, parent: TransformNode, x = 0, y = 0, z = 0): TransformNode {
    const n = new TransformNode(`${this.name}-${name}`, this.scene);
    n.parent = parent;
    n.position.set(x, y, z);
    return n;
  }

  private finishPart(m: Mesh, preset: PresetName, parent: TransformNode, x: number, y: number, z: number): Mesh {
    m.material = this.materials.get(preset);
    m.parent = parent;
    m.position.set(x, y, z);
    m.isPickable = false;
    this.presets.set(m, preset);
    this.meshes.push(m);
    return m;
  }

  /** Surface of revolution around local Y. Profile points are (radius, y), bottom to top. */
  lathe(profile: Profile, preset: PresetName, parent: TransformNode, opts: { x?: number; y?: number; z?: number; depth?: number; arc?: number; tessellation?: number } = {}): Mesh {
    const m = CreateLathe(
      `${this.name}-l${this.meshes.length}`,
      {
        shape: profile.map(([r, y]) => new Vector3(r, y, 0)),
        tessellation: opts.tessellation ?? 16,
        arc: opts.arc ?? 1,
        cap: MeshClass.CAP_ALL,
        sideOrientation: MeshClass.DOUBLESIDE,
      },
      this.scene,
    );
    if (opts.depth !== undefined) m.scaling.z = opts.depth;
    return this.finishPart(m, preset, parent, opts.x ?? 0, opts.y ?? 0, opts.z ?? 0);
  }

  sphere(diameter: number, preset: PresetName, parent: TransformNode, x = 0, y = 0, z = 0, scale?: [number, number, number]): Mesh {
    const m = MeshBuilder.CreateSphere(`${this.name}-s${this.meshes.length}`, { diameter, segments: 12 }, this.scene);
    if (scale) m.scaling.set(...scale);
    return this.finishPart(m, preset, parent, x, y, z);
  }

  box(w: number, h: number, d: number, preset: PresetName, parent: TransformNode, x = 0, y = 0, z = 0): Mesh {
    const m = MeshBuilder.CreateBox(`${this.name}-b${this.meshes.length}`, { width: w, height: h, depth: d }, this.scene);
    return this.finishPart(m, preset, parent, x, y, z);
  }

  cylinder(height: number, top: number, bottom: number, preset: PresetName, parent: TransformNode, x = 0, y = 0, z = 0): Mesh {
    const m = MeshBuilder.CreateCylinder(`${this.name}-c${this.meshes.length}`, { height, diameterTop: top, diameterBottom: bottom, tessellation: 14 }, this.scene);
    return this.finishPart(m, preset, parent, x, y, z);
  }

  torus(diameter: number, thickness: number, preset: PresetName, parent: TransformNode, x = 0, y = 0, z = 0): Mesh {
    const m = MeshBuilder.CreateTorus(`${this.name}-t${this.meshes.length}`, { diameter, thickness, tessellation: 18 }, this.scene);
    return this.finishPart(m, preset, parent, x, y, z);
  }
}
