import { Color3, type Mesh, MeshBuilder, type Scene, StandardMaterial, TransformNode, Vector3 } from "../babylon";
import type { ToonMaterials } from "../npr/toon-material";
import { type ActivityProp, emberGlow } from "./activity-poses";
import type { CharacterRig } from "./character-rig";
import type { HumanoidRetarget } from "./model-rig";

/** Forearm plus hand over upper arm, from the humanoid build (0.305 s over 0.28 s). */
const HAND_REACH = 0.305 / 0.28;

/** Beyond this distance from the camera the held things are not drawn (a few pixels each). */
export const PROP_DRAW_DISTANCE = 16;

/** Small things a character holds in an activity, built on demand and kept while it lasts. */
export class ActivityProps {
  private readonly ember: StandardMaterial;

  constructor(
    private readonly scene: Scene,
    private readonly materials: ToonMaterials,
  ) {
    this.ember = new StandardMaterial("activity-ember", scene);
    this.ember.disableLighting = true;
    this.ember.emissiveColor = Color3.FromHexString("#ff6a1a");
  }

  /** The prop's node, posed in the hand (or under the hips), with its meshes. */
  build(kind: ActivityProp, rig: CharacterRig, name: string): { node: TransformNode; meshes: Mesh[]; tip: Mesh | null; hand: "left" | "right" | null } {
    const node = new TransformNode(`${name}-${kind}`, this.scene);
    const meshes: Mesh[] = [];
    let tip: Mesh | null = null;
    const box = (w: number, h: number, d: number, preset: Parameters<ToonMaterials["get"]>[0], x = 0, y = 0, z = 0): Mesh => {
      const m = MeshBuilder.CreateBox(`${name}-${kind}-${meshes.length}`, { width: w, height: h, depth: d }, this.scene);
      m.material = this.materials.get(preset);
      m.parent = node;
      m.position.set(x, y, z);
      m.isPickable = false;
      meshes.push(m);
      return m;
    };
    switch (kind) {
      case "cigarette": {
        box(0.012, 0.012, 0.08, "umeHair", 0, 0, 0.05);
        tip = MeshBuilder.CreateSphere(`${name}-ember`, { diameter: 0.018, segments: 4 }, this.scene);
        tip.material = this.ember;
        tip.parent = node;
        tip.position.set(0, 0, 0.092);
        tip.isPickable = false;
        meshes.push(tip);
        break;
      }
      case "phone":
        box(0.07, 0.14, 0.012, "gun", 0, -0.02, 0.03);
        break;
      case "can":
        box(0.065, 0.12, 0.065, "umbrella", 0, -0.02, 0.04);
        break;
      case "bowl":
        box(0.15, 0.06, 0.15, "umeCoat", 0, -0.01, 0.06);
        break;
      case "broom":
        box(0.03, 1.25, 0.03, "fixerJacket", 0, -0.35, 0);
        box(0.3, 0.12, 0.08, "umeHair", 0, -0.98, 0);
        break;
      case "stool":
        box(1, 1, 1, "metal");
        break;
    }
    const hand = kind === "stool" ? null : kind === "bowl" ? "left" : "right";
    if (hand) {
      const elbow = hand === "left" ? rig.elbowL : rig.elbowR;
      node.parent = elbow;
      node.position.set(0, elbow.position.y * HAND_REACH, 0);
    } else node.parent = rig.root;
    // The broom hangs down from the fist, tipped forward towards the floor.
    if (kind === "broom") node.rotation.x = 0.5;
    return { node, meshes, tip, hand };
  }

  /** Moves a right-hand prop into an imported model's hand (it follows the rig forearm's turn). */
  holdOnModel(node: TransformNode, retarget: HumanoidRetarget): boolean {
    return retarget.holdInRightHand(node, new Vector3(0, -0.05, 0));
  }

  /** Each frame: the stool under the hips, the cigarette's glow. */
  update(rig: CharacterRig, stool: TransformNode | null, tip: Mesh | null, time: number): void {
    if (stool) {
      const seat = Math.max(0.2, rig.legL.position.y + rig.body.position.y - 0.1);
      stool.position.set(0, seat / 2, rig.body.position.z);
      stool.scaling.set(0.42, seat, 0.4);
    }
    if (tip) tip.scaling.setAll(0.7 + 0.6 * emberGlow(time));
  }
}
