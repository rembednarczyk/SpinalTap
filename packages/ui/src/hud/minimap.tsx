import { memo } from "react";
import type { MapLinkKind, MapLinkVm, MapMarkerKind, MapMarkerVm, MapRectVm, MapVm } from "../store/ui-store";
import { useUi } from "../use-ui";

/** Metres from the player to the edge of the minimap. */
export const MINIMAP_RANGE = 32;
const EDGE = MINIMAP_RANGE - 2.5;

const LABEL: Record<MapMarkerKind, string> = { fixer: "Zlecenia", ripperdoc: "Klinika Mori", vendor: "Sklep", target: "Cel" };

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

/** District layer; it only re-renders when the geometry changes, not when the player moves. */
const District = memo(({ map }: { map: MapVm }) => (
  <>
    {rect(map.bounds, "minimap__ground")}
    {map.water?.map((w, i) => rect(w, "minimap__water", i))}
    {map.streets.map((s, i) => rect(s, "minimap__street", i))}
    {map.blocks.map((b, i) => rect(b, "minimap__block", i))}
    {map.decks?.map((d, i) => rect(d, "minimap__deck", i))}
    {map.links?.map((l, i) => (
      <Link key={i} link={l} />
    ))}
  </>
));
District.displayName = "District";

/** Marker position relative to the player; markers out of range stick to the edge. */
export const markerOffset = (m: { x: number; z: number }, player: { x: number; z: number }): { x: number; y: number; edge: boolean } => {
  const x = m.x - player.x;
  const y = -(m.z - player.z);
  const dist = Math.hypot(x, y);
  if (dist <= EDGE) return { x, y, edge: false };
  const k = EDGE / dist;
  return { x: x * k, y: y * k, edge: true };
};

const Marker = ({ marker, player }: { marker: MapMarkerVm; player: { x: number; z: number } }) => {
  const o = markerOffset(marker, player);
  return (
    <g
      className={`minimap__marker minimap__marker--${marker.kind}${o.edge ? " minimap__marker--edge" : ""}`}
      transform={`translate(${o.x.toFixed(2)} ${o.y.toFixed(2)})`}
      data-testid={`minimap-marker-${marker.kind}`}
    >
      <title>{LABEL[marker.kind]}</title>
      {marker.kind === "target" ? <path d="M0 -2.6 L2.6 0 L0 2.6 L-2.6 0 Z" /> : <circle r={2} />}
    </g>
  );
};

/** North-up minimap centred on the player: district outline, view direction and key NPCs. */
export const Minimap = () => {
  const map = useUi((s) => s.map);
  const player = useUi((s) => s.mapPlayer);
  const markers = useUi((s) => s.mapMarkers);
  if (!map || !player) return null;
  const deg = (player.yaw * 180) / Math.PI;
  return (
    <div className={`minimap${player.level !== undefined ? " minimap--upper" : ""}`} data-testid="minimap" aria-label="Minimapa">
      <svg viewBox={`${-MINIMAP_RANGE} ${-MINIMAP_RANGE} ${MINIMAP_RANGE * 2} ${MINIMAP_RANGE * 2}`} role="img">
        <g transform={`translate(${(-player.x).toFixed(2)} ${player.z.toFixed(2)})`}>
          <District map={map} />
        </g>
        {markers.map((m) => (
          <Marker key={m.id} marker={m} player={player} />
        ))}
        <g className="minimap__player" transform={`rotate(${deg.toFixed(1)})`} data-testid="minimap-player">
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
