import type { Vec3 } from "@seki/core";

/*
 * The lights of the scenes (ADR-0102 point 5): lights in a fitting a scene's model draws, turned on by the renderer near
 * their place (`SceneLamps`); no entity, so no id of the content moves. The groups are gathered in `district-targ.ts`
 * (`SCENE_LAMP_GROUPS`); a scene of its own declares its group with these types.
 */

/** A light of a scene, in its fitting: where, its colour, how far it reaches and how strong it is. */
export interface SceneLamp {
  readonly key: string;
  readonly at: Vec3;
  readonly color: string;
  readonly range: number;
  readonly intensity: number;
}

/** Lights of one place, on while the eye is within `near` of `centre`. */
export interface SceneLampGroup {
  readonly id: string;
  readonly centre: { readonly x: number; readonly z: number };
  readonly near: number;
  readonly lamps: readonly SceneLamp[];
}

/**
 * A speaker of a scene (ADR-0036's diegetic radio, ADR-0102 point 5): in the door of a venue of the map whose sign the
 * renderer already hangs (the venue boards, scenery with no entity), so the street hears a station there; no entity.
 */
export interface SceneRadio {
  readonly key: string;
  /** Under the venue's sign, over its door. */
  readonly at: Vec3;
  /** The venue's kind (`LublinVenueData.kind`): the engine plays a station by it. */
  readonly kind: string;
  /** The venue's 2077 name, its sign's text. */
  readonly label: string;
}

