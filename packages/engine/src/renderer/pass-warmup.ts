import type { AbstractMesh, GeometryBufferRenderer, Scene } from "../babylon";

type SubMeshOf = AbstractMesh["subMeshes"][number];

/**
 * A pass that draws meshes with effects of its own, which `scene.isReady` does not compile: the
 * line art's geometry buffer and the inverted-hull outline. Babylon compiles them the first frame
 * a mesh is drawn in the pass, so a character that walks into view, the body shown in TPP or a
 * resident in a model the start did not show linked its programs in the game (measured 14.11:
 * two skinned geometry-buffer programs, 0.5 to 12 s of one frame under SwiftShader).
 */
export interface WarmPass {
  /** The pass draws this mesh. */
  wants(mesh: AbstractMesh): boolean;
  /** Starts (or checks) the compile of the sub-mesh's effect in this pass; true once it is ready. */
  ready(subMesh: SubMeshOf, instanced: boolean): boolean;
}

/**
 * The meshes worth compiling ahead (ADR-0057, the shaders stage): those with geometry and a
 * material, hidden or disabled ones too (the body in FPP, a pooled model, a model file's own
 * meshes that its instances clone). Instances share their source's effect and are left out.
 */
export const warmTargets = (meshes: Iterable<AbstractMesh>): AbstractMesh[] => {
  const out: AbstractMesh[] = [];
  for (const m of meshes) {
    if (m.isDisposed() || !m.material || !m.subMeshes || m.subMeshes.length === 0) continue;
    if (m.getClassName() === "InstancedMesh" || m.getTotalVertices() === 0) continue;
    out.push(m);
  }
  return out;
};

/**
 * Asks every pass for the effect of every sub-mesh it draws, all of them, so the compiles run in
 * parallel; true once all are ready. Meant to be called once a frame until it says so.
 */
export const passesReady = (meshes: readonly AbstractMesh[], passes: readonly WarmPass[], instancing: boolean): boolean => {
  let ready = true;
  for (const pass of passes) {
    for (const mesh of meshes) {
      if (!pass.wants(mesh)) continue;
      const instanced = instancing && (mesh.hasInstances || mesh.hasThinInstances);
      for (const subMesh of mesh.subMeshes) if (!pass.ready(subMesh, instanced)) ready = false;
    }
  }
  return ready;
};

/**
 * The line art's geometry buffer. Its effects live on the sub-mesh under the buffer's render
 * pass, the one current while it draws; asked outside it, the effect would land in the main
 * pass's slot instead, so the pass is made current for the ask. Meshes the buffer never draws
 * are left out: no depth write (it would never be ready) and, as the renderer sets it, the
 * transparent ones.
 */
export const geometryBufferPass = (scene: Scene, gbuffer: GeometryBufferRenderer): WarmPass => {
  const engine = scene.getEngine();
  const draws = (subMesh: SubMeshOf): boolean => {
    const material = subMesh.getMaterial();
    if (!material || material.disableDepthWrite) return false;
    return gbuffer.renderTransparentMeshes || !material.needAlphaBlendingForMesh(subMesh.getRenderingMesh());
  };
  return {
    wants: () => true,
    ready: (subMesh, instanced) => {
      if (!draws(subMesh)) return true;
      const current = engine.currentRenderPassId;
      engine.currentRenderPassId = gbuffer.getGBuffer().renderPassId;
      try {
        return gbuffer.isReady(subMesh, instanced);
      } finally {
        engine.currentRenderPassId = current;
      }
    },
  };
};

/** The inverted-hull outline (`applyOutline`), for the meshes that draw one now. */
export const outlinePass = (scene: Scene): WarmPass => ({
  wants: (mesh) => mesh.renderOutline,
  ready: (subMesh, instanced) => scene.getOutlineRenderer().isReady(subMesh, instanced),
});

/**
 * The extra passes of the scene's meshes and of `more` (a loaded file's own meshes), ready or
 * not; the shaders stage of the loading screen waits for true (ADR-0057).
 */
export const scenePassesReady = (scene: Scene, gbuffer: GeometryBufferRenderer | null, more: () => Iterable<AbstractMesh>): (() => boolean) => {
  const passes = [...(gbuffer ? [geometryBufferPass(scene, gbuffer)] : []), outlinePass(scene)];
  const instancing = !!scene.getEngine().getCaps().instancedArrays;
  return () => passesReady(warmTargets([...scene.meshes, ...more()]), passes, instancing);
};
