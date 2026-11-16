import type { StreetPropKind } from "@seki/core";
import type { MeshSink } from "../../mesh-sink";
import type { RenderQuality } from "../../../npr/quality";
import { type WorldProp, bake } from "../prop-batch";
import { craneModel } from "./site-crane";
import { fenceModel, gateModel } from "./site-fence";
import { scaffoldModel } from "./site-scaffold";
import { boardModel, cabinModel } from "./site-yard";

/**
 * The building sites' kit (ADR-0087) behind the `BabylonRenderer` facade: the fence's stretches,
 * the gate, the board and the office containers the import's generator lays on a site
 * (`construction-site.ts`), and of stage 2 the tower crane and the scaffold with its banner, each at
 * its variant's layout (`sites.ts` of `@seki/core`), baked into the street furniture's block meshes
 * (`prop-block.ts`) like the map's barriers, so a site costs no draw call of its own. Near only: a
 * site's pieces are not in the far mesh. The crane's beacon and the board's texts go into the
 * map's signs' mesh (`site-signs.ts`), the delivery drone onto the drones' lanes (`site-drones.ts`).
 */

const models = new Map<string, MeshSink>();

/** Kinds whose model differs by quality: the phones' fence goes without its hazard band, their scaffold without its mesh. */
const BY_QUALITY: ReadonlySet<StreetPropKind> = new Set<StreetPropKind>(["site-fence", "site-scaffold"]);

const build = (kind: StreetPropKind, variant: number, quality: RenderQuality): MeshSink => {
  switch (kind) {
    case "site-fence":
      return fenceModel(variant, quality);
    case "site-gate":
      return gateModel(variant);
    case "site-board":
      return boardModel(variant);
    case "site-crane":
      return craneModel(variant);
    case "site-scaffold":
      return scaffoldModel(variant, quality);
    default:
      return cabinModel(variant);
  }
};

/** A site piece's model for its kind and variant, built once. */
export const siteModel = (kind: StreetPropKind, variant: number, quality: RenderQuality): MeshSink => {
  const key = `${kind}:${variant}:${BY_QUALITY.has(kind) ? quality : ""}`;
  let m = models.get(key);
  if (!m) {
    m = build(kind, variant, quality);
    models.set(key, m);
  }
  return m;
};

/** Bakes a site piece at its place into a block's detailed sink. */
export const bakeSitePiece = (sink: MeshSink, p: WorldProp, quality: RenderQuality): void => bake(sink, siteModel(p.prop, p.variant ?? 0, quality), { ...p, scale: 1 });
