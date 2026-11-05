import { memo, useMemo } from "react";
import type { Locale, MetroStationId } from "@seki/core";
import "./metro.css";
import { useT } from "../i18n/use-t";
import { formatNumber, useLocale } from "../i18n/number";
import { type MapBox, svgPoints } from "../store/map-vm";
import type { MapMetroEntranceVm, MapMetroPlannedVm, MapMetroStationVm, MapMetroVm } from "../store/metro-vm";
import { type NameItem, type NamePlace, nameOffset, placeNames } from "./metro-labels";

export type { NamePlace } from "./metro-labels";

/**
 * The metro as a layer over a map (ADR-0071), in map space (x east, y = −z): the tunnel in the
 * line's amber, a ring with "M" for each station, a lettered tag for each entrance and the
 * possible stations dashed with a hollow ring. `k` is metres per icon unit, so the icons keep
 * their size on screen while the view zooms. A route lights its legs and its stops. Names give
 * way where they would run into each other (`metro-labels.ts`).
 */
export interface MetroLayerProps {
  readonly metro: MapMetroVm;
  readonly k: number;
  /** The stations of the planned ride, both ends included. */
  readonly route?: readonly MetroStationId[];
  readonly here?: MetroStationId | null;
  readonly selected?: MetroStationId | null;
  /** The side each station's name is tried on first, or none; over the ring when absent. */
  readonly names?: (id: MetroStationId) => NamePlace;
  /** A click on a station's ring (the kiosk's map); the list next to it stays for the keyboard. */
  readonly onPick?: (id: MetroStationId) => void;
  /** Prefix of the test ids, for a second layer on the same screen (the card's close-up). */
  readonly scope?: string;
  /** The view: a possible station outside it is pinned to its edge, its line running on out of view. */
  readonly clamp?: MapBox;
}

const STATION_RING = 7;
const PLANNED_RING = 6;
const NAME = 11;
const NOTE = 9;

/** A distance in kilometres to one decimal, as the language writes it. */
export const kmOf = (locale: Locale, metres: number): string => formatNumber(locale, Math.round(metres / 100) / 10, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const xy = (x: number, z: number) => `translate(${x.toFixed(1)} ${(-z).toFixed(1)})`;

const Leg = ({ points, lit }: { points: readonly number[]; lit: boolean }) => <polyline className={`metro-layer__leg${lit ? " metro-layer__leg--route" : ""}`} points={svgPoints(points)} />;

/** A possible station's ring, kept inside the view by `inset` metres. */
const pinned = (p: MapMetroPlannedVm, clamp: MapBox | undefined, inset: number): { x: number; z: number } => {
  if (!clamp) return { x: p.x, z: p.z };
  return { x: Math.min(clamp.maxX - inset, Math.max(clamp.minX + inset, p.x)), z: Math.min(clamp.maxZ - inset, Math.max(clamp.minZ + inset, p.z)) };
};

interface PlannedProps {
  readonly p: MapMetroPlannedVm;
  readonly at: { x: number; z: number };
  readonly k: number;
  readonly from: string;
  readonly scope: string;
  readonly name: NamePlace;
  readonly note: NamePlace;
}

const Planned = ({ p, at, k, from, scope, name, note }: PlannedProps) => {
  const t = useT();
  const locale = useLocale();
  const km = kmOf(locale, p.distance);
  return (
    <g className="metro-layer__planned" data-testid={`${scope}-planned-${p.id}`}>
      {p.path.length > 0 && <polyline className="metro-layer__dash" points={svgPoints(p.path)} strokeWidth={2 * k} strokeDasharray={`${(7 * k).toFixed(1)} ${(4 * k).toFixed(1)}`} />}
      <g transform={xy(at.x, at.z)}>
        <title>{`${p.name}: ${t("metro.planned")}, ${t("metro.planned.distance", { km, station: from })}`}</title>
        <circle className="metro-layer__ring metro-layer__ring--planned" r={PLANNED_RING * k} />
        {name && (
          <text className="metro-layer__name" y={nameOffset(PLANNED_RING, NAME, name) * k} fontSize={NAME * k}>
            {p.name}
          </text>
        )}
        {note && (
          <text className="metro-layer__note" y={nameOffset(PLANNED_RING, NOTE, note) * k} fontSize={NOTE * k}>
            {t("metro.planned.short", { km })}
          </text>
        )}
      </g>
    </g>
  );
};

const Entrance = ({ e, k }: { e: MapMetroEntranceVm; k: number }) => {
  const t = useT();
  return (
    <g className="metro-layer__entrance" transform={`${xy(e.x, e.z)} translate(${(8 * k).toFixed(1)} ${(-8 * k).toFixed(1)})`}>
      <title>{t("metro.entrance", { label: e.label, name: e.name })}</title>
      <rect x={-3.5 * k} y={-3.5 * k} width={7 * k} height={7 * k} rx={1 * k} />
      <text fontSize={6 * k}>{e.label}</text>
    </g>
  );
};

interface StationProps {
  readonly s: MapMetroStationVm;
  readonly k: number;
  readonly state: string;
  readonly named: NamePlace;
  readonly scope: string;
  readonly onPick?: (id: MetroStationId) => void;
}

const Station = ({ s, k, state, named, scope, onPick }: StationProps) => (
  <g className={`metro-layer__station${state}`} data-testid={`${scope}-station-${s.id}`} onClick={onPick ? () => onPick(s.id) : undefined}>
    {s.entrances.map((e) => (
      <Entrance key={e.label} e={e} k={k} />
    ))}
    <g transform={xy(s.x, s.z)}>
      <title>{`${s.name} · ${s.district}`}</title>
      <circle className="metro-layer__ring" r={STATION_RING * k} />
      <text className="metro-layer__m" fontSize={8 * k}>
        M
      </text>
      {named && (
        <text className="metro-layer__name" y={nameOffset(STATION_RING, NAME, named) * k} fontSize={NAME * k}>
          {s.name}
        </text>
      )}
    </g>
  </g>
);

const stateOf = (id: MetroStationId, p: MetroLayerProps): string => {
  if (id === p.here) return " metro-layer__station--here";
  if (id === p.selected) return " metro-layer__station--to";
  return p.route?.includes(id) ? " metro-layer__station--route" : "";
};

/** The names to place, the platform and the destination first, the possible stations' notes last. */
const nameItems = (p: MetroLayerProps, pins: ReadonlyMap<string, { x: number; z: number }>, note: (pl: MapMetroPlannedVm) => string): NameItem[] => {
  const first = (id: MetroStationId) => (id === p.here || id === p.selected ? 0 : 1);
  const stations = [...p.metro.stations].sort((a, b) => first(a.id) - first(b.id));
  const planned = p.metro.planned.map((pl) => ({ pl, at: pins.get(pl.id) ?? pl }));
  return [
    ...stations.map((s): NameItem => ({ id: s.id, name: s.name, x: s.x, z: s.z, ring: STATION_RING, size: NAME, prefer: p.names ? p.names(s.id) : "above" })),
    ...planned.map(({ pl, at }): NameItem => ({ id: `planned:${pl.id}`, name: pl.name, x: at.x, z: at.z, ring: PLANNED_RING, size: NAME, prefer: "above" })),
    ...planned.map(({ pl, at }): NameItem => ({ id: `note:${pl.id}`, name: note(pl), x: at.x, z: at.z, ring: PLANNED_RING, size: NOTE, prefer: "below", only: true })),
  ];
};

export const MetroLayer = memo((p: MetroLayerProps) => {
  const { metro, k, route } = p;
  const t = useT();
  const locale = useLocale();
  const scope = p.scope ?? "metro";
  const lit = (i: number) => (route ?? []).includes(metro.stations[i]?.id as MetroStationId) && (route ?? []).includes(metro.stations[i + 1]?.id as MetroStationId);
  const nameOf = (id: MetroStationId) => metro.stations.find((s) => s.id === id)?.name ?? id;
  const pins = useMemo(() => new Map(metro.planned.map((pl) => [pl.id, pinned(pl, p.clamp, 30 * k)])), [metro, p.clamp, k]);
  const places = placeNames(
    nameItems(p, pins, (pl) => t("metro.planned.short", { km: kmOf(locale, pl.distance) })),
    k,
  );
  return (
    <g className="metro-layer" data-testid={`${scope}-layer`}>
      {metro.legs.map((leg, i) => (
        <Leg key={i} points={leg} lit={lit(i)} />
      ))}
      {/* Over the tunnel: a possible station on the line keeps its ring and name on top of a lit route. */}
      {metro.planned.map((pl) => (
        <Planned key={pl.id} p={pl} at={pins.get(pl.id) ?? pl} k={k} from={nameOf(pl.from)} scope={scope} name={places.get(`planned:${pl.id}`) ?? null} note={places.get(`note:${pl.id}`) ?? null} />
      ))}
      {metro.stations.map((s) => (
        <Station key={s.id} s={s} k={k} state={stateOf(s.id, p)} named={places.get(s.id) ?? null} scope={scope} onPick={p.onPick} />
      ))}
    </g>
  );
});
MetroLayer.displayName = "MetroLayer";

/** The minimap's part of the layer: only the entrances, an "M" in a square about 5 m across. */
export const MetroEntranceIcons = memo(({ metro }: { metro: MapMetroVm }) => {
  const t = useT();
  return (
    <g className="minimap__metro">
      {metro.stations.flatMap((s) =>
        s.entrances.map((e) => (
          <g key={`${s.id}-${e.label}`} className="minimap__metro-entrance" transform={xy(e.x, e.z)} data-testid={`minimap-metro-${s.id}`}>
            <title>{`${t("metro.entranceIcon")}: ${s.name} ${e.label}`}</title>
            <rect x={-2.6} y={-2.6} width={5.2} height={5.2} rx={0.8} />
            <text fontSize={4}>M</text>
          </g>
        )),
      )}
    </g>
  );
});
MetroEntranceIcons.displayName = "MetroEntranceIcons";
