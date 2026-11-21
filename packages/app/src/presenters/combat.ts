import { type AudioCue, WEAPON_CATALOG, type WeaponLook } from "@seki/core";
import type { UiStore } from "@seki/ui";
import { patchUi } from "@seki/ui";
import type { Presenter } from "./context";

/** The player's shot per weapon kind (melee kinds never fire). */
const PLAYER_SHOT: Readonly<Record<WeaponLook, AudioCue>> = {
  pistol: "shot",
  revolver: "shot-revolver",
  smg: "shot-smg",
  shotgun: "shot-shotgun",
  rifle: "shot-rifle",
  baton: "shot",
  blade: "shot",
};
/** A weapon drawn or switched to: its own handling (user notes of 21.11). */
const DRAW: Readonly<Record<WeaponLook, AudioCue>> = {
  pistol: "draw-pistol",
  revolver: "draw-revolver",
  smg: "draw-smg",
  shotgun: "draw-shotgun",
  rifle: "draw-rifle",
  baton: "draw-baton",
  blade: "draw-blade",
};
/** The weapon in the player's hand, as the HUD's strip names it; null with an empty hand. */
const activeLook = (ui: UiStore): WeaponLook | null => {
  const strip = ui.getState().weapons;
  const name = strip?.slots.find((s) => s.slot === strip.active)?.name ?? null;
  return Object.values(WEAPON_CATALOG).find((d) => d.name === name)?.look ?? null;
};
/** Someone else's shot, heard from further away: handguns and SMGs share one set. */
const ENEMY_SHOT: Readonly<Record<WeaponLook, AudioCue>> = {
  pistol: "enemy-shot",
  revolver: "enemy-shot",
  smg: "enemy-shot",
  shotgun: "enemy-shot-shotgun",
  rifle: "enemy-shot-rifle",
  baton: "enemy-shot",
  blade: "enemy-shot",
};

/** Combat: shots, weapons, melee, hits and kills, the sniper's laser and the overdrive. */
export const presentCombat: Presenter = ({ bus, render, audio, ui, isPlayer }) => [
  bus.on("ShotFired", (e) => {
    render.playEffect({ kind: "muzzle-flash", shooterId: e.shooterId, from: e.from, to: e.to });
    audio.play((isPlayer(e.shooterId) ? PLAYER_SHOT : ENEMY_SHOT)[e.look]);
  }),
  bus.on("WeaponToggled", (e) => {
    render.playEffect({ kind: "weapon", entityId: e.entityId, drawn: e.drawn });
    if (!isPlayer(e.entityId)) return;
    const look = e.drawn ? activeLook(ui) : null;
    audio.play(e.drawn ? (look ? DRAW[look] : "weapon-switch") : "holster");
  }),
  bus.on("WeaponSwitched", (e) => {
    render.playEffect({ kind: "weapon", entityId: e.entityId, drawn: true, slot: e.slot });
    if (isPlayer(e.entityId)) audio.play(DRAW[WEAPON_CATALOG[e.weapon].look]);
  }),
  // Melee (ADR-0019): the swing plays over the simulation's timing; the whoosh comes as it lands.
  bus.on("MeleeSwing", (e) => render.playEffect({ kind: "melee", entityId: e.entityId, strike: e.strike, windup: e.windup, recovery: e.recovery })),
  bus.on("MeleeStrike", (e) => {
    audio.play("swing");
    // A blow that lands knocks (user notes of 18.11); a miss is the whoosh alone.
    if (e.hits > 0) audio.play("impact-melee");
  }),
  bus.on("AttackBlocked", (e) => {
    render.playEffect({ kind: "block", entityId: e.defenderId, parried: e.parried, at: e.at });
    audio.play(e.parried ? "parry" : "block");
  }),
  bus.on("Staggered", (e) => render.playEffect({ kind: "stagger", entityId: e.entityId, duration: e.duration })),
  bus.on("ReloadStarted", (e) => {
    render.playEffect({ kind: "reload", entityId: e.entityId, duration: e.duration, perRound: e.perRound });
    if (isPlayer(e.entityId)) audio.play(e.perRound ? "reload-round" : "reload");
  }),
  // The last round of a shotgun's run in: the slide racked.
  bus.on("ReloadFinished", (e) => {
    if (isPlayer(e.entityId) && e.perRound && e.ready) audio.play("shotgun-pump");
  }),
  bus.on("DamageDealt", (e) => {
    render.playEffect({ kind: "hit-spark", at: e.at, critical: e.critical });
    render.playEffect({ kind: "flinch", entityId: e.targetId, at: e.at, head: e.zone === "head" });
    if (isPlayer(e.targetId)) {
      patchUi(ui, { hurtFlash: ui.getState().hurtFlash + 1 });
      audio.play("hurt");
    } else if (isPlayer(e.sourceId)) {
      patchUi(ui, { hitMarker: ui.getState().hitMarker + 1, hitZone: e.zone, hitKind: e.critical ? "crit" : "hit" });
      audio.play(e.critical || e.zone === "head" ? "critical" : "hit");
    }
  }),
  bus.on("EntityKilled", () => audio.play("kill")),
  bus.on("AbilityActivated", () => {
    render.playEffect({ kind: "overdrive", active: true });
    audio.play("overdrive");
  }),
  bus.on("AbilityEnded", () => render.playEffect({ kind: "overdrive", active: false })),
  // The sniper's telegraph (ADR-0024): the laser is the warning.
  bus.on("SniperAimed", (e) => render.playEffect({ kind: "laser", shooterId: e.entityId, targetId: e.targetId, duration: e.duration })),
];
