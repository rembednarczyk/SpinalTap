/**
 * Detail layers of the toon shader (ADR-0092): photographs of real surfaces from Poly Haven (CC0),
 * kept as luminance only round 0.5 by `tools/textures/fetch_detail.py`, four to an RGBA file. The
 * palette keeps the colour and the cel shading the light; a layer adds the grain of a plaster, the
 * courses of a brick wall, the cracks of an asphalt. Mipmaps average a layer to 0.5 far away, so it
 * fades out by itself where a procedural grid would shimmer.
 */

export type DetailTexture = "walls" | "ground" | "roofs" | "extra";

export interface DetailLayer {
  readonly texture: DetailTexture;
  readonly channel: 0 | 1 | 2 | 3;
  /** The side of one tile in the world (m), from the asset's dimensions. */
  readonly metres: number;
  /**
   * How dark its ink lines are: albedo × (1 − amp) on a layer's darkest tenth (the joints of a brick
   * wall, a crack in the asphalt), a lighter step over the next; 0 leaves the surface the palette's
   * own flat colour (plaster, concrete, sidewalk slabs, grass: their photographs gave only grain).
   */
  readonly amp: number;
}

/** Every layer by its Poly Haven asset; files and tiles as `packages/app/public/textures/layers.json` has them. */
export const DETAIL_LAYERS = {
  grey_plaster_02: { texture: "walls", channel: 0, metres: 1, amp: 0 },
  medieval_red_brick: { texture: "walls", channel: 1, metres: 2, amp: 0.35 },
  large_sandstone_blocks_01: { texture: "walls", channel: 2, metres: 3, amp: 0 },
  concrete_wall_006: { texture: "walls", channel: 3, metres: 2, amp: 0 },
  asphalt_02: { texture: "ground", channel: 0, metres: 3, amp: 0.3 },
  concrete_pavement: { texture: "ground", channel: 1, metres: 1.8, amp: 0 },
  grass_path_2: { texture: "ground", channel: 2, metres: 1, amp: 0 },
  forest_ground_04: { texture: "ground", channel: 3, metres: 3.15, amp: 0 },
  clay_roof_tiles_02: { texture: "roofs", channel: 0, metres: 2.5, amp: 0.35 },
  corrugated_iron_02: { texture: "roofs", channel: 1, metres: 2.7, amp: 0.3 },
  bitumen: { texture: "roofs", channel: 2, metres: 20, amp: 0 },
  granite_tile: { texture: "roofs", channel: 3, metres: 2.3, amp: 0 },
  weathered_planks: { texture: "extra", channel: 0, metres: 2, amp: 0.3 },
  gray_rocks: { texture: "extra", channel: 1, metres: 1.8, amp: 0.3 },
  cobblestone_floor_08: { texture: "extra", channel: 2, metres: 2, amp: 0.35 },
  red_brick_03: { texture: "extra", channel: 3, metres: 1, amp: 0.35 },
} as const satisfies Record<string, DetailLayer>;

export type DetailAsset = keyof typeof DETAIL_LAYERS;

/** The file of each texture, relative to the textures folder. */
export const DETAIL_FILES: Readonly<Record<DetailTexture, string>> = {
  walls: "detail-walls.png",
  ground: "detail-ground.png",
  roofs: "detail-roofs.png",
  extra: "detail-extra.png",
};

/** The sampler each texture binds to in the toon shader. */
export const DETAIL_SAMPLERS: Readonly<Record<DetailTexture, string>> = {
  walls: "detailWalls",
  ground: "detailGround",
  roofs: "detailRoofs",
  extra: "detailExtra",
};

/**
 * A wall's surface the facade shader samples (uv2.y / 32 of a wall, ADR-0092): plaster, the map's
 * brick or stone, the concrete of the post-war blocks, the sheet metal of a hall, a factory's dark clinker.
 */
export const WALL_DETAIL = { plaster: 0, brick: 1, stone: 2, concrete: 3, metal: 4, clinker: 5 } as const;
export type WallDetail = keyof typeof WALL_DETAIL;

/** A roof's surface (uv2.y / 32 of a roof): clay tiles, sheet metal, copper, a flat roof's bitumen. */
export const ROOF_DETAIL = { tile: 0, metal: 1, copper: 2, bitumen: 3 } as const;
export type RoofDetail = keyof typeof ROOF_DETAIL;

/** The layer of each wall and roof surface. */
const WALL_LAYER: Readonly<Record<WallDetail, DetailAsset>> = {
  plaster: "grey_plaster_02",
  brick: "medieval_red_brick",
  stone: "large_sandstone_blocks_01",
  concrete: "concrete_wall_006",
  metal: "corrugated_iron_02",
  clinker: "red_brick_03",
};
const ROOF_LAYER: Readonly<Record<RoofDetail, DetailAsset>> = {
  tile: "clay_roof_tiles_02",
  metal: "corrugated_iron_02",
  copper: "corrugated_iron_02",
  bitumen: "bitumen",
};

const f = (v: number): string => v.toFixed(4);
const mask = (c: number): string => `vec4(${[0, 1, 2, 3].map((i) => (i === c ? "1.0" : "0.0")).join(", ")})`;

/**
 * A GLSL chooser over a code: `name(code)` gives the layer's vec4 (channel mask) in `mask`, and
 * returns vec2(1 / metres, amp). Selects, not branches: the texture is read once outside.
 */
export const chooser = (name: string, layers: readonly DetailLayer[]): string => {
  const lines = layers.map((l, i) => `  if (code < ${f(i + 0.5)}) { mask = ${mask(l.channel)}; return vec2(${f(1 / l.metres)}, ${f(l.amp)}); }`);
  const last = layers[layers.length - 1] as DetailLayer;
  return `vec2 ${name}(float code, out vec4 mask) {\n${lines.join("\n")}\n  mask = ${mask(last.channel)};\n  return vec2(${f(1 / last.metres)}, ${f(last.amp)});\n}`;
};

const byCode = <K extends string>(codes: Readonly<Record<K, number>>, layers: Readonly<Record<K, DetailAsset>>): DetailLayer[] =>
  (Object.keys(codes) as K[]).sort((a, b) => codes[a] - codes[b]).map((k) => DETAIL_LAYERS[layers[k]]);

/**
 * The comic version (decision of the user of 19.11): a layer is drawn, not photographed. Read one
 * mip coarser than the screen asks (`detailTex`, no grain of the photograph), only its darkest
 * texels count, in two steps like the cels: the lines of the joints and cracks, never a grey haze.
 * Thresholds below the layer's mean (texel − 0.5), from the layers' histograms at that mip.
 */
const DETAIL_CORE = /* glsl */ `
#define detailTex(s, uv) texture2D(s, uv, 1.0)
float detailK(vec4 texel, vec4 mask, float amp) {
  float d = 0.5 - dot(texel, mask);
  return 1.0 - amp * (0.4 * smoothstep(0.13, 0.15, d) + 0.6 * smoothstep(0.23, 0.25, d));
}`;

/** The shader's part of the detail layers (with the DETAIL define): samplers, choosers, the grain. */
export const DETAIL_GLSL = `
#ifdef DETAIL
uniform sampler2D detailWalls;
uniform sampler2D detailGround;
uniform sampler2D detailRoofs;
uniform sampler2D detailExtra;
${DETAIL_CORE}
${chooser("wallLayer", byCode(WALL_DETAIL, WALL_LAYER))}
${chooser("roofLayer", byCode(ROOF_DETAIL, ROOF_LAYER))}
#endif
`;

/** The GLSL constants of one layer: vec2(1 / metres, amp) and its channel mask. */
export const layerGlsl = (asset: DetailAsset): { readonly scale: string; readonly mask: string } => {
  const l = DETAIL_LAYERS[asset];
  return { scale: `vec2(${f(1 / l.metres)}, ${f(l.amp)})`, mask: mask(l.channel) };
};
