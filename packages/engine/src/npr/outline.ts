import { Color3, type AbstractMesh } from "../babylon";

export const OUTLINE_COLOR = Color3.FromHexString("#07080c");
export const OUTLINE_WIDTH = 0.018;

/**
 * Inverted-hull outline via Babylon's OutlineRenderer (back faces pushed out along normals).
 * Doubles the draw cost of the mesh, so it is only used on characters (ADR-0003).
 */
export const applyOutline = (mesh: AbstractMesh, width = OUTLINE_WIDTH): void => {
  mesh.renderOutline = true;
  mesh.outlineColor = OUTLINE_COLOR;
  mesh.outlineWidth = width;
};
