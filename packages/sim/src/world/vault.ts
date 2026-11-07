import type { Rect } from "../content/builders";

/**
 * A room under the ground (ADR-0071 stage 4: a metro platform and the stairs down to it): inside
 * `bounds` feet more than `VAULT_COVER` under the terrain stand on `floor`, under what stands in
 * it, while the street over it stays the terrain for everybody on it. Unlike a `GroundCut` the
 * terrain and the paving over it are whole: nothing shows from the street. Its walls, ceiling
 * and floors are solids; the earth round it is what the terrain is to feet below it.
 */
export interface GroundVault {
  readonly bounds: Rect;
  readonly floor: number;
}

/** Feet this far under the terrain over a vault are in it; nearer the street they are on the street. */
export const VAULT_COVER = 1;

const inside = (r: Rect, x: number, z: number): boolean => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

/** The vaults of the ground and one box round them all: almost every query is answered by that box. */
export class VaultIndex {
  private readonly box: Rect;

  constructor(private readonly vaults: readonly GroundVault[]) {
    this.box = {
      minX: Math.min(...vaults.map((v) => v.bounds.minX)),
      maxX: Math.max(...vaults.map((v) => v.bounds.maxX)),
      minZ: Math.min(...vaults.map((v) => v.bounds.minZ)),
      maxZ: Math.max(...vaults.map((v) => v.bounds.maxZ)),
    };
  }

  get empty(): boolean {
    return this.vaults.length === 0;
  }

  /** The vault over (x, z), or null. */
  at(x: number, z: number): GroundVault | null {
    if (this.vaults.length === 0 || !inside(this.box, x, z)) return null;
    for (const v of this.vaults) if (inside(v.bounds, x, z)) return v;
    return null;
  }

  /** The ground at (x, z) for feet reaching up to `reach` over the terrain at `terrain` there. */
  groundAt(x: number, z: number, terrain: number, reach: number): number {
    if (reach >= terrain - VAULT_COVER) return terrain;
    return this.at(x, z)?.floor ?? terrain;
  }

  /** The vault (x, y, z) is in, under its cover (a ray going on there is in the room, not in the earth), or null. */
  holding(x: number, y: number, z: number, terrain: number): GroundVault | null {
    return y < terrain - VAULT_COVER / 2 ? this.at(x, z) : null;
  }
}
