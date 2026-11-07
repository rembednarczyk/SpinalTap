import type { AudioScenePort } from "@seki/core";
import type { UiStore } from "@seki/ui";
import { type VolumeSettings, applyVolumes, volumesDiffer } from "../settings";

/** What the mix needs of the audio adapter; the spoken line is optional, like the radio. */
export type AudioMixPort = Pick<AudioScenePort, "setMood" | "setVolume"> & Partial<Pick<AudioScenePort, "stopLine">>;

/**
 * The mix follows the UI (ADR-0013, ADR-0060 stage 1): an open conversation ducks music and
 * radio through the dialog mood, closing it cuts the line still spoken, and the bus volumes
 * follow the settings live. `applied` are the volumes already on the mix. Returns the unbinding.
 */
export const bindAudioMix = (ui: UiStore, audio: AudioMixPort, applied: VolumeSettings): (() => void) => {
  let talking = false;
  let volumes = applied;
  return ui.subscribe((s) => {
    const nowTalking = s.dialogue !== null;
    if (nowTalking !== talking) {
      talking = nowTalking;
      audio.setMood(talking ? "dialog" : "explore");
      if (!talking) audio.stopLine?.();
    }
    if (volumesDiffer(s.settings, volumes)) {
      volumes = s.settings;
      applyVolumes(audio, volumes);
    }
  });
};
