import type { AbstractMesh, TransformNode } from "../babylon";

/**
 * Screen-door fade of single meshes (G-275): the player's figure close in front of the TPP
 * camera is drawn as a halftone of dots instead of solid. Pixels are discarded, nothing is
 * blended, so the draw calls and their order stay as they are. The toon materials read it per mesh.
 */
const amounts = new WeakMap<AbstractMesh, number>();

/** Share of each dot cell left out, 0 (solid) .. 1 (gone). */
export const setDither = (mesh: AbstractMesh, amount: number): void => {
  if (amount > 0) amounts.set(mesh, Math.min(1, amount));
  else amounts.delete(mesh);
};

export const ditherOf = (mesh: AbstractMesh): number => amounts.get(mesh) ?? 0;

/** Meshes whose outline the fade turned off, to turn it back on. */
const outlined = new WeakSet<AbstractMesh>();

/** Fades every mesh under `root` (a figure, its model and its weapons); 0 makes it solid again. */
export const fadeFigure = (root: TransformNode, amount: number): void => {
  for (const m of root.getChildMeshes(false)) {
    setDither(m, amount);
    // The outline's dark hull behind the figure would show through the holes.
    if (amount > 0 && m.renderOutline) {
      outlined.add(m);
      m.renderOutline = false;
    } else if (amount <= 0 && outlined.has(m)) {
      outlined.delete(m);
      m.renderOutline = true;
    }
  }
};
