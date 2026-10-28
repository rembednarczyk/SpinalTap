# Cyberpunk visual techniques for real-time WebGL/Babylon.js NPR (Seki Senshi)

Scope: how cyberpunk games and anime build their look, and how to get it in Babylon.js 9 with a toon/cel pipeline on mid-range laptops and phones (SwiftShader in CI as the worst case). Notes in English. Items under "Inferences" are engineering judgement or general Babylon/WebGL practice that I did not re-verify with a source in this session; treat them as proposals to benchmark, not facts.

## 1. Color and lighting language (C2077, Edgerunners) and mapping Trigger style to 3D NPR

### Takeaway
The C2077 brand palette is loud yellow / magenta / blue-cyan. Night City lighting is graded like a film shot with a custom LUT, and lighting is scripted per location. Edgerunners adds flat, saturated cel blocks, red splashes, neon haze and per-frame color shifts during action. In NPR all of this maps onto: a fixed palette LUT, toon ramps per district, strong rim light in a neon key color, and color-shift/"smear frame" effects reserved for gameplay moments (Sandevistan-like slow-mo, cyberpsychosis).

### Cited Findings
- The Edgerunners intro reportedly uses the loud yellow/magenta/blue scheme of Cyberpunk 2077's marketing and logo. — [PC Gamer](https://pcgamer.com/heres-the-flashy-intro-to-netflixs-upcoming-cyberpunk-2077-anime)
- Gizmodo's review: the show drenches the city in distinct hues, including red splashes, neon haze from streetlights, and the bright yellow from the game's marketing (David's jacket). — [Gizmodo](https://gizmodo.com/cyberpunk-edgerunners-netflix-trigger-review-spoilers-1849529423/2)
- Imaishi (director): the slow-motion Sandevistan sequences spread out frames that would normally be skipped, "showcased each frame with a lot of care". AWN describes each bullet-time frame as rendered in a different color tone. For the "deep dive" network scenes the team "drew reference from old-school analogs" instead of copying the game's digital pixels. — [AWN](https://awn.com/animationworld/cyberpunk-edgerunners-vibrant-ode-retro-anime)
- Yoshinari (character designer): the frame-spreading slow-mo is "a style that actually existed in Japanese anime from older days… We dusted it off". AWN calls the look crisp modern 2D with nostalgic 70s–90s imagery (Ghost in the Shell window framing, Akira-style bikes). — [AWN](https://awn.com/animationworld/cyberpunk-edgerunners-vibrant-ode-retro-anime)
- The official artbook (318 pages) contains colour guides and character sheets, with chapter commentary by Imaishi. One reviewer found it light on hard details. — [Reframe review](https://buttondown.com/reframe/archive/cyberpunk-edgerunners-artbook-review/)
- Edgerunners season 2 deliberately does not reuse the S1 look and leans into an 80s/90s anime homage, per showrunner Bartosz Sztybor. — [Otakukart](https://otakukart.com/cyberpunk-edgerunners-2-showrunner-says-studio-trigger-rejected-repeating-season-1s-art-style-in-favor-of-an-80s-and-90s-anime-homage/)
- C2077 art director Jakub Knapik describes a fully dynamic GI system for Night City with ray tracing layered on top as a hybrid. The game was treated like a film shot to composite, with a custom film-style LUT instead of a standard tonemapper. — [Foundry interview](https://foundry.com/insights/film-tv/cyberpunk-2077-night-city-nuke)
- GDC 2022 "Bringing Light to Night City" (Knapik, Yablonsky, Voon Kent Poo) covered the lighting of interior and open-world case studies. The full talk is in GDC Vault, members only. — [Game Developer](https://www.gamedeveloper.com/marketing/find-out-how-cyberpunk-2077-lit-up-night-city-in-this-gdc-2022-session), [GDC Vault](https://gdcvault.com/play/1027959/Advanced-Graphics-Summit-Cyberpunk-2077)
- GDC 2024 Phantom Liberty talk: per-location lighting and color scripting, built from references and an analysis of open-world and quest narrative needs. — [GDC schedule](https://schedule.gdconf.com/session/art-direction-summit-lights-of-dogtown-narrative-lighting-in-cyberpunk-2077-phantom-liberty/902259)
- CDPR/NVIDIA: verticality, dynamic weather and the day/night cycle ruled out pre-baked lighting. — [NVIDIA GTC21](https://www.nvidia.cn/on-demand/session/gtcspring21-e32781)
- A general style guide (secondary source) describes the anime cyberpunk look as bold outlines, flat cel-shaded color blocks and high-contrast composition. — [Dreamina guide](https://dreamina.capcut.com/ai-image/cyberpunk-art-style)
- Babylon's DefaultRenderingPipeline image processing exposes `contrast`, `exposure`, `colorGradingEnabled` + `colorGradingTexture` (a LUT), and `colorCurves`. — [Babylon docs: DefaultRenderingPipeline](https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/defaultRenderingPipeline)

### Inferences
- **Palette as data.** Define a per-district "color script" (key neon, fill, shadow tint, fog color) in the content data, in the spirit of CDPR's per-location color scripting. Apply it via `imageProcessing.colorGradingTexture` (one 3D LUT per district, cross-faded on district streaming) plus toon ramp textures. One LUT = one texture fetch in the final pass, so it is effectively free.
- **Toon mapping.** Shadows tinted toward deep blue/violet, not black. Lit side in warm neutral. Rim/back light in the district's neon key (magenta or cyan), computed as `pow(1 - dot(N,V), k)`, stepped through the ramp so it stays a hard cel band. This reproduces the "neon haze from streetlights" read without extra lights.
- **Edgerunners effects as gameplay.** Implement the per-frame color shift (afterimage trail with hue rotation per ghost) only for slow-mo/Sandevistan-like abilities and cyberpsychosis/damage states. Use the "old-school analog" look (scanlines, CRT colour bleed, dithering) for hacking/netrunning screens, matching Imaishi's choice.
- **Outlines.** Keep outline thickness constant in screen space and color outlines with a darkened local hue rather than pure black on neon-lit surfaces. Pure black lines read as manga; tinted lines read closer to Trigger's colour-held lines. This is an art call to test.

### Gaps
- I found no primary source with the exact Edgerunners palette values or a Trigger interview about colour keys. The artbook is the likely source but it is not online.
- The GDC 2022 and 2024 CDPR lighting talk contents are behind GDC Vault. Only the abstracts were reachable.
- I found no published C2077 toon/cel fan-port or official NPR breakdown to cite.

## 2. Wet asphalt, reflections, puddles, rain

### Takeaway
True screen-space reflections exist in Babylon (`SSRRenderingPipeline`, WebGL2/WebGPU only) and can be tuned from ~4 ms to ~0.2 ms on a high-end GPU. On phones and SwiftShader, use faked reflections: vertical stretched emissive streak quads under neon signs, a cheap env/cube reflection masked by a puddle map, and GPU particles for rain with a CPU fallback.

### Cited Findings
- `SSRRenderingPipeline` was added in Babylon.js 5.51.0, replacing the older SSR post process. It requires WebGL2 or WebGPU; otherwise it acts as a pass-through. — [Babylon docs: SSR pipeline](https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/SSRRenderingPipeline)
- It uses the prepass renderer by default (more accurate and faster). `forceGeometryBuffer = true` switches to the geometry buffer renderer, which renders the scene an extra time and is slower but behaves better with MSAA. — [Babylon docs: SSR pipeline](https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/SSRRenderingPipeline)
- SSR parameters:
  - `step` (default 1), `maxSteps` and `maxDistance` (both default 1000), `thickness` (0.5).
  - `enableAutomaticThicknessComputation` re-renders back faces, so it costs more.
  - `ssrDownsample` only works when blur is on. `blurDownsample` defaults to 0.
  - `useFresnel` (default false) allows reflections on non-metal PBR and costs more with blur.
  - `reflectivityThreshold` (0.04) skips low-reflectivity pixels.

  — [Babylon docs: SSR pipeline](https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/SSRRenderingPipeline)
- Only Standard and PBR materials are supported. Standard materials default to specular (1,1,1), which makes them fully reflective, so set (0,0,0) to opt out. A custom toon ShaderMaterial therefore will not feed SSR without extra work. — [Babylon docs: SSR pipeline](https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/SSRRenderingPipeline)
- Measured cost in the docs' Hill Valley scene on an RTX 3080 Ti with prepass: SSR took 4.15 ms with quality settings and 0.2 ms with optimized settings (larger step, fewer steps, downsampling, no smooth reflections or auto thickness). — [Babylon docs: SSR pipeline](https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/SSRRenderingPipeline)
- SSR limitations:
  - It only reflects what is on screen, and it cannot reflect object backs.
  - MSAA with prepass causes artifacts, and transparent meshes cause artifacts the docs say "there is nothing we can do" about.
  - WebGPU uses 16-bit depth because it cannot filter 32-bit float textures.

  — [Babylon docs: SSR pipeline](https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/SSRRenderingPipeline)
- In Babylon 9.x the pipeline is also split into `ThinSSRRenderingPipeline` (ThinSSRPostProcess, ThinSSRBlurPostProcess, ThinSSRBlurCombinerPostProcess) and imports a `ScreenSpaceReflections2Configuration`. — [unpkg @babylonjs/core 9.12 typings](https://cdn.jsdelivr.net/npm/@babylonjs/core@9.12.0/PostProcesses/RenderPipeline/Pipelines/thinSSRRenderingPipeline.d.ts), [9.18 typings](https://app.unpkg.com/@babylonjs/core@9.18.0/files/PostProcesses/RenderPipeline/Pipelines/ssrRenderingPipeline.pure.d.ts)
- Classic mirror reflections (mirroring geometry through the ground plane and redrawing it) double scene cost. MotoGP reflected only bikes and riders and used flipped flat images of scenery on the road, which are only geometrically right when the vanishing point fits. — [Shawn Hargreaves, MotoGP road reflections](https://www.shawnhargreaves.com/blog/motogp-road-reflections.html)
- A cheap wet-ground shader uses a height map to mark low areas as water, a 0–1 wetness parameter for coverage, and an env map for reflections, chosen "purely for performance reasons". — [jMonkeyEngine forum](https://hub.jmonkeyengine.org/t/wip-video-puddle-shader-wet-ground-shader/17343)
- Academic overview of wet road rendering for driving sims. — [Nguyenova, CESCG 2021 (PDF)](https://cescg.org/wp-content/uploads/2021/03/Nguyenova-Rendering-Wet-Roads-in-Driving-Simulations-1.pdf)
- C2077 RT Overdrive replaces SSR with full-resolution RT reflections. NVIDIA calls SSR and low-res indirect light "still widely used". — [The FPS Review](https://www.thefpsreview.com/2023/03/07/nvidia-to-detail-cyberpunk-2077-rt-overdrive-mode-at-gdc-2023)
- Rain particles:
  - `GPUParticleSystem` needs WebGL2 transform feedback; check `GPUParticleSystem.IsSupported`.
  - Its API almost matches `ParticleSystem`, so you can fall back to CPU particles with lower capacity.
  - `activeParticleCount` caps the GPU load, and `randomTextureSize` defaults to 16K and can be lowered (e.g. 4096).
  - No sub-emitters (so splash-on-impact needs another approach), no mesh emitters, no manualEmitCount, and gradients take one value each.

  — [Babylon docs: GPU particles](https://doc.babylonjs.com/features/featuresDeepDive/particles/particle_system/gpu_particles)

### Inferences
- **Recommended tiered approach (cheapest first):**
  1. **Tier 0 (phones, SwiftShader).** Road material with a puddle mask (texture or world-space noise, red channel) driving a darker albedo and a cel-stepped specular highlight. Add "reflection strips": thin-instanced vertical quads under each neon sign, flipped below the ground plane. They use the sign's emissive color, an additive vertical gradient, scroll-noise distortion and a distance fade, and they are only drawn where the puddle mask is set. The cost is one extra draw call per sign batch. This is the single most "cyberpunk" wet-street cue, and it is how stylized games fake neon reflections.
  2. **Tier 1 (laptops).** Add a static low-res cube (`ReflectionProbe` refreshed once per district load, or a baked env texture) sampled in the road shader with the puddle mask as reflectivity.
  3. **Tier 2 (desktop WebGL2 opt-in).** Use `SSRRenderingPipeline` with `step` ≥ 4, `maxSteps` ~ 50–100, `ssrDownsample = 1`, `blurDownsample = 1–2`, no auto thickness. Restrict it to the road by keeping specular 0 elsewhere. The toon materials need a reflectivity output to take part, so the road may have to be a StandardMaterial/PBR with plugins, or SSR is skipped.
- **`MirrorTexture` (planar reflection)** is the "draw twice" option. If used, restrict its `renderList` to emissive signs and AVs, use a small ratio (0.25), and update every N frames.
- **Rain.** Use screen-aligned streak particles in a camera-following box (a GPU system when supported, a capped CPU fallback otherwise). Fake splashes with a thin-instanced ring decal pool on the ground (animated scale/alpha in the vertex shader) instead of sub-emitters. A cheaper option is a full-screen rain-streak overlay in post, plus ripple normals in the puddle shader driven by time.
- Rain intensity should be a weather parameter from `sim`, via a port/event, so visual rain stays deterministic with gameplay.

### Gaps
- I found no source measuring SSR cost on mobile GPUs or in SwiftShader. Expect it to be unusable there, but this needs measuring in `e2e/npr-perf.spec.ts`.
- I found no published write-up specifically on the "neon reflection strip" trick in shipped games. It is common practitioner knowledge, not verified here.
- I did not verify Babylon 9 API details for `ReflectionProbe` or `MirrorTexture` in this session.

## 3. Fog and volumetric light

### Takeaway
Babylon gives you scene fog (linear/exp/exp2) and `VolumetricLightScatteringPostProcess` (god rays from one light-source mesh, a radial blur with `samples` default 100). For a neon city in NPR, height fog via a custom or node material and additive fake light cones (meshes with fresnel/depth-faded alpha) are cheaper and more controllable than true volumetrics.

### Cited Findings
- `VolumetricLightScatteringPostProcess` has a constructor `samples` argument (default 100) that controls quality and becomes a `NUM_SAMPLES` define. The uniforms are `exposure` (default 0.3), `decay` (0.96815, range [0,1]), `weight` (0.58767) and `density` (0.926), per the 8.12.1 source. Check defaults against your version. — [unpkg 8.12.1 source](https://app.unpkg.com/@babylonjs/core@8.12.1/files/PostProcesses/volumetricLightScatteringPostProcess.js), [typedoc](https://documentation-a5um7gq0g-babylonjs.vercel.app/typedoc/classes/BABYLON.VolumetricLightScatteringPostProcess), [9.18 typings](https://app.unpkg.com/@babylonjs/core@9.18.0/files/PostProcesses/volumetricLightScatteringPostProcess.pure.d.ts)
- Babylon scene fog is global. Localized fog needs a custom volumetric-style shader or a Node Material. — [Babylon forum: fog at part of world](https://forum.babylonjs.com/t/use-fog-at-certain-part-of-the-world/7420)
- Height or ground fog in Babylon must be computed from world-space position, not `gl_FragCoord` or camera position. A user built a Lengyel unified-fog version. — [Babylon forum: GroundFogEffect](https://forum.babylonjs.com/t/groundfogeffect-need-help/13867)
- Custom `ShaderMaterial`s must include Babylon's fog includes to respect scene fog. A thread documents the fix, and the docs were updated afterwards. — [Babylon forum: fog with custom shader](https://forum.babylonjs.com/t/fog-with-custom-pixel-perfect-shader/55361)
- A Node Material can do distance-from-point fading without code. — [Babylon forum: RTS fog of war](https://forum.babylonjs.com/t/rts-fog-of-war/35479)
- An older custom-shader world-building tutorial (height maps, skyboxes, custom shaders) by David Catuhe. — [Eternal Coding](https://eternalcoding.com/babylon-js-creating-a-convincing-world-for-your-game-with-custom-shaders-height-maps-and-skyboxes)

### Inferences
- **Height fog** is an analytic exponential falloff in world Y, with the fog colour from the district color script. It can be added via `MaterialPluginBase` to Standard/PBR or as a function in the toon shader, so it costs only ALU. Use a second, denser layer near street level to sell depth between megabuildings. Fog is also the main LOD hider for streamed districts.
- **Fake volumetric cones** under street lamps and neons: an open cone or quad mesh with additive blending, alpha = fresnel × (1 - distance along the cone) × a soft-particle depth fade (needs a depth texture, available from the prepass or `DepthRenderer`). Thin-instance them per lamp type. The GPU cost is overdraw, so keep them narrow and disable them on phones in favour of a ground "light pool" decal.
- **Light shafts** (`VolumetricLightScatteringPostProcess`): use only for hero moments (one large hologram or searchlight). Use `ratio` 0.25–0.5 and `samples` 30–50 on laptops, and turn it off on mobile. Each instance re-renders occluders into its own pass, which adds draw calls.
- **Glow layer + fog** together give most of the "neon haze" read. Fog the emissive too, so distant signs fade into colored haze instead of staying pin-sharp.

### Gaps
- I could not reach the current Babylon docs page for volumetric light scattering (the URL returned 404). Defaults were taken from source/typings.
- I found no source on Babylon 9 adding a newer froxel/volumetric fog feature. If one exists in 9.x, check the changelog.

## 4. Post effects: what is always on vs. gameplay-triggered

### Takeaway
`DefaultRenderingPipeline` covers bloom, chromatic aberration, grain, sharpen, DOF, FXAA/MSAA and image processing (contrast, exposure, LUT, curves, vignette). GlowLayer is the better tool for neon than threshold bloom, since it is selective per mesh. Keep only glow + LUT + light vignette always on. Use chromatic aberration, scanlines, heavy grain and glitch as short-lived gameplay feedback (damage, hacking, scan mode, cyberpsychosis).

### Cited Findings
- DefaultRenderingPipeline properties:
  - Bloom: `bloomEnabled`, `bloomThreshold`, `bloomWeight`, `bloomKernel` (64), `bloomScale` (0.5).
  - Chromatic aberration: `chromaticAberrationEnabled`, `chromaticAberration.aberrationAmount`, `.radialIntensity`, `.direction` (0,0 = toward the screen center).
  - Grain: `grainEnabled`, `grain.intensity`, `grain.animated`.
  - Sharpen: `sharpenEnabled` (`colorAmount` 0 gives edge detection output).
  - DOF: `depthOfFieldEnabled`, `depthOfFieldBlurLevel`; a higher blur level "may affect performance".
  - Antialiasing: `fxaaEnabled`, and `samples` for MSAA (WebGL2 only).
  - HDR is recommended "whenever possible" except for low-end fallbacks.

  — [Babylon docs: DefaultRenderingPipeline](https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/defaultRenderingPipeline)
- That docs page lists vignette as a feature but does not document its properties. Vignette lives in image processing (not detailed on that page). — [Babylon docs: DefaultRenderingPipeline](https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/defaultRenderingPipeline)
- GlowLayer options:
  - `mainTextureRatio` ("the smaller, the faster") and `mainTextureFixedSize` (keeps the blur shape the same across devices).
  - `blurKernelSize` (32 by default), `intensity`, and `mainTextureSamples` (MSAA, WebGL2 only).
  - `addExcludedMesh` and `addIncludedOnlyMesh` (switches the layer into included-only mode).
  - `customEmissiveColorSelector(mesh, subMesh, material, result: Color4)` and `customEmissiveTextureSelector` for per-mesh glow overrides.

  — [Babylon docs: Glow Layer](https://doc.babylonjs.com/features/featuresDeepDive/mesh/glowLayer)
- Edgerunners netrunning visuals came from "old-school analogs" rather than digital pixels, which supports CRT/scanline/analog styling for hacking UI. — [AWN](https://awn.com/animationworld/cyberpunk-edgerunners-vibrant-ode-retro-anime)
- Knapik's custom film LUT in place of a standard tonemapper supports a LUT-driven grade as the base layer. — [Foundry](https://foundry.com/insights/film-tv/cyberpunk-2077-night-city-nuke)

### Inferences
- **Always on (all tiers):** GlowLayer at `mainTextureRatio` 0.25–0.5 (0.25 on phones), `blurKernelSize` 16–32, with `mainTextureFixedSize` set so neon halos look the same across DPRs. Add the LUT grade and a mild vignette. Skip threshold bloom when GlowLayer is used. Both together double the blur passes, and threshold bloom also blooms lit toon highlights, which muddies the flat look.
- **Mood or optional:** light animated grain (adds "film" texture and hides banding in dark fog gradients). Make it a settings toggle.
- **Gameplay-triggered, short (0.1–0.5 s), one custom post process with uniforms:**
  - damage: chromatic aberration spike + red vignette pulse;
  - hacking/scan mode: scanlines + desaturate the world + highlight targets via outline color or `HighlightLayer`;
  - glitch/datamosh-like: block-offset UV displacement with RGB split, driven by a seeded noise texture;
  - Sandevistan/slow-mo: afterimage trail with hue shift.
  
  Combine all of these into one `PostProcess` with a single fragment shader and per-effect intensity uniforms. One full-screen pass is cheaper than chaining several pipelines.
- **Timing.** Effect timing should come from sim events (core events) so it stays deterministic. The engine only maps event → uniform envelope. Randomness for glitch patterns should use a seeded noise texture on the engine side, never `Math.random` in sim/core.
- **Accessibility.** Give flashes, glitch and CA intensity a "reduce effects" setting (important for photosensitivity).

### Gaps
- I did not verify the exact Babylon 9 vignette property names (`imageProcessing.vignetteEnabled`, `vignetteWeight`, `vignetteColor` etc.) in this session.
- I found no measured GPU cost per DefaultRenderingPipeline effect on mobile.

## 5. Scale: megabuildings, skyline, holograms, AVs, signage density

### Takeaway
Verticality and density are sold mostly by cheap emissive layers: window shaders (interior mapping or a procedural lit-window grid), skyline impostor panoramas, hologram materials (fresnel + scanlines + flicker in about 80 lines of GLSL), and spline-following thin-instanced AV lights. None of these need real geometry or lights.

### Cited Findings
- Hologram shader recipe:
  - Godot shader: fresnel = `pow(1 - dot(N,V), power) * strength`, with scanlines from a screen-space `fract()` pattern with speed, color and density. — [Godot Shaders: Simple Hologram](https://godotshaders.com/shader/simple-hologram-shader/)
  - A more elaborate variant adds flicker and "interrupts". — [Godot Shaders: SciFi Hologram](https://godotshaders.com/shader/scifi-hologram/)
  - Three.js tutorial: moving horizontal scanlines + fresnel rim + vertical stripes + occasional glitch jitter, about 80 lines of GLSL, works on any mesh. — [Three.js From Zero s0-06](https://masterallarts.pages.dev/learn/threejs-from-zero/s0-06-hologram-shader/)
  - The UE5 version uses translucent blend mode with animated bands and a glowing edge. — [ArtStation UE5.6 tutorial](https://jsabbott.artstation.com/blog/MaeAR/tutorial-creating-a-hologram-shader-in-unreal-engine-5-6)
  - Unity HLSL fresnel explanation. — [Medium](https://medium.com/@gonzabarranco/how-to-make-a-hologram-shader-in-unity-with-hlsl-3d6ba415befb)
- Fake interior windows:
  - Disney's Big Hero 6 Virtual Window Shader creates geometry and light inside windows from pre-baked textures only. — [SIGGRAPH Asia 2014 paper (unpaywall)](https://unpaywall.org/10.1145%2F2669024.2669029)
  - A Godot fake-interior shader uses random + noise to decide which rooms are lit, with an emission option. — [Godot Shaders: Fake Interior](https://godotshaders.com/shader/fake-window-interior-shader/)
  - Gaijin's Dagor Engine projects an interior cubemap with a room-depth parameter. — [DagorEngine docs](https://gaijinentertainment.github.io/DagorEngine/assets/shaders/rendinst_interior_mapping.html)
  - Commercial versions give each window cell its own lit/dark state and blinds in a single opaque material, with no translucency or extra draw calls. — [Fab listing](https://www.fab.com/listings/a5062af1-de74-4b3b-97ff-67fd4dca53db)
- Thin instances (Babylon ≥ 4.2):
  - API: `thinInstanceAdd`, `thinInstanceSetBuffer("matrix", f32, 16, static)`, `thinInstanceRegisterAttribute("color", 4)` for per-instance color, `thinInstanceCount`, `thinInstanceRefreshBoundingInfo`.
  - No per-instance JS objects ("thousands" are fine).
  - Culling is all-or-nothing for the whole set, adding or removing instances is costlier than `InstancedMesh`, and there is one bounding volume for picking.
  - Recommended for static sets.

  — [Babylon docs: Thin Instances](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/thinInstances)

### Inferences
- **Megabuildings.** The base mesh comes from the CC0 city kit. The facade shader takes a world-space window grid (cell size from a uniform). A hash of the cell ID picks lit/dark, a colour from a 4–6 entry warm/cool palette and a curtain level; a slow time term flips a few cells. All of it sits in the emissive channel, so GlowLayer picks it up. Cost: ALU only, zero extra draws. Interior mapping (ray-box in tangent space) is the upgrade for near buildings only. Toggle it by LOD distance via a define, so you get two shader variants to warm up.
- **Skyline panorama.** 2–3 parallax layers of camera-centred cylinders (or a cube) with silhouette textures and an emissive window/sign atlas, fogged into the sky colour. One draw per layer, so megastructures beyond the streamed districts cost almost nothing. Scroll emissive "blinks" (aircraft warning lights) in the shader.
- **Holographic ads.** Billboards (`billboardMode` Y-axis or full) with a sprite-sheet/atlas flipbook UV animation + the hologram fresnel/scanline shader, additive blending, `disableDepthWrite`. Keep them out of the outline pass. Put ad atlases in a single texture array or atlas, so all ads share one material and can be thin instances with a per-instance `frameOffset` attribute.
- **Flying cars (AVs).** Ambient traffic needs no gameplay meaning, so keep it out of sim determinism (engine-side, seeded). Use thin instances of a low-poly AV (or just emissive light-pair quads at distance) moving along a few spline lanes. Evaluate the position in the vertex shader from `time + perInstancePhase` to avoid per-frame JS matrix updates and buffer uploads. Because culling is all-or-nothing, split lanes into a few meshes per district.
- **Signage density.** Use a single neon atlas (signs and kanji/katakana/hangul glyph boards) on a shared emissive material with thin instances per district chunk, plus per-instance color and flicker phase attributes. A dense ground floor and sparse upper floors with large vertical signs reproduces the Night City / Kowloon read. Exclude the signs from the outline pass. Use `glowLayer.addIncludedOnlyMesh` so only signs, windows and holograms glow.

### Gaps
- I found no specific breakdown of how C2077, Cloudpunk or The Ascent render skyline impostors or AV traffic. Search results did not cover Ghostrunner, The Ascent, Ruiner or Cloudpunk rendering talks.

## 6. Performance strategies and shader compile hitches

### Takeaway
Batch everything emissive into a few atlas-based thin-instance meshes per streamed chunk. Keep glow and post effects at reduced resolution. Pre-compile every material/define permutation while loading (await `forceCompilationAsync` / `scene.whenReadyAsync`) with a parallel-compile-capable engine. There is no true shader precompilation on the web.

### Cited Findings
- Thin instances avoid JS-side cost per instance but are culled as a set. For widely scattered sets where few are visible, regular instances are better. — [Babylon docs: Thin Instances](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/thinInstances)
- GlowLayer `mainTextureRatio`: "the smaller, the faster". — [Babylon docs: Glow Layer](https://doc.babylonjs.com/features/featuresDeepDive/mesh/glowLayer)
- SSR speed-ups: larger `step`, fewer `maxSteps`, smaller `maxDistance`, downsampling, no smooth reflections or auto thickness (4.15 ms → 0.2 ms on a 3080 Ti). — [Babylon docs: SSR pipeline](https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/SSRRenderingPipeline)
- `material.forceCompilation` is not synchronous: use the callback or the async version.
  - You need a mesh with the same defines as the real one, and you must pass options for each permutation (instances, clip planes).
  - The `onCompiled` callback may only fire if the material is actually used in rendering.
  - Forum answer: "there is no such a thing as shader precompilation on the web". Start with simple shaders and compile complex ones in the background.
  - Compilation was reported as synchronous in WebGPU at the time.

  — [Babylon forum: Force shader compilation](https://forum.babylonjs.com/t/force-shader-compilation/54789), [Shader pre-compilation demo](https://forum.babylonjs.com/t/shader-pre-compilation-demo/53865), [older thread](https://html5gamedevs.com/topic/31485-force-compilation-of-shaders)
- Babylon supported `KHR_parallel_shader_compile` from 2019. While a program compiles, dependent materials are flagged not ready and further calls on that program wait. The `getProgramParameter` / `getShaderParameter` queries still block, so only `COMPLETION_STATUS_KHR` polling is non-blocking. — [Khronos public_webgl list (Catuhe)](https://www.khronos.org/webgl/public-mailing-list/public_webgl/1904/msg00001.php), [Sherif reply](https://www.khronos.org/webgl/public-mailing-list/public_webgl/1904/msg00008.php)
- The extension's availability differs per browser (available in Chrome, reported missing in Firefox despite caniuse). — [Babylon forum](https://forum.babylonjs.com/t/help-understanding-webgl-extension-mechanism/24919)
- GPU particles cap load with `activeParticleCount`. Lower `randomTextureSize` from the 16K default. — [Babylon docs: GPU particles](https://doc.babylonjs.com/features/featuresDeepDive/particles/particle_system/gpu_particles)

### Inferences
- **Budget table proposal per quality tier (to validate in perf e2e):**
  - Phone / SwiftShader: no SSR, no VLS, no DOF, no GPU particles fallback >2k. GlowLayer ratio 0.25, kernel 16. FXAA only. Hardware scaling 1.5–2. Reflection strips + puddle mask only. Rain as a screen overlay.
  - Laptop: GlowLayer 0.5, LUT, grain toggle. Static reflection probe on roads, fake cones, GPU rain ≤ 20k.
  - Desktop: + SSR on road at downsampled settings, one VLS hero light, MSAA 2–4.
- **Draw calls.** Aim for one draw per (material × chunk) for windows/facades (merged meshes), signs (thin instances), holograms (thin instances, atlas), AVs (thin instances per lane group) and reflection strips. Freeze static stuff: `mesh.freezeWorldMatrix()`, `material.freeze()`, `scene.freezeActiveMeshes()` per district when the player is not moving between chunks, and `doNotSyncBoundingInfo`.
- **Outline pass cost.** Exclude emissive, hologram, particles and far LOD from the outline/edge pass. Outlines on far buildings both cost fill and add visual noise. Let fog plus a flat silhouette carry them instead.
- **Shader warm-up.**
  - Enumerate permutations: toon (lit/skinned/instanced/thin-instanced/fog), facade near/far, hologram, sign, reflection strip, rain, combined post FX with all effect defines.
  - On district load, create hidden proxy meshes with matching attributes (including thin-instance attributes and skeletons) and `await material.forceCompilationAsync(mesh, { useInstances: true })` for each, then `await scene.whenReadyAsync()` before revealing.
  - Keep post-effect "triggered" variants compiled up front by using uniforms (intensity = 0) rather than `#define` toggles, so turning on damage FX never causes a hitch.
  - Track first-use hitches in e2e by logging frames > 50 ms after reveal.
- **Mobile.** Prefer uniform-driven branching over many defines (fewer variants to compile on SwiftShader). Keep all emissive animation in the shader (time uniform) so the CPU stays idle.

### Gaps
- I could not reach official Babylon docs for the `parallelShaderCompile` engine option or exact `forceCompilationAsync` options in Babylon 9. The details come from forum posts, so verify them against the typings in `node_modules/@babylonjs/core`.
- I found no published per-effect cost numbers for SwiftShader. It needs in-repo measurement.
- Babylon-specific impostor/LOD tooling (e.g. `addLODLevel`, auto-LOD) was not researched in this session.
