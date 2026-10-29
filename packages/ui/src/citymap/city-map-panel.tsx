import { memo, useMemo } from "react";
import "./citymap.css";
import { CityLabels, type CityIndex, CityShapes, EMPTY_CITY, indexCity } from "../hud/city-layer";
import { MAP_ATTRIBUTION, type MapLabelKind } from "../store/map-vm";
import type { MapMarkerVm, MapPlayerVm, MapRectVm, MapVm } from "../store/ui-store";
import { useUi } from "../use-ui";
import { type CityMapView, useMapView } from "./use-map-view";

/** Names on the map tab by zoom: streets and landmarks only close enough to read them. */
const kindsAt = (span: number): ReadonlySet<MapLabelKind> =>
  new Set<MapLabelKind>(span <= 900 ? ["street", "district", "landmark", "station"] : span <= 1500 ? ["district", "landmark", "station"] : ["district", "station"]);

/** Text heights in metres, growing with the view so they stay about the same size on screen. */
const sizeAt =
  (span: number) =>
  (kind: MapLabelKind): number => {
    const base = span / 75;
    return kind === "district" ? base * 2.4 : kind === "street" ? Math.max(2.5, base) : base * 1.15;
  };

const rect = (r: MapRectVm, className: string, key: number) => <rect key={key} className={className} x={r.x - r.w / 2} y={-(r.z + r.d / 2)} width={r.w} height={r.d} />;

/** The whole city, drawn once per map: the view moves over it. */
const Base = memo(({ map, city }: { map: MapVm; city: CityIndex }) => (
  <>
    {(map.ground ?? [map.bounds]).map((g, i) => rect(g, "citymap__ground", i))}
    <CityShapes city={city} window={null} prefix="citymap" />
    {map.water?.map((w, i) => rect(w, "citymap__water", i))}
    {map.blocks.map((b, i) => rect(b, "citymap__block", i))}
  </>
));
Base.displayName = "Base";

const Marker = ({ m, k }: { m: MapMarkerVm; k: number }) => (
  <g className={`citymap__marker citymap__marker--${m.kind}`} transform={`translate(${m.x.toFixed(1)} ${(-m.z).toFixed(1)})`} data-testid={`citymap-marker-${m.kind}`}>
    {m.radius !== undefined ? <circle className="citymap__area" r={m.radius} /> : <circle r={4 * k} />}
  </g>
);

const Player = ({ p, k }: { p: MapPlayerVm; k: number }) => (
  <g className="citymap__player" transform={`translate(${p.x.toFixed(1)} ${(-p.z).toFixed(1)}) rotate(${((p.yaw * 180) / Math.PI).toFixed(1)}) scale(${k.toFixed(2)})`} data-testid="citymap-player">
    <path d="M0 -7 L5 5 L0 2.5 L-5 5 Z" />
  </g>
);

const viewBox = (v: CityMapView) => `${(v.x - v.span / 2).toFixed(1)} ${(-v.z - v.span / 2).toFixed(1)} ${v.span.toFixed(1)} ${v.span.toFixed(1)}`;

/**
 * The map tab of the character screen (M, ADR-0045): Lublin from the map data with its street
 * names, the districts, landmarks and metro stations, the player and what is worth finding.
 * Drag to move, the wheel or the buttons to zoom; the district buttons jump there.
 */
export const CityMapPanel = () => {
  const map = useUi((s) => s.map);
  const player = useUi((s) => s.mapPlayer);
  const markers = useUi((s) => s.mapMarkers);
  const showMarkers = useUi((s) => s.settings.mapMarkers);
  const city = useMemo(() => (map ? indexCity(map) : EMPTY_CITY), [map]);
  const { view, zoomIn, zoomOut, centre, handlers } = useMapView({ x: player?.x ?? 0, z: player?.z ?? 0, span: 420 });
  const kinds = useMemo(() => kindsAt(view.span), [view.span]);
  const size = useMemo(() => sizeAt(view.span), [view.span]);
  if (!map) return <p className="sheet__empty">Brak mapy.</p>;
  // Icons keep their size on screen: 1 at a 420 m view.
  const k = view.span / 420;
  return (
    <div className="citymap" data-testid="city-map">
      <svg className="citymap__svg" viewBox={viewBox(view)} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa Lublina" {...handlers}>
        <Base map={map} city={city} />
        <CityLabels city={city} window={null} prefix="citymap" kinds={kinds} size={size} />
        {showMarkers && markers.map((m) => <Marker key={m.id} m={m} k={k} />)}
        {player && <Player p={player} k={k} />}
      </svg>
      <div className="citymap__tools">
        <button type="button" className="citymap__btn" onClick={zoomIn} aria-label="Przybliż">
          +
        </button>
        <button type="button" className="citymap__btn" onClick={zoomOut} aria-label="Oddal">
          −
        </button>
        {player && (
          <button type="button" className="citymap__btn citymap__btn--wide" onClick={() => centre(player.x, player.z)}>
            Ja
          </button>
        )}
        {(map.places ?? []).map((p) => (
          <button key={p.name} type="button" className="citymap__btn citymap__btn--wide" onClick={() => centre(p.x, p.z)}>
            {p.name}
          </button>
        ))}
      </div>
      <div className="citymap__credit" data-testid="map-attribution">
        {MAP_ATTRIBUTION}
      </div>
    </div>
  );
};
