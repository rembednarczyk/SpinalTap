import { type Mesh, MeshBuilder, type Scene } from "../babylon";
import type { ToonMaterials } from "../npr/toon-material";
import type { CharacterRig } from "./character-rig";

/**
 * An enforcer's mark (ADR-0036): a glowing amber armband on the left upper arm, so the one who
 * sees through a disguise reads on the model as well as on the HUD icon. It hangs on the rig's
 * arm, which also drives an imported model, and goes with the rig.
 */
export const markEnforcer = (scene: Scene, materials: ToonMaterials, rig: CharacterRig, name: string): Mesh => {
  const band = MeshBuilder.CreateCylinder(`${name}-enforcer-band`, { height: 0.05, diameter: 0.108, tessellation: 12 }, scene);
  band.parent = rig.armL;
  band.position.set(0, -0.1, 0);
  band.material = materials.get("enforcerBand");
  band.isPickable = false;
  return band;
};
