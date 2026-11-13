import { type Camera, CameraClass, GeometryBufferRenderer, PostProcess, type Scene, ShaderStore } from "../babylon";
import { CONTACT_BLUR_FRAGMENT, CONTACT_OCCLUSION_FRAGMENT, type ContactShade, halfTangents } from "./contact-shade";

/**
 * The two passes in front of the line art (graphics backlog 13.11, step 2): occlusion from the
 * geometry buffer into a half-resolution target, then a blur along each surface. The line art
 * thresholds the blurred value into one hard step and takes the scene's colour from the first
 * pass's input (`colourSource`), since its own input is the blurred shade.
 */
export class ContactShadePass {
  /** Its input is the rendered scene: the line art reads the colour from here. */
  readonly colourSource: PostProcess;
  private readonly blur: PostProcess;

  constructor(scene: Scene, camera: Camera, gbuffer: GeometryBufferRenderer, shade: ContactShade, fadeDistance: number, active: () => boolean) {
    ShaderStore.ShadersStore["seekiContactOcclusionFragmentShader"] = CONTACT_OCCLUSION_FRAGMENT;
    ShaderStore.ShadersStore["seekiContactBlurFragmentShader"] = CONTACT_BLUR_FRAGMENT;
    const engine = scene.getEngine();
    const depth = (): ReturnType<GeometryBufferRenderer["getGBuffer"]>["textures"][number] | null =>
      gbuffer.getGBuffer().textures[gbuffer.getTextureIndex(GeometryBufferRenderer.DEPTH_TEXTURE_TYPE)] ?? null;
    // Full-resolution input (the scene renders into it), so ratio 1; it draws into the blur's half-size input.
    this.colourSource = new PostProcess("contact-occlusion", "seekiContactOcclusion", ["shadeParams", "tanHalf"], ["depthSampler", "normalSampler"], 1, camera);
    this.colourSource.onApply = (effect) => {
      const w = engine.getRenderWidth();
      const h = engine.getRenderHeight();
      effect.setTexture("depthSampler", depth());
      effect.setTexture("normalSampler", gbuffer.getGBuffer().textures[gbuffer.getTextureIndex(GeometryBufferRenderer.NORMAL_TEXTURE_TYPE)] ?? null);
      const [tx, ty] = halfTangents(camera.fov, camera.fovMode === CameraClass.FOVMODE_HORIZONTAL_FIXED, w, h);
      effect.setFloat2("tanHalf", tx, ty);
      effect.setFloat4("shadeParams", shade.radius, active() ? shade.strength : 0, shade.threshold, fadeDistance);
    };
    this.blur = new PostProcess("contact-blur", "seekiContactBlur", ["texel"], ["depthSampler"], 0.5, camera);
    this.blur.onApply = (effect) => {
      effect.setTexture("depthSampler", depth());
      effect.setFloat2("texel", 2 / engine.getRenderWidth(), 2 / engine.getRenderHeight());
    };
  }
}
