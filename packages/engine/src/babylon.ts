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
export type { Mesh } from "@babylonjs/core/Meshes/mesh";
export type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
export { TransformNode } from "@babylonjs/core/Meshes/transformNode";
export { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
export type { Camera } from "@babylonjs/core/Cameras/camera";
export { Ray } from "@babylonjs/core/Culling/ray";
export { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
export { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
export { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";

import "@babylonjs/core/Rendering/outlineRenderer";
import "@babylonjs/core/Particles/particleSystemComponent";
import "@babylonjs/core/Layers/effectLayerSceneComponent";
import "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent";
