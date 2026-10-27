import {
  type AbstractMesh,
  type AnimationGroup,
  type AssetContainer,
  LoadAssetContainerAsync,
  type Scene,
  type TransformNode,
  loadGltfPlugin,
} from "../babylon";
import { convertModelMaterials, outlineModelMeshes, pluginExtensionFor } from "./model-library";
import type { PresetName } from "../npr/presets";
import type { ToonMaterials } from "../npr/toon-material";

export interface ToonModelOptions {
  /** Preset for everything except colour (rim, fill, outline): character or prop. */
  readonly preset?: PresetName;
  readonly outline?: boolean;
  /** Uniform scale applied to the model root, e.g. to bring a VRoid export to metres. */
  readonly scale?: number;
}

export interface ToonModel {
  readonly root: TransformNode;
  readonly meshes: AbstractMesh[];
  readonly animations: AnimationGroup[];
  dispose(): void;
}

/**
 * Imports a glTF/GLB model (characters from VRoid or a 3D artist, props from asset packs)
 * and swaps its materials for the shared toon materials, keeping base colour and texture.
 * Skeletons and animation groups are kept: the toon shader skins on the GPU.
 */
export const loadToonModel = async (scene: Scene, materials: ToonMaterials, source: string, options: ToonModelOptions = {}): Promise<ToonModel> => {
  await loadGltfPlugin();
  const container: AssetContainer = await LoadAssetContainerAsync(source, scene, { pluginExtension: pluginExtensionFor(source) });
  convertModelMaterials(container, materials, options.preset ?? "importedCharacter");
  outlineModelMeshes(container.meshes, options.outline ?? true);
  container.addAllToScene();
  const root = (container.rootNodes[0] ?? container.meshes[0]) as TransformNode;
  if (options.scale !== undefined) root.scaling.scaleInPlace(options.scale);
  return {
    root,
    meshes: container.meshes,
    animations: container.animationGroups,
    dispose: () => container.dispose(),
  };
};
