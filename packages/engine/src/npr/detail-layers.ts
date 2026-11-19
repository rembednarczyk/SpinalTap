/**
 * Detail layers of the toon shader (ADR-0092): photographs of real surfaces from Poly Haven (CC0),
 * kept as luminance only round 0.5 by `tools/textures/fetch_detail.py`, four to an RGBA file. The
 * palette keeps the colour and the cel shading the light; a layer adds the grain of a plaster, the
 * courses of a brick wall, the cracks of an asphalt. Mipmaps average a layer to 0.5 far away, so it
 * fades out by itself where a procedural grid would shimmer.
 */

export type DetailTexture = "walls" | "ground" | "roofs";

export interface DetailLayer {
  readonly texture: DetailTexture;
  readonly channel: 0 | 1 | 2 | 3;
  /** The side of one tile in the world (m), from the asset's dimensions. */
  readonly metres: number;
  /** How far it moves the albedo at its brightest and darkest texel: albedo × (1 ± amp). */
  readonly amp: number;
}

/** Every layer by its Poly Haven asset; files and tiles as `packages/app/public/textures/layers.json` has them. */
export const DETAIL_LAYERS = {
  grey_plaster_02: { texture: "walls", channel: 0, metres: 1, amp: 0.22 },
  medieval_red_brick: { texture: "walls", channel: 1, metres: 2, amp: 0.45 },
  large_sandstone_blocks_01: { texture: "walls", channel: 2, metres: 3, amp: 0.3 },
  concrete_wall_006: { texture: "walls", channel: 3, metres: 2, amp: 0.25 },
  asphalt_02: { texture: "ground", channel: 0, metres: 3, amp: 0.3 },
  concrete_pavement: { texture: "ground", channel: 1, metres: 1.8, amp: 0.3 },
  grass_path_2: { texture: "ground", channel: 2, metres: 1, amp: 0.35 },
  forest_ground_04: { texture: "ground", channel: 3, metres: 3.15, amp: 0.35 },
  clay_roof_tiles_02: { texture: "roofs", channel: 0, metres: 2.5, amp: 0.45 },
  corrugated_iron_02: { texture: "roofs", channel: 1, metres: 2.7, amp: 0.4 },
  bitumen: { texture: "roofs", channel: 2, metres: 20, amp: 0.25 },
  granite_tile: { texture: "roofs", channel: 3, metres: 2.3, amp: 0.3 },
} as const satisfies Record<string, DetailLayer>;

export type DetailAsset = keyof typeof DETAIL_LAYERS;

/** The file of each texture, relative to the textures folder. */
export const DETAIL_FILES: Readonly<Record<DetailTexture, string>> = {
  walls: "detail-walls.png",
  ground: "detail-ground.png",
  roofs: "detail-roofs.png",
};

/** The sampler each texture binds to in the toon shader. */
export const DETAIL_SAMPLERS: Readonly<Record<DetailTexture, string>> = {
  walls: "detailWalls",
  ground: "detailGround",
  roofs: "detailRoofs",
};

/**
 * A wall's surface the facade shader samples (uv2.y / 32 of a wall, ADR-0092): plaster, the map's
 * brick or stone, the concrete of the post-war blocks, the sheet metal of a hall.
 */
export const WALL_DETAIL = { plaster: 0, brick: 1, stone: 2, concrete: 3, metal: 4 } as const;
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
const chooser = (name: string, layers: readonly DetailLayer[]): string => {
  const lines = layers.map((l, i) => `  if (code < ${f(i + 0.5)}) { mask = ${mask(l.channel)}; return vec2(${f(1 / l.metres)}, ${f(l.amp)}); }`);
  const last = layers[layers.length - 1] as DetailLayer;
  return `vec2 ${name}(float code, out vec4 mask) {\n${lines.join("\n")}\n  mask = ${mask(last.channel)};\n  return vec2(${f(1 / last.metres)}, ${f(last.amp)});\n}`;
};

const byCode = <K extends string>(codes: Readonly<Record<K, number>>, layers: Readonly<Record<K, DetailAsset>>): DetailLayer[] =>
  (Object.keys(codes) as K[]).sort((a, b) => codes[a] - codes[b]).map((k) => DETAIL_LAYERS[layers[k]]);

/** Albedo × (1 + amp × (texel − 0.5) × 2): the layer's grain round the palette's colour. */
const DETAIL_CORE = /* glsl */ `
float detailK(vec4 texel, vec4 mask, float amp) {
  return 1.0 + amp * 2.0 * (dot(texel, mask) - 0.5);
}`;

/** The shader's part of the detail layers (with the DETAIL define): samplers, choosers, the grain. */
export const DETAIL_GLSL = `
#ifdef DETAIL
uniform sampler2D detailWalls;
uniform sampler2D detailGround;
uniform sampler2D detailRoofs;
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
