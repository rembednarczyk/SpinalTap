import type { EntityId } from "@seki/core";
import { KIOSK_SIZE, type MetroStationDef, kioskView } from "../content/metro";
import { aabbFromCenter } from "./collision";
import type { Entity } from "./components";
import { propEntity } from "./factory";

/** Makers of a metro platform's entities (ADR-0034): its props and the kiosk, unkeyed content. */
export const metroPieces = (station: MetroStationDef): ((id: EntityId) => Entity)[] => [
  ...station.props.map((prop) => (id: EntityId) => propEntity(id, prop, station.chunk)),
  (id: EntityId): Entity => {
    const centre = { x: station.kiosk.x, y: station.kiosk.y + KIOSK_SIZE.y / 2, z: station.kiosk.z };
    return {
      id,
      chunk: station.chunk,
      position: centre,
      prevPosition: centre,
      yaw: station.yaw,
      prevYaw: station.yaw,
      pitch: 0,
      view: kioskView,
      solid: aabbFromCenter(centre, KIOSK_SIZE),
      // Centred at chest height: the interaction's height check keeps it to the ground level.
      interactable: { kind: "metro", station: station.id, dialogueId: `metro_${station.id}`, prompt: "Bilet", radius: 1.8 },
    };
  },
];
