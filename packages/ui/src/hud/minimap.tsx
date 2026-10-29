import { memo, useMemo } from "react";
import "../citymap/citymap.css";
import type { MapBox, MapLabelKind, MapLinkKind, MapLinkVm, MapMarkerKind, MapMarkerVm, MapRectVm, MapVm } from "../store/ui-store";
import { useUi } from "../use-ui";
import { CityLabels, type CityIndex, CityShapes, indexCity, windowAround } from "./city-layer";

/** Metres from the player to the edge of the minimap. */
export const MINIMAP_RANGE = 32;
const EDGE = MINIMAP_RANGE - 2.5;

const LABEL: Record<MapMarkerKind, string> = { fixer: "Zlecenia", ripperdoc: "Klinika Mori", vendor: "Sklep", target: "Cel", enforcer: "Egzekutor: widzi przez przebranie" };

const LINK_LABEL: Record<MapLinkKind, string> = { stairs: "Schody", lift: "Winda", ladder: "Drabina" };

/** Icons of the level links (ADR-0021), about 4 m across: three steps, a cage with arrows, rungs. */
const LINK_ICON: Record<MapLinkKind, string> = {
  stairs: "M-2 2 H-0.7 V0.7 H0.7 V-0.7 H2 V-2",
  lift: "M-1.8 -1.8 H1.8 V1.8 H-1.8 Z M0 -1.2 L1 -0.2 H-1 Z M0 1.2 L1 0.2 H-1 Z",
  ladder: "M-1 -2 V2 M1 -2 V2 M-1 -1 H1 M-1 0 H1 M-1 1 H1",
};

const Link = ({ link }: { link: MapLinkVm }) => (
  <g className={`minimap__link minimap__link--${link.kind}`} transform={`translate(${link.x.toFixed(2)} ${(-link.z).toFixed(2)})`} data-testid={`minimap-link-${link.kind}`}>
    <title>{LINK_LABEL[link.kind]}</title>
    <path d={LINK_ICON[link.kind]} />
  </g>
);

const rect = (r: MapRectVm, className: string, key?: number) => (
  // Map space: x east, y = -z so north points up.
  <rect key={key} className={className} x={r.x - r.w / 2} y={-(r.z + r.d / 2)} width={r.w} height={r.d} />
);

/** The minimap's names: the streets only, three metres high. */
const STREET_NAMES: ReadonlySet<MapLabelKind> = new Set(["street"]);
const NAME_SIZE = () => 3;
/** Half the side of the window of the city drawn round the player, and its grid (ADR-0045). */
const CITY_WINDOW = 100;
const CITY_CELL = 32;

/** District layer; it re-renders when the geometry changes or the player crosses a cell of the city's window. */
const District = memo(({ map, city, window }: { map: MapVm; city: CityIndex; window: MapBox }) => (
  <>
    {map.ground ? map.ground.map((g, i) => rect(g, "minimap__ground", i)) : rect(map.bounds, "minimap__ground")}
    <CityShapes city={city} window={window} prefix="minimap" />
    {map.water?.map((w, i) => rect(w, "minimap__water", i))}
    {map.streets.map((s, i) => rect(s, "minimap__street", i))}
    {map.blocks.map((b, i) => rect(b, "minimap__block", i))}
    {map.decks?.map((d, i) => rect(d, "minimap__deck", i))}
    {map.links?.map((l, i) => (
      <Link key={i} link={l} />
    ))}
    <CityLabels city={city} window={window} prefix="minimap" kinds={STREET_NAMES} size={NAME_SIZE} />
  </>
));
District.displayName = "District";

/**
 * What the minimap is centred on and how much it shrinks the world: `k` is 1 at the default
 * range and smaller while zoomed out, so markers keep their size (ADR-0035).
 */
export interface MapView {
  readonly x: number;
  readonly z: number;
  readonly k?: number;
}

/** Share of the range the view looks ahead while moving: the arrow sits in the lower third. */
export const LOOK_AHEAD = 1 / 3;

/** The view of a frame: centred on the player, or ahead of a moving one along the view direction. */
export const mapView = (player: { x: number; z: number; yaw: number; moving?: boolean }, zoom = 1): Required<MapView> => {
  const lead = player.moving ? MINIMAP_RANGE * zoom * LOOK_AHEAD : 0;
  return { x: player.x + Math.sin(player.yaw) * lead, z: player.z + Math.cos(player.yaw) * lead, k: 1 / Math.max(0.5, zoom) };
};

/** Marker position relative to the view centre; markers out of range stick to the edge. */
export const markerOffset = (m: { x: number; z: number }, view: MapView): { x: number; y: number; edge: boolean } => {
  const k = view.k ?? 1;
  const x = (m.x - view.x) * k;
  const y = -(m.z - view.z) * k;
  const dist = Math.hypot(x, y);
  if (dist <= EDGE) return { x, y, edge: false };
  const s = EDGE / dist;
  return { x: x * s, y: y * s, edge: true };
};

const MarkerIcon = ({ kind }: { kind: MapMarkerKind }) => {
  if (kind === "target") return <path d="M0 -2.6 L2.6 0 L0 2.6 L-2.6 0 Z" />;
  // An enforcer: a shield with a slit, the one who sees through a disguise.
  if (kind === "enforcer") return <path d="M0 -2.8 L2.4 -1.8 V0.6 Q2.4 2.2 0 3 Q-2.4 2.2 -2.4 0.6 V-1.8 Z M-1.2 0 H1.2" />;
  return <circle r={2} />;
};

const Marker = ({ marker, view }: { marker: MapMarkerVm; view: MapView }) => {
  const o = markerOffset(marker, view);
  const area = marker.radius !== undefined && !o.edge;
  return (
    <g
      className={`minimap__marker minimap__marker--${marker.kind}${o.edge ? " minimap__marker--edge" : ""}${area ? " minimap__marker--area" : ""}`}
      transform={`translate(${o.x.toFixed(2)} ${o.y.toFixed(2)})`}
      data-testid={`minimap-marker-${marker.kind}`}
    >
      <title>{marker.kind === "target" && marker.radius !== undefined ? "Obszar celu" : LABEL[marker.kind]}</title>
      {area ? <circle className="minimap__area" r={(marker.radius ?? 0) * (view.k ?? 1)} data-testid="minimap-area" /> : <MarkerIcon kind={marker.kind} />}
    </g>
  );
};

/** A phone over a civilian who is calling it in (ADR-0028). */
const Witness = ({ at, view }: { at: { x: number; z: number }; view: MapView }) => {
  const o = markerOffset(at, view);
  return (
    <g className={`minimap__witness${o.edge ? " minimap__marker--edge" : ""}`} transform={`translate(${o.x.toFixed(2)} ${o.y.toFixed(2)})`} data-testid="minimap-witness">
      <title>Świadek dzwoni</title>
      <rect x={-1.6} y={-2.6} width={3.2} height={5.2} rx={0.6} />
      <path d="M-0.8 -1.6 H0.8 M-0.4 1.8 H0.4" />
    </g>
  );
};

/** Where the enemies last saw the player: a hollow silhouette (Deus Ex style). */
const Silhouette = ({ at, view }: { at: { x: number; z: number }; view: MapView }) => {
  const o = markerOffset(at, view);
  return (
    <g className="minimap__ghost" transform={`translate(${o.x.toFixed(2)} ${o.y.toFixed(2)})`} data-testid="minimap-last-known">
      <title>Ostatnia znana pozycja</title>
      <circle cx={0} cy={-2.2} r={1.1} />
      <path d="M-1.6 2.8 V0.4 Q-1.6 -0.8 0 -0.8 Q1.6 -0.8 1.6 0.4 V2.8 Z" />
    </g>
  );
};

/**
 * North-up minimap: district outline, view direction and what is worth finding. It zooms out
 * with speed and, while the player moves, looks ahead so the arrow sits in the lower third
 * (ADR-0035). The no-markers setting hides objective and fixer markers.
 */
export const Minimap = () => {
  const map = useUi((s) => s.map);
  const player = useUi((s) => s.mapPlayer);
  const markers = useUi((s) => s.mapMarkers);
  const witnesses = useUi((s) => s.witnesses);
  const lastKnown = useUi((s) => s.lastKnown);
  const zoom = useUi((s) => s.mapZoom);
  const showMarkers = useUi((s) => s.settings.mapMarkers);
  const city = useMemo(() => (map ? indexCity(map) : null), [map]);
  const cx = player ? Math.round(player.x / CITY_CELL) : 0;
  const cz = player ? Math.round(player.z / CITY_CELL) : 0;
  const window = useMemo(() => windowAround(cx * CITY_CELL, cz * CITY_CELL, CITY_WINDOW, CITY_CELL), [cx, cz]);
  if (!map || !player || !city) return null;
  const deg = (player.yaw * 180) / Math.PI;
  const view = mapView(player, zoom);
  const me = markerOffset(player, view);
  const at = me.x === 0 && me.y === 0 ? "" : `translate(${me.x.toFixed(2)} ${me.y.toFixed(2)}) `;
  return (
    <div className={`minimap${player.level !== undefined ? " minimap--upper" : ""}`} data-testid="minimap" data-zoom={zoom.toFixed(2)} aria-label="Minimapa">
      <svg viewBox={`${-MINIMAP_RANGE} ${-MINIMAP_RANGE} ${MINIMAP_RANGE * 2} ${MINIMAP_RANGE * 2}`} role="img">
        <g transform={`scale(${view.k.toFixed(3)}) translate(${(-view.x).toFixed(2)} ${view.z.toFixed(2)})`}>
          <District map={map} city={city} window={window} />
        </g>
        {showMarkers && markers.map((m) => <Marker key={m.id} marker={m} view={view} />)}
        {lastKnown && <Silhouette at={lastKnown} view={view} />}
        {witnesses.map((w) => (
          <Witness key={w.id} at={w} view={view} />
        ))}
        <g className="minimap__player" transform={`${at}rotate(${deg.toFixed(1)})`} data-testid="minimap-player">
          <path className="minimap__cone" d="M0 0 L-7 -14 A16 16 0 0 1 7 -14 Z" />
          <path className="minimap__arrow" d="M0 -3.4 L2.4 2.4 L0 1.2 L-2.4 2.4 Z" />
        </g>
      </svg>
      <div className="minimap__north">N</div>
      {player.level !== undefined && (
        <div className="minimap__level" data-testid="minimap-level" title="Jesteś wyżej niż ulica">
          ▲ {player.level} m
        </div>
      )}
    </div>
  );
};
