import type { AudioListenerPose, MusicMood, Vec3 } from "@seki/core";
import { type ChunkDef, WORLD_CHUNKS } from "@seki/sim";
import type { RadioStationId } from "./radio-stations";
import { emitterMix } from "./spatial";

/**
 * Diegetic radio (ADR-0036): a speaker in the door of every bar, karaoke and some shops, found by
 * the label of their neon in the world's content. Each venue plays its own station.
 */
export const VENUE_STATIONS: Readonly<Record<string, RadioStationId>> = {
  BAR: "drift",
  "NEON KOI": "drift",
  PACHINKO: "drift",
  PACHI: "drift",
  KARAOKE: "yoru",
  SAKE: "yoru",
  TAKO: "yoru",
  RAMEN: "tessen",
  DENKI: "tessen",
};

export interface RadioSpeaker {
  readonly position: Vec3;
  readonly station: RadioStationId;
  readonly label: string;
}

/** Height of the speaker over the street: above the door, under the sign. */
const SPEAKER_HEIGHT = 2.4;
/** The speaker hangs this far under the bottom of its sign. */
const SPEAKER_DROP = 0.4;

/** Speakers of every chunk (or the ones given), one per venue sign. */
export const radioSpeakers = (chunks: readonly ChunkDef[] = WORLD_CHUNKS): RadioSpeaker[] =>
  chunks.flatMap((c) =>
    c.props.flatMap((p) => {
      if (p.view.kind !== "neon" || !p.view.label) return [];
      const station = VENUE_STATIONS[p.view.label];
      // Under the sign, over the door (the signs hang a metre or two above the speakers).
      const y = Math.max(p.center.y - p.view.size.y / 2 - SPEAKER_DROP, p.center.y - SPEAKER_HEIGHT);
      return station ? [{ position: { x: p.center.x, y, z: p.center.z }, station, label: p.view.label }] : [];
    }),
  );

/** Distance at which a speaker is loudest, and beyond which it is silent (a small speaker in a doorway). */
export const SPEAKER_REF = 3;
export const SPEAKER_MAX = 24;

export interface SpeakerMix {
  readonly station: RadioStationId;
  readonly gain: number;
  readonly pan: number;
}

/** The station the listener hears from the speakers: the loudest one, with its level and pan. */
export const speakerMix = (pose: AudioListenerPose, speakers: readonly RadioSpeaker[]): SpeakerMix | null => {
  let best: SpeakerMix | null = null;
  const stations = new Set(speakers.map((s) => s.station));
  for (const station of stations) {
    const mix = emitterMix(pose, speakers.filter((s) => s.station === station).map((s) => ({ position: s.position, level: 1 })), SPEAKER_REF, SPEAKER_MAX);
    if (mix.gain > 0.01 && (!best || mix.gain > best.gain)) best = { station, gain: mix.gain, pan: mix.pan };
  }
  return best;
};

/**
 * How loud the score and the radio play (0..1 each). A station picked by the player replaces
 * the score while exploring; a fight brings the score back and lowers the radio. Without a
 * station of her own, a nearby speaker plays over a lowered score. Dialogue ducks both, since
 * the radio runs on the music bus.
 */
export const radioMix = (mood: MusicMood, own: RadioStationId | null, speaker: number): { score: number; radio: number } => {
  const fight = mood === "combat" || mood === "overdrive";
  if (own) return fight ? { score: 1, radio: 0.3 } : { score: 0, radio: 1 };
  const s = Math.max(0, Math.min(1, speaker));
  return { score: 1 - (fight ? 0.2 : 0.65) * s, radio: s * (fight ? 0.4 : 1) };
};
