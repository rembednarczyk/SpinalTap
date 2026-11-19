import { DETAIL_FILES, DETAIL_LAYERS, type DetailAsset, type DetailTexture, chooser } from "./detail-layers";

/**
 * The detail layers of the city kit (ADR-0092 stage 2): the kit's palette names its swatches, and
 * each swatch that stands for a surface gets a layer: its walls and trims concrete, its brick brick,
 * its roofs bitumen, its sheet metal corrugated iron, its plants turf, its doors and tables planks.
 * Glass, neon, paint and the small decor keep their flat colour. The toon shader finds a fragment's swatch from its palette
 * cell and reads the layer's code from a 16 × 16 texture built here.
 */
export const KIT_DETAIL: Readonly<Record<string, DetailAsset>> = {
  wall: "concrete_wall_006",
  "wall-dark": "concrete_wall_006",
  trim: "concrete_wall_006",
  "trim-light": "concrete_wall_006",
  roof: "bitumen",
  brick: "medieval_red_brick",
  metal: "corrugated_iron_02",
  rust: "corrugated_iron_02",
  dumpster: "corrugated_iron_02",
  plant: "grass_path_2",
  door: "weathered_planks",
};

/** The palette grid the shader decodes (`CityKitData.grid`); another grid draws the kit without layers. */
export const KIT_GRID = 16;

const TEXTURES = Object.keys(DETAIL_FILES) as DetailTexture[];

/** A layer's number across the three files: four per file in their order, 0–11. */
export const globalLayer = (asset: DetailAsset): number => {
  const l = DETAIL_LAYERS[asset];
  return TEXTURES.indexOf(l.texture) * 4 + l.channel;
};

/** Every layer by its number, for the shader's chooser. */
export const LAYERS_BY_NUMBER: readonly DetailAsset[] = (Object.keys(DETAIL_LAYERS) as DetailAsset[]).sort((a, b) => globalLayer(a) - globalLayer(b));

/**
 * The code texture's bytes (R of a 16 × 16 RGBA): layer number + 1 for a swatch with a layer, 0 for
 * the rest and for the empty cells. Row r holds swatches 16 r … 16 r + 15, as the palette does.
 */
export const kitDetailCodes = (swatches: readonly string[]): Uint8Array => {
  const px = new Uint8Array(KIT_GRID * KIT_GRID * 4);
  swatches.forEach((name, i) => {
    const asset = KIT_DETAIL[name];
    if (asset && i < KIT_GRID * KIT_GRID) px[i * 4] = globalLayer(asset) + 1;
  });
  return px;
};

/**
 * The shader's part (CITYKIT with DETAIL): the swatch's code from its palette cell, the layer laid on
 * the face's plane in metres (`facePlane`), one file read by the layer's number. The palette is the
 * texture's top third; the atlas of labels and signs below it has no layers.
 */
export const KIT_DETAIL_GLSL = `
#if defined(CITYKIT) && defined(DETAIL)
uniform sampler2D detailKit;
${chooser("anyLayer", LAYERS_BY_NUMBER.map((a) => DETAIL_LAYERS[a]))}
float kitDetail(vec2 uv, vec3 p, vec3 n, float dist) {
  if (uv.y > 0.3333) return 1.0;
  vec2 cell = floor(vec2(uv.x, uv.y * 3.0) * ${KIT_GRID.toFixed(1)});
  float code = floor(texture2D(detailKit, (cell + 0.5) / ${KIT_GRID.toFixed(1)}).r * 255.0 + 0.5);
  if (code < 0.5) return 1.0;
  float number = code - 1.0;
  vec4 mask;
  vec2 l = anyLayer(number, mask);
  vec2 q = facePlane(p, n) * l.x;
  vec4 t = number < 3.5 ? detailTex(detailWalls, q) : number < 7.5 ? detailTex(detailGround, q) : number < 11.5 ? detailTex(detailRoofs, q) : detailTex(detailExtra, q);
  return detailK(t, mask, l.y * (1.0 - smoothstep(60.0, 160.0, dist)));
}
#endif
`;
