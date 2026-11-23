import { memo } from "react";
import { venueKindKey } from "@seki/core";
import { type Translate, isMessageKey } from "../i18n/t";
import { useT } from "../i18n/use-t";
import type { MapAreaKind, MapBox, MapLabelKind, MapLabelVm } from "../store/map-vm";
import { polygonBox, svgPoints } from "../store/map-vm";
import type { MapVm } from "../store/ui-store";

/**
 * Lublin under the minimap and on the map tab (ADR-0045): the surfaces, the buildings and the
 * names from the map data, as SVG in map space (x east, y = −z). The polygons are turned into
 * SVG strings once per map; a layer draws only those in its window, so the minimap keeps a
 * few hundred shapes around the player instead of the whole city.
 */

interface Shape {
  readonly points: string;
  readonly box: MapBox;
}

interface AreaShape extends Shape {
  readonly kind: MapAreaKind;
}

export interface CityIndex {
  readonly areas: readonly AreaShape[];
  readonly buildings: readonly Shape[];
  readonly labels: readonly MapLabelVm[];
}

export const EMPTY_CITY: CityIndex = { areas: [], buildings: [], labels: [] };

export const indexCity = (map: MapVm): CityIndex => ({
  areas: (map.areas ?? []).map((a) => ({ kind: a.kind, points: svgPoints(a.points), box: polygonBox(a.points) })),
  buildings: (map.buildings ?? []).map((b) => ({ points: svgPoints(b), box: polygonBox(b) })),
  labels: map.labels ?? [],
});

const overlaps = (a: MapBox, w: MapBox | null): boolean => w === null || (a.maxX >= w.minX && a.minX <= w.maxX && a.maxZ >= w.minZ && a.minZ <= w.maxZ);
const inside = (l: MapLabelVm, w: MapBox | null): boolean => w === null || (l.x >= w.minX && l.x <= w.maxX && l.z >= w.minZ && l.z <= w.maxZ);

/** Surfaces and buildings in the window (all of them without one). */
export const CityShapes = memo(({ city, window, prefix }: { city: CityIndex; window: MapBox | null; prefix: string }) => (
  <g className={`${prefix}__city`}>
    {city.areas.map((a, i) => (overlaps(a.box, window) ? <polygon key={i} className={`${prefix}__surface ${prefix}__surface--${a.kind}`} points={a.points} /> : null))}
    {city.buildings.map((b, i) => (overlaps(b.box, window) ? <polygon key={i} className={`${prefix}__building`} points={b.points} /> : null))}
  </g>
));
CityShapes.displayName = "CityShapes";

/** A label's text: a catalogue key translated (an interior's name), the map's own name as it is. */
const labelText = (l: MapLabelVm, t: Translate): string => (l.key && isMessageKey(l.text) ? t(l.text) : l.text);

/** What a venue is, in words, for its icon's tooltip; nothing for a named interior, whose name says it. */
const venueWord = (l: MapLabelVm, t: Translate): string | null => {
  if (!l.venue || l.venue === "interior") return null;
  const key = venueKindKey(l.venue);
  return isMessageKey(key) ? t(key) : null;
};

/** A venue (ADR-0100): a small dot in its neon and its name beside it, `size` metres high. */
const Venue = ({ l, prefix, size, t }: { l: MapLabelVm; prefix: string; size: number; t: Translate }) => {
  const word = venueWord(l, t);
  return (
    <g className={`${prefix}__venue ${prefix}__venue--${l.venue === "interior" ? "interior" : "place"}`} transform={`translate(${l.x.toFixed(1)} ${(-l.z).toFixed(1)})`} data-testid={`${prefix}-venue`}>
      {word && <title>{word}</title>}
      <circle r={(size * 0.4).toFixed(2)} fill={l.color} />
      <text className={`${prefix}__label ${prefix}__label--venue`} x={(size * 0.7).toFixed(2)} y={0} fontSize={size}>
        {labelText(l, t)}
      </text>
    </g>
  );
};

/** Names along their streets, readable from the south, and the venues with theirs; `size` is the text height in metres. */
export const CityLabels = memo(
  ({ city, window, prefix, kinds, size }: { city: CityIndex; window: MapBox | null; prefix: string; kinds: ReadonlySet<MapLabelKind>; size: (kind: MapLabelKind) => number }) => {
    const t = useT();
    return (
      <g className={`${prefix}__labels`}>
        {city.labels.map((l, i) => {
          if (!kinds.has(l.kind) || !inside(l, window)) return null;
          if (l.kind === "venue") return <Venue key={i} l={l} prefix={prefix} size={size(l.kind)} t={t} />;
          const x = l.x.toFixed(1);
          const y = (-l.z).toFixed(1);
          const deg = ((-l.angle * 180) / Math.PI).toFixed(1);
          return (
            <text key={i} className={`${prefix}__label ${prefix}__label--${l.kind}`} x={x} y={y} fontSize={size(l.kind)} transform={l.angle !== 0 ? `rotate(${deg} ${x} ${y})` : undefined}>
              {labelText(l, t)}
            </text>
          );
        })}
      </g>
    );
  },
);
CityLabels.displayName = "CityLabels";

/** A square window of `half` metres round a point, the point snapped to `cell` so it changes rarely. */
export const windowAround = (x: number, z: number, half: number, cell: number): MapBox => {
  const cx = Math.round(x / cell) * cell;
  const cz = Math.round(z / cell) * cell;
  return { minX: cx - half, maxX: cx + half, minZ: cz - half, maxZ: cz + half };
};
