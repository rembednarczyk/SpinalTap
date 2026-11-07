import { type FigureLayout, figureLayout, isSitting } from "@seki/core";
import type { KitModel } from "../city-kit-data";
import { type CityProps, LITE, type PropXform, addPropToSink, facing, propHash } from "../city-props";
import { DRESS_FLAG, MeshSink, hexColor } from "../mesh-sink";
import type { RenderQuality } from "../../npr/quality";
import { type WorldProp, placePoint } from "./prop-batch";
import { blob, paint, v3 } from "./prop-kit";

/**
 * The still crowd of ADR-0058 stage 8 at its place: a figure is a model of `crowd-props.glb` (style
 * `figure-<pose>-<build>`, Quaternius' posed people, CC0) painted from its look, a sitter with its
 * hips on its seat, one standing on the paving, a smoker with an ember in its hand. Baked into the
 * street furniture's block mesh like the rest: vertices, not draw calls. Phones (`low`) take the
 * models' cheap versions and half the figures; before the file loads there is nobody.
 */

/**
 * The colours a look picks from (no brands, no costume): skin tones from light to deep, the tops and
 * trousers on the city kit's palette (its cloths, greys and dark) with a light shirt now and then,
 * shoes dark or light, hair from black to grey and the city's dyed pink and cyan.
 */
export const FIGURE_COLORS = {
  skin: ["#f1c9a8", "#dcaa83", "#c08a62", "#9a6a47", "#734a31", "#4f3222"],
  top: ["#167a80", "#8e2457", "#9c6a1c", "#1f4a3a", "#5a6170", "#596070", "#6a4038", "#1f5a52", "#15171c", "#b4bac4", "#3a3f4b", "#5b3a2c"],
  bottom: ["#15171c", "#3a3f4b", "#30343e", "#1d3346", "#596070", "#5b3a2c"],
  shoes: ["#18191d", "#15171c", "#b4bac4", "#6a4038"],
  hair: ["#15171c", "#2e2119", "#4a3323", "#7a5a3a", "#a08560", "#8a8f98", "#c43a7a", "#2a9fb0"],
} as const;

/** The swatches of the models that mark a figure's parts (`tools/city_crowd.py`), by part. */
const PARTS: Readonly<Record<string, keyof typeof FIGURE_COLORS>> = { brick: "skin", "fabric-teal": "top", trim: "bottom", tyre: "shoes", dark: "hair" };

/** A smoker's ember: a glowing speck at the hand (m). */
const EMBER = { size: 0.035, color: "#ff6a2a" } as const;

/** The colour of each part for a look: each part by its own hash of the look, so they mix freely. */
export const figurePaint = (look: number): ((swatch: string) => readonly number[] | null) => {
  const parts = Object.keys(FIGURE_COLORS) as (keyof typeof FIGURE_COLORS)[];
  const pick = new Map(
    parts.map((part, k) => {
      const list: readonly string[] = FIGURE_COLORS[part];
      return [part, hexColor(list[propHash(look, 90 + k) % list.length]!, DRESS_FLAG.solid)] as const;
    }),
  );
  return (swatch) => {
    const part = PARTS[swatch];
    return part ? (pick.get(part) ?? null) : null;
  };
};

/** The model of a figure's pose and build (a smoker is the standing model), the cheap one on phones; or null without the file. */
export const figureModel = (props: CityProps | null, f: FigureLayout, lite: boolean): KitModel | null => {
  const all = props?.byStyle.get(`figure-${f.pose === "smoke" ? "stand" : f.pose}-${f.body}`) ?? [];
  const cheap = all.filter((m) => m.styles.includes(LITE));
  const full = all.filter((m) => !m.styles.includes(LITE));
  const pool = lite && cheap.length > 0 ? cheap : full;
  return pool.length > 0 ? (pool[propHash(f.look, 91) % pool.length] ?? null) : null;
};

/** Does a phone (`low`) draw this figure? Half of them, by their look. */
export const drawnOnPhone = (f: FigureLayout): boolean => f.look % 2 === 0;

/** Where a figure's model goes: a sitter's origin (its hips) on its seat, a standing one's on the paving, facing the piece's front. */
export const figureXform = (p: WorldProp, f: FigureLayout): PropXform =>
  facing(placePoint(p, { x: 0, y: isSitting(f.pose) ? f.seat : 0, z: 0 }), { x: Math.sin(p.yaw), y: 0, z: Math.cos(p.yaw) }, { x: 1, y: 1, z: 1 });

/** A point of a model at a figure's place. */
const placed = (xf: PropXform, v: { x: number; y: number; z: number }) => {
  const [ax, ay, az] = xf.axes;
  return { x: xf.origin.x + ax.x * v.x + ay.x * v.y + az.x * v.z, y: xf.origin.y + ax.y * v.x + ay.y * v.y + az.y * v.z, z: xf.origin.z + ax.z * v.x + ay.z * v.y + az.z * v.z };
};

/** Bakes a figure (true), or nothing (false): no file yet, or a phone leaving this one out. */
export const bakeFigure = (sink: MeshSink, props: CityProps | null, p: WorldProp, quality: RenderQuality): boolean => {
  const f = figureLayout(p.variant ?? 0);
  const lite = quality === "low";
  if (lite && !drawnOnPhone(f)) return false;
  const m = props ? figureModel(props, f, lite) : null;
  if (!m || !props) return false;
  const xf = figureXform(p, f);
  addPropToSink(sink, props, m, xf, figurePaint(f.look));
  const hand = m.lights?.[0];
  if (f.pose === "smoke" && hand) sink.box(placed(xf, hand), EMBER.size, EMBER.size, EMBER.size, hexColor(EMBER.color, DRESS_FLAG.lit));
  return true;
};

/** A figure's stand-in for the gallery of kinds (`prop-models.ts`): a body and a head, 1.7 m; the city bakes only the models. */
export const figureStandIn = (): MeshSink => {
  const sink = new MeshSink();
  sink.prism(v3(0, 0, 0), 0.17, 1.45, 8, paint("#3a3f4b"));
  blob(sink, v3(0, 1.58, 0), 0.11, 0.13, 0.11, paint("#c08a62"), 6, 3);
  return sink;
};
