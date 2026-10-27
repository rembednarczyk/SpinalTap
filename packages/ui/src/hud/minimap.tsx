import { memo } from "react";
import type { MapMarkerKind, MapMarkerVm, MapRectVm, MapVm } from "../store/ui-store";
import { useUi } from "../use-ui";

/** Metres from the player to the edge of the minimap. */
export const MINIMAP_RANGE = 32;
const EDGE = MINIMAP_RANGE - 2.5;

const LABEL: Record<MapMarkerKind, string> = { fixer: "Kaito", ripperdoc: "Mori", target: "Cel" };

const rect = (r: MapRectVm, className: string, key?: number) => (
  // Map space: x east, y = -z so north points up.
  <rect key={key} className={className} x={r.x - r.w / 2} y={-(r.z + r.d / 2)} width={r.w} height={r.d} />
);

/** District layer; it only re-renders when the geometry changes, not when the player moves. */
const District = memo(({ map }: { map: MapVm }) => (
  <>
    {rect(map.bounds, "minimap__ground")}
    {map.streets.map((s, i) => rect(s, "minimap__street", i))}
    {map.blocks.map((b, i) => rect(b, "minimap__block", i))}
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
    <div className="minimap" data-testid="minimap" aria-label="Minimapa">
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
    </div>
  );
};
