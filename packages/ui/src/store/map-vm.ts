/**
 * The city on the minimap and the map tab (ADR-0045): Lublin's surfaces, buildings and names
 * from the map data, in world metres (x east, z north). Sent once with the rest of `MapVm`.
 */

/** A polygon: flat `[x0, z0, x1, z1, …]`, world metres. */
export type MapPolygon = readonly number[];

/** What a surface of the map is drawn as. */
export type MapAreaKind = "road" | "walk" | "green" | "water" | "rail";

export interface MapAreaVm {
  readonly kind: MapAreaKind;
  readonly points: MapPolygon;
}

/** A street name, a district, a landmark (Zamek, Brama Krakowska) or a metro station. */
export type MapLabelKind = "street" | "district" | "landmark" | "station";

export interface MapLabelVm {
  readonly kind: MapLabelKind;
  readonly text: string;
  readonly x: number;
  readonly z: number;
  /** Direction of the text on the map, radians counter-clockwise from east; kept readable (−π/2..π/2]. */
  readonly angle: number;
}

/** A place the map tab can jump to: a district by name. */
export interface MapPlaceVm {
  readonly name: string;
  readonly x: number;
  readonly z: number;
}

/** Bounding box of a polygon. */
export interface MapBox {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export const polygonBox = (points: MapPolygon): MapBox => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i + 1 < points.length; i += 2) {
    const x = points[i] as number;
    const z = points[i + 1] as number;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, minZ, maxZ };
};

/** SVG `points` of a polygon in map space (y = −z, so north is up). */
export const svgPoints = (points: MapPolygon): string => {
  const out: string[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) out.push(`${(points[i] as number).toFixed(1)},${(-(points[i + 1] as number)).toFixed(1)}`);
  return out.join(" ");
};
