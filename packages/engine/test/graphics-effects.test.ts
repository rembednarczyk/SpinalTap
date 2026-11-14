import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { FreeCamera, type GeometryBufferRenderer, type PostProcess, Scene, Vector3 } from "../src/babylon";
import { GameplayPost } from "../src/effects/gameplay-post";
import { CONTACT_SHADE } from "../src/npr/contact-shade";
import { graphicsEffectsOf } from "../src/npr/graphics-effects";
import { Grading } from "../src/npr/grading";
import { LINE_ART_FRAGMENT, LineArt, shadeDefines } from "../src/npr/line-art";

/** The chain as the High renderer builds it: line art (with the shade in front), the grade, the gameplay overlay. */
const highChain = (shade = true, bloom = 0.55) => {
  const engine = new NullEngine();
  // Post-processes clamp their samples to the GPU's; a WebGL2 GPU allows four or more.
  engine.getCaps().maxMSAASamples = 4;
  const scene = new Scene(engine);
  // The null engine has no multiple render targets: a geometry buffer that only answers the setup
  // (no frame is drawn here, so nothing samples it).
  const gbuffer = { enableNormal: false, enableDepth: false, renderTransparentMeshes: true, getGBuffer: () => ({ textures: [] }), getTextureIndex: () => 0 };
  scene.enableGeometryBufferRenderer = () => gbuffer as unknown as GeometryBufferRenderer;
  const camera = new FreeCamera("eye", new Vector3(0, 2, -5), scene);
  const lineArt = new LineArt(scene, camera, { contactShade: shade ? CONTACT_SHADE : null });
  const grading = new Grading(scene, camera, { reference: true, sharpen: 0.25, bloom });
  const post = new GameplayPost(scene, camera);
  lineArt.postProcess.samples = 1;
  const names = () => camera._postProcesses.filter((p): p is PostProcess => p !== null).map((p) => p.name);
  const first = () => camera._postProcesses.find((p): p is PostProcess => p !== null);
  return { scene, camera, lineArt, grading, post, names, first };
};

const bloomIn = (names: string[]) => names.some((n) => /bloom/i.test(n));

describe("graphics toggles of the High effects (14.11)", () => {
  it("only High builds the contact shade and the bloom the options can switch", () => {
    expect(graphicsEffectsOf("high")).toEqual({ contactShade: true, bloom: true });
    expect(graphicsEffectsOf("medium")).toEqual({ contactShade: false, bloom: false });
    expect(graphicsEffectsOf("low")).toEqual({ contactShade: false, bloom: false });
  });

  it("takes both contact-shade passes off the chain and puts them back in front of the line art", () => {
    const c = highChain();
    expect(c.names().slice(0, 3)).toEqual(["contact-occlusion", "contact-blur", "line-art"]);
    c.first()!.samples = 2;
    c.lineArt.setContactShade(false);
    expect(c.lineArt.contactShade).toBe(false);
    expect(c.names()).not.toContain("contact-occlusion");
    expect(c.names()).not.toContain("contact-blur");
    expect(c.names()[0]).toBe("line-art");
    // The scene renders into the line art now: the multisampling went with it.
    expect(c.lineArt.postProcess.samples).toBe(2);
    c.lineArt.setContactShade(true);
    expect(c.names().slice(0, 3)).toEqual(["contact-occlusion", "contact-blur", "line-art"]);
    expect(c.first()!.samples).toBe(2);
    expect(c.lineArt.postProcess.samples).toBe(1);
    // Back in their own slots: switching does not grow the chain.
    const length = c.camera._postProcesses.length;
    c.lineArt.setContactShade(false);
    c.lineArt.setContactShade(true);
    expect(c.camera._postProcesses.length).toBe(length);
  });

  it("reads the scene without the shade, through a define the setting switches", () => {
    expect(shadeDefines(true)).toBe("#define SHADED");
    expect(shadeDefines(false)).toBe("");
    expect(LINE_ART_FRAGMENT).toContain("#ifdef SHADED");
    expect(LINE_ART_FRAGMENT).toMatch(/#else\s+vec4 base = texture2D\(textureSampler, vUV\);/);
  });

  it("ignores the contact-shade setting where the quality builds no shade", () => {
    const c = highChain(false);
    const before = c.names();
    expect(c.lineArt.hasContactShade).toBe(false);
    c.lineArt.setContactShade(true);
    c.lineArt.setContactShade(false);
    expect(c.names()).toEqual(before);
  });

  it("drops the bloom from the grade and brings it back, the gameplay overlay staying last", () => {
    const c = highChain();
    c.post.update({ time: 0, aberration: 0, glitch: 0, scan: 1, heat: 0, heatMix: 0, hurt: 0, blur: 0, reduce: 0 }, true);
    expect(bloomIn(c.names())).toBe(true);
    expect(c.names().at(-1)).toBe("gameplay-fx");
    expect(c.grading.setBloom(false)).toBe(true);
    c.post.moveToEnd();
    expect(bloomIn(c.names())).toBe(false);
    expect(c.names().at(-1)).toBe("gameplay-fx");
    expect(c.names().slice(0, 3)).toEqual(["contact-occlusion", "contact-blur", "line-art"]);
    expect(c.grading.setBloom(false)).toBe(false);
    expect(c.grading.setBloom(true)).toBe(true);
    c.post.moveToEnd();
    expect(bloomIn(c.names())).toBe(true);
    expect(c.names().at(-1)).toBe("gameplay-fx");
  });

  it("has no bloom to switch where the quality builds none", () => {
    const c = highChain(true, 0);
    expect(c.grading.hasBloom).toBe(false);
    expect(c.grading.setBloom(true)).toBe(false);
    expect(bloomIn(c.names())).toBe(false);
  });
});
