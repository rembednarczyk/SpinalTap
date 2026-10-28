import type { HackTargetKind, ViewDescriptor } from "@seki/core";
import { type AbstractMesh, Color3 } from "../babylon";
import { OUTLINE_COLOR } from "../npr/outline";

/** What the scanner marks an entity as (ADR-0030): enemies, devices and cameras, bystanders. */
export type ScanClass = "hostile" | "device" | "civilian";

export const SCAN_COLORS: Readonly<Record<ScanClass, string>> = {
  hostile: "#ff3b4e",
  device: "#ffd23a",
  civilian: "#3fe8ff",
};

/** Scanner class from the look the simulation gave an entity; null for what the scanner ignores. */
export const scanClassOfView = (view: ViewDescriptor): ScanClass | null => {
  switch (view.kind) {
    case "enemy":
      return "hostile";
    case "npc":
      return "civilian";
    default:
      return null;
  }
};

/** Scanner class from the focus event's target kind (cameras and devices have no character look). */
export const scanClassOfTarget = (kind: HackTargetKind | undefined, view: ScanClass | null): ScanClass | null =>
  kind === "camera" || kind === "device" ? "device" : (view ?? (kind === "person" ? "civilian" : null));

/** Outline weight while scanned, relative to the mesh's own; the focused target gets more. */
const WIDEN = 1.6;
const WIDEN_FOCUS = 2.2;

interface Saved {
  readonly outline: boolean;
  readonly width: number;
}

/**
 * Tints the outlines (characters already draw an inverted hull, so the tint is free) and gives
 * the focused target a faint fill. Every change is remembered and undone when the scanner closes.
 */
export class ScanHighlight {
  private readonly saved = new Map<AbstractMesh, Saved>();

  /** Marks `meshes` as `cls`; `focus` adds the fill and an outline even where there was none. */
  mark(meshes: readonly AbstractMesh[], cls: ScanClass, focus: boolean, strength: number): void {
    const color = Color3.FromHexString(SCAN_COLORS[cls]);
    for (const m of meshes) {
      if (m.isDisposed() || m.getTotalVertices() === 0) continue;
      let s = this.saved.get(m);
      if (!s) {
        s = { outline: m.renderOutline === true, width: m.outlineWidth };
        this.saved.set(m, s);
      }
      if (!s.outline && !focus) continue;
      m.renderOutline = true;
      m.outlineWidth = (s.outline ? s.width : 0.02) * (focus ? WIDEN_FOCUS : WIDEN);
      m.outlineColor = Color3.Lerp(OUTLINE_COLOR, color, strength);
      m.renderOverlay = focus;
      m.overlayColor = color;
      m.overlayAlpha = 0.16 * strength;
    }
  }

  /** Restores every mesh not in `keep`. */
  release(keep: ReadonlySet<AbstractMesh> = new Set()): void {
    for (const [m, s] of this.saved) {
      if (keep.has(m)) continue;
      this.saved.delete(m);
      if (m.isDisposed()) continue;
      m.renderOutline = s.outline;
      m.outlineWidth = s.width;
      m.outlineColor = OUTLINE_COLOR;
      m.renderOverlay = false;
    }
  }

  get marked(): number {
    return this.saved.size;
  }
}
