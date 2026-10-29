import type { Vec3, ViewDescriptor } from "@seki/core";
import { GALLERY_ROW, propGallery } from "@seki/engine";

/**
 * `?lublin-preview&props-gallery` (ADR-0047): every street prop kind and shape in rows on a flat
 * granite square, to judge the models without the city around them.
 */

interface Placed {
  readonly position: Vec3;
  readonly view: ViewDescriptor;
}

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };

export const galleryViews = (): { attribution: string; views: Placed[] } => {
  const g = propGallery();
  const minX = -12;
  const minZ = -24;
  const maxX = Math.ceil(g.width) + 12;
  const maxZ = g.depth + 16;
  const cell = 10;
  const cols = Math.ceil((maxX - minX) / cell) + 1;
  const rows = Math.ceil((maxZ - minZ) / cell) + 1;
  const outline = [
    { x: minX, z: minZ },
    { x: maxX, z: minZ },
    { x: maxX, z: maxZ },
    { x: minX, z: maxZ },
  ];
  return {
    attribution: "Lublin 2077 · galeria mebli ulicznych (ADR-0047)",
    views: [
      { position: ORIGIN, view: { kind: "terrain", grid: { originX: minX, originZ: minZ, cell, cols, rows, heights: new Array<number>(cols * rows).fill(0) } } },
      { position: ORIGIN, view: { kind: "ground", surface: "square", outline } },
      { position: ORIGIN, view: { kind: "street-props", items: g.items } },
    ],
  };
};

export interface GalleryShot {
  readonly position: Vec3;
  readonly target: Vec3;
  readonly hour: number;
  readonly fog?: number;
}

/** Shots of the gallery: the whole rows by day and by night, then each row close up. */
export const galleryShots = (): Readonly<Record<string, GalleryShot>> => {
  const g = propGallery();
  const mid = g.width / 2;
  const whole = { position: { x: mid, y: 15, z: -20 }, target: { x: mid, y: 1, z: g.depth / 2 + 2 } };
  const row = (r: number, x: number, y: number, back: number, look: number) => ({ position: { x, y, z: r * GALLERY_ROW - back }, target: { x, y: look, z: r * GALLERY_ROW } });
  return {
    galeria: { ...whole, hour: 13, fog: 0.05 },
    "galeria-noc": { ...whole, hour: 23, fog: 0.05 },
    latarnie: { ...row(0, mid, 4, 15, 3.5), hour: 23, fog: 0.05 },
    "latarnie-dzien": { ...row(0, mid, 4, 15, 3.5), hour: 13, fog: 0.05 },
    zielen: { ...row(1, mid, 7, 18, 4), hour: 14, fog: 0.05 },
    drobne: { ...row(2, mid, 4, 13, 0.8), hour: 14, fog: 0.05 },
    "drobne-noc": { ...row(2, mid, 4, 13, 0.8), hour: 23, fog: 0.05 },
    stoiska: { ...row(3, 19, 5, 12, 1.5), hour: 14, fog: 0.05 },
    rzezby: { ...row(3, 52, 6, 15, 3), hour: 14, fog: 0.05 },
  };
};
