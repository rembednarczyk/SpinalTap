import type { StreetPropKind } from "@seki/core";
import type { MeshSink } from "../../mesh-sink";
import type { RenderQuality } from "../../../npr/quality";
import { type WorldProp, bake } from "../prop-batch";
import { fenceModel, gateModel } from "./site-fence";
import { boardModel, cabinModel } from "./site-yard";

/**
 * The building sites' kit (ADR-0087 stage 1) behind the `BabylonRenderer` facade: the fence's
 * stretches, the gate, the board and the office containers the import's generator lays on a site
 * (`construction-site.ts`), each at its variant's layout (`sites.ts` of `@seki/core`), baked into
 * the street furniture's block meshes (`prop-block.ts`) like the map's barriers, so a site costs
 * no draw call of its own. Near only: a site's pieces are not in the far mesh.
 */

const models = new Map<string, MeshSink>();

/** A site piece's model for its kind and variant, built once. */
export const siteModel = (kind: StreetPropKind, variant: number, quality: RenderQuality): MeshSink => {
  const key = `${kind}:${variant}:${kind === "site-fence" ? quality : ""}`;
  let m = models.get(key);
  if (!m) {
    m = kind === "site-fence" ? fenceModel(variant, quality) : kind === "site-gate" ? gateModel(variant) : kind === "site-board" ? boardModel(variant) : cabinModel(variant);
    models.set(key, m);
  }
  return m;
};

/** Bakes a site piece at its place into a block's detailed sink. */
export const bakeSitePiece = (sink: MeshSink, p: WorldProp, quality: RenderQuality): void => bake(sink, siteModel(p.prop, p.variant ?? 0, quality), { ...p, scale: 1 });
