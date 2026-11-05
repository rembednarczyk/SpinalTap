import type { EntityId, MetroStationId } from "@seki/core";
import type { MetroEntranceDef } from "../content/metro";
import { aabbFromCenter } from "./collision";
import type { Entity } from "./components";
import { propEntity } from "./factory";

/**
 * Makers of a metro entrance's entities (ADR-0071 stage 2): the pavilion's solids and the ticket
 * machine in its hall, unkeyed content of the entrance's chunk. None has a view: the renderer
 * bakes the pavilion into the street furniture's meshes from the same content (`pavilion-bake.ts`).
 */
export const metroPieces = (station: MetroStationId, entrance: MetroEntranceDef): ((id: EntityId) => Entity)[] => [
  ...entrance.props.filter((prop) => prop.solid).map((prop) => (id: EntityId) => propEntity(id, prop, entrance.chunk)),
  (id: EntityId): Entity => {
    const size = entrance.machineSize;
    const centre = { x: entrance.machine.x, y: entrance.machine.y + size.y / 2, z: entrance.machine.z };
    return {
      id,
      chunk: entrance.chunk,
      position: centre,
      prevPosition: centre,
      yaw: entrance.machineYaw,
      prevYaw: entrance.machineYaw,
      pitch: 0,
      solid: aabbFromCenter(centre, size),
      // Centred at chest height: the interaction's height check keeps it to the hall.
      interactable: { kind: "metro", station, dialogueId: `metro_${station}`, prompt: "prompt.metro", radius: 1.8 },
    };
  },
];
