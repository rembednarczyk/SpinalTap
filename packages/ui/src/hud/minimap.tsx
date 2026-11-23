import { memo, useMemo } from "react";
import "../citymap/citymap.css";
import type { MapBox, MapFloorVm, MapLabelKind, MapLinkKind, MapLinkVm, CrimeMarkerVm, MapMarkerKind, MapMarkerVm, MapRectVm, MapVm } from "../store/ui-store";
import { useUi } from "../use-ui";
import { useT } from "../i18n/use-t";
import { isMessageKey } from "../i18n/t";
import { CityLabels, type CityIndex, CityShapes, indexCity, windowAround } from "./city-layer";
import { MetroEntranceIcons } from "../metro/metro-layer";
import { CrimeIcon } from "../citymap/crime-layer";

/** Metres from the player to the edge of the minimap. */
export const MINIMAP_RANGE = 32;
const EDGE = MINIMAP_RANGE - 2.5;

/** Icons of the level links (ADR-0021), about 4 m across: three steps, a cage with arrows, rungs. */
const LINK_ICON: Record<MapLinkKind, string> = {
  stairs: "M-2 2 H-0.7 V0.7 H0.7 V-0.7 H2 V-2",
  lift: "M-1.8 -1.8 H1.8 V1.8 H-1.8 Z M0 -1.2 L1 -0.2 H-1 Z M0 1.2 L1 0.2 H-1 Z",
  ladder: "M-1 -2 V2 M1 -2 V2 M-1 -1 H1 M-1 0 H1 M-1 1 H1",
};

const Link = ({ link }: { link: MapLinkVm }) => {
  const t = useT();
  return (
    <g className={`minimap__link minimap__link--${link.kind}`} transform={`translate(${link.x.toFixed(2)} ${(-link.z).toFixed(2)})`} data-testid={`minimap-link-${link.kind}`}>
      <title>{t(`map.link.${link.kind}`)}</title>
      <path d={LINK_ICON[link.kind]} />
    </g>
  );
};

const rect = (r: MapRectVm, className: string, key?: number) => (
  // Map space: x east, y = -z so north points up.
  <rect key={key} className={className} x={r.x - r.w / 2} y={-(r.z + r.d / 2)} width={r.w} height={r.d} />
);

/** The minimap's names: the streets, three metres high, and the venues near the player, two (ADR-0100). */
const STREET_NAMES: ReadonlySet<MapLabelKind> = new Set(["street", "venue"]);
const NAME_SIZE = (kind: MapLabelKind) => (kind === "venue" ? 2 : 3);
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
    {map.metro && <MetroEntranceIcons metro={map.metro} />}
    <CityLabels city={city} window={window} prefix="minimap" kinds={STREET_NAMES} size={NAME_SIZE} />
  </>
));
District.displayName = "District";

/** The rooms of the storey the player stands on (ADR-0100), over the dimmed street; re-renders on a new storey. */
const FloorPlan = memo(({ floor }: { floor: MapFloorVm }) => <g className="minimap__floor-plan">{floor.rooms.map((r, i) => rect(r, "minimap__room", i))}</g>);
FloorPlan.displayName = "FloorPlan";

/** The interior's name and its level, or how deep it lies, where the height over the street shows outdoors. */
const FloorName = ({ floor }: { floor: MapFloorVm }) => {
  const t = useT();
  const level = floor.level !== undefined ? t("map.floor.level", { n: floor.level }) : floor.depth !== undefined ? `▼ ${floor.depth} m` : null;
  return (
    <div className="minimap__floor" data-testid="minimap-floor" title={floor.depth !== undefined ? t("map.floor.below") : undefined}>
      <span className="minimap__floor-name">{isMessageKey(floor.name) ? t(floor.name) : floor.name}</span>
      {level !== null && <span className="minimap__floor-level">{level}</span>}
    </div>
  );
};

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
  return {
    x: player.x + Math.sin(player.yaw) * lead,
    z: player.z + Math.cos(player.yaw) * lead,
    k: 1 / Math.max(0.5, zoom),
  };
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
  // A ring, so a quest giver's own dot (Kaito's) still shows inside it.
  if (kind === "quest") return <circle r={3.4} />;
  return <circle r={2} />;
};

const Marker = ({ marker, view }: { marker: MapMarkerVm; view: MapView }) => {
  const o = markerOffset(marker, view);
  const area = marker.radius !== undefined && !o.edge;
  const t = useT();
  return (
    <g
      className={`minimap__marker minimap__marker--${marker.kind}${o.edge ? " minimap__marker--edge" : ""}${area ? " minimap__marker--area" : ""}`}
      transform={`translate(${o.x.toFixed(2)} ${o.y.toFixed(2)})`}
      data-testid={`minimap-marker-${marker.kind}`}
    >
      <title>{t(marker.kind === "target" && marker.radius !== undefined ? "map.marker.targetArea" : `map.marker.${marker.kind}`)}</title>
      {area ? <circle className="minimap__area" r={(marker.radius ?? 0) * (view.k ?? 1)} data-testid="minimap-area" /> : <MarkerIcon kind={marker.kind} />}
    </g>
  );
};

/** A phone over a civilian who is calling it in (ADR-0028). */
const Witness = ({ at, view }: { at: { x: number; z: number }; view: MapView }) => {
  const o = markerOffset(at, view);
  const t = useT();
  return (
    <g className={`minimap__witness${o.edge ? " minimap__marker--edge" : ""}`} transform={`translate(${o.x.toFixed(2)} ${o.y.toFixed(2)})`} data-testid="minimap-witness">
      <title>{t("map.witness")}</title>
      <rect x={-1.6} y={-2.6} width={3.2} height={5.2} rx={0.6} />
      <path d="M-0.8 -1.6 H0.8 M-0.4 1.8 H0.4" />
    </g>
  );
};

/** A crime of the street's board within 300 m or followed (ADR-0091 stage 6): its badge, at the edge when out of range. */
const Crime = ({ crime, view }: { crime: CrimeMarkerVm; view: MapView }) => {
  const o = markerOffset(crime, view);
  const t = useT();
  return (
    <g className={`crime crime--mini${crime.tracked ? " crime--tracked" : ""}${o.edge ? " minimap__marker--edge" : ""}`} transform={`translate(${o.x.toFixed(2)} ${o.y.toFixed(2)})`} data-testid="minimap-crime">
      <title>{crime.near ? t(`crime.kind.${crime.kind}`) : t("map.marker.crime")}</title>
      <CrimeIcon tracked={crime.tracked} />
    </g>
  );
};

/** Where the enemies last saw the player: a hollow silhouette (Deus Ex style). */
const Silhouette = ({ at, view }: { at: { x: number; z: number }; view: MapView }) => {
  const o = markerOffset(at, view);
  const t = useT();
  return (
    <g className="minimap__ghost" transform={`translate(${o.x.toFixed(2)} ${o.y.toFixed(2)})`} data-testid="minimap-last-known">
      <title>{t("map.lastKnown")}</title>
      <circle cx={0} cy={-2.2} r={1.1} />
      <path d="M-1.6 2.8 V0.4 Q-1.6 -0.8 0 -0.8 Q1.6 -0.8 1.6 0.4 V2.8 Z" />
    </g>
  );
};

/**
 * North-up minimap: district outline, view direction and what is worth finding. It zooms out
 * with speed and, while the player moves, looks ahead so the arrow sits in the lower third
 * (ADR-0035). The no-markers setting hides objective and fixer markers. Indoors it draws the
 * storey under the player over the dimmed street, with its name and level (ADR-0100).
 */
export const Minimap = () => {
  const t = useT();
  const map = useUi((s) => s.map);
  const player = useUi((s) => s.mapPlayer);
  const markers = useUi((s) => s.mapMarkers);
  const witnesses = useUi((s) => s.witnesses);
  const lastKnown = useUi((s) => s.lastKnown);
  const zoom = useUi((s) => s.mapZoom);
  const showMarkers = useUi((s) => s.settings.mapMarkers);
  const crimes = useUi((s) => s.crimeMarkers);
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
    <div className={`minimap${player.level !== undefined ? " minimap--upper" : ""}${player.floor ? " minimap--indoor" : ""}`} data-testid="minimap" data-zoom={zoom.toFixed(2)} aria-label={t("map.minimap")}>
      <svg viewBox={`${-MINIMAP_RANGE} ${-MINIMAP_RANGE} ${MINIMAP_RANGE * 2} ${MINIMAP_RANGE * 2}`} role="img">
        <g transform={`scale(${view.k.toFixed(3)}) translate(${(-view.x).toFixed(2)} ${view.z.toFixed(2)})`}>
          <District map={map} city={city} window={window} />
          {player.floor && <FloorPlan floor={player.floor} />}
        </g>
        {showMarkers && markers.map((m) => <Marker key={m.id} marker={m} view={view} />)}
        {showMarkers && crimes.filter((c) => c.near || c.tracked).map((c) => <Crime key={c.id} crime={c} view={view} />)}
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
      {player.floor && <FloorName floor={player.floor} />}
      {player.level !== undefined && (
        <div className="minimap__level" data-testid="minimap-level" title={t("map.above")}>
          ▲ {player.level} m
        </div>
      )}
    </div>
  );
};
