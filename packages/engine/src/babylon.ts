/**
 * The only module that imports Babylon.js. Deep imports keep the bundle tree-shakeable;
 * the side-effect imports at the bottom register the scene components the engine uses.
 */
export { Engine } from "@babylonjs/core/Engines/engine";
export { Scene } from "@babylonjs/core/scene";
export { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
export { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
export { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
export { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
export { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
export { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
export { ColorCurves } from "@babylonjs/core/Materials/colorCurves";
export { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
export { CreateLathe } from "@babylonjs/core/Meshes/Builders/latheBuilder";
export type { Mesh } from "@babylonjs/core/Meshes/mesh";
export type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
export { TransformNode } from "@babylonjs/core/Meshes/transformNode";
export { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
export type { Camera } from "@babylonjs/core/Cameras/camera";
export { Ray } from "@babylonjs/core/Culling/ray";
export { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
export { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
export { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";
export { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
export { Texture } from "@babylonjs/core/Materials/Textures/texture";
export type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
export { Constants } from "@babylonjs/core/Engines/constants";
export { Camera as CameraClass } from "@babylonjs/core/Cameras/camera";
export { PostProcess } from "@babylonjs/core/PostProcesses/postProcess";
export { ShaderStore } from "@babylonjs/core/Engines/shaderStore";
export { GeometryBufferRenderer } from "@babylonjs/core/Rendering/geometryBufferRenderer";
export { Mesh as MeshClass } from "@babylonjs/core/Meshes/mesh";
export { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
export { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
export { Bone } from "@babylonjs/core/Bones/bone";
export { Skeleton } from "@babylonjs/core/Bones/skeleton";
export { Quaternion } from "@babylonjs/core/Maths/math.vector";
export { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
export type { AssetContainer } from "@babylonjs/core/assetContainer";
export type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";

/** glTF 2.0 support is loaded on demand so the base bundle stays small. */
export const loadGltfPlugin = async (): Promise<void> => {
  await import("@babylonjs/loaders/glTF/2.0");
};

import "@babylonjs/core/Rendering/outlineRenderer";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent";
import "@babylonjs/core/Shaders/ShadersInclude/instancesDeclaration";
import "@babylonjs/core/Shaders/ShadersInclude/instancesVertex";
import "@babylonjs/core/Shaders/ShadersInclude/bonesDeclaration";
import "@babylonjs/core/Shaders/ShadersInclude/bonesVertex";
import "@babylonjs/core/Particles/particleSystemComponent";
import "@babylonjs/core/Layers/effectLayerSceneComponent";
import "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent";
