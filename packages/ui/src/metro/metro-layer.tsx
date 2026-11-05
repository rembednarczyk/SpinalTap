import { memo } from "react";
import type { MetroStationId } from "@seki/core";
import "./metro.css";
import { useT } from "../i18n/use-t";
import { formatNumber, useLocale } from "../i18n/number";
import { svgPoints } from "../store/map-vm";
import type { MapMetroEntranceVm, MapMetroPlannedVm, MapMetroStationVm, MapMetroVm } from "../store/metro-vm";

/**
 * The metro as a layer over a map (ADR-0071), in map space (x east, y = −z): the tunnel in the
 * line's amber, a ring with "M" for each station, a lettered tag for each entrance and the
 * possible stations dashed with a hollow ring. `k` is metres per icon unit, so the icons keep
 * their size on screen while the view zooms. A route lights its legs and its stops.
 */
export interface MetroLayerProps {
  readonly metro: MapMetroVm;
  readonly k: number;
  /** The stations of the planned ride, both ends included. */
  readonly route?: readonly MetroStationId[];
  readonly here?: MetroStationId | null;
  readonly selected?: MetroStationId | null;
  /** Where each station's name goes, over or under its ring, or none; all over when absent. */
  readonly names?: (id: MetroStationId) => NamePlace;
  /** A click on a station's ring (the kiosk's map); the list next to it stays for the keyboard. */
  readonly onPick?: (id: MetroStationId) => void;
  /** Prefix of the test ids, for a second layer on the same screen (the card's close-up). */
  readonly scope?: string;
}

/** Where a station's name goes. */
export type NamePlace = "above" | "below" | null;

const xy = (x: number, z: number) => `translate(${x.toFixed(1)} ${(-z).toFixed(1)})`;

const Leg = ({ points, lit }: { points: readonly number[]; lit: boolean }) => <polyline className={`metro-layer__leg${lit ? " metro-layer__leg--route" : ""}`} points={svgPoints(points)} />;

const Planned = ({ p, k, from, scope }: { p: MapMetroPlannedVm; k: number; from: string; scope: string }) => {
  const t = useT();
  const locale = useLocale();
  const km = formatNumber(locale, Math.round(p.distance / 100) / 10, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <g className="metro-layer__planned" data-testid={`${scope}-planned-${p.id}`}>
      <polyline className="metro-layer__dash" points={svgPoints(p.path)} strokeDasharray={`${(6 * k).toFixed(1)} ${(5 * k).toFixed(1)}`} />
      <g transform={xy(p.x, p.z)}>
        <title>{`${p.name}: ${t("metro.planned")}, ${t("metro.planned.distance", { km, station: from })}`}</title>
        <circle className="metro-layer__ring metro-layer__ring--planned" r={6 * k} />
        <text className="metro-layer__name" y={-11 * k} fontSize={11 * k}>
          {p.name}
        </text>
        <text className="metro-layer__note" y={15 * k} fontSize={9 * k}>
          {t("metro.planned.short", { km })}
        </text>
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
      <circle className="metro-layer__ring" r={7 * k} />
      <text className="metro-layer__m" fontSize={8 * k}>
        M
      </text>
      {named && (
        <text className="metro-layer__name" y={(named === "above" ? -13 : 14) * k} fontSize={11 * k}>
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

export const MetroLayer = memo((p: MetroLayerProps) => {
  const { metro, k, route } = p;
  const scope = p.scope ?? "metro";
  const lit = (i: number) => (route ?? []).includes(metro.stations[i]?.id as MetroStationId) && (route ?? []).includes(metro.stations[i + 1]?.id as MetroStationId);
  const nameOf = (id: MetroStationId) => metro.stations.find((s) => s.id === id)?.name ?? id;
  return (
    <g className="metro-layer" data-testid={`${scope}-layer`}>
      {metro.planned.map((pl) => (
        <Planned key={pl.id} p={pl} k={k} from={nameOf(pl.from)} scope={scope} />
      ))}
      {metro.legs.map((leg, i) => (
        <Leg key={i} points={leg} lit={lit(i)} />
      ))}
      {metro.stations.map((s) => (
        <Station key={s.id} s={s} k={k} state={stateOf(s.id, p)} named={p.names ? p.names(s.id) : "above"} scope={scope} onPick={p.onPick} />
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
