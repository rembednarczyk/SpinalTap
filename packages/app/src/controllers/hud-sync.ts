import { ABILITY_CATALOG, type DomainState, type RenderPort, dayOf, dayPhase, daylight, formatClock, loadoutAbility, secondOfDay, stackRoom } from "@seki/core";
import { DISTRICTS, type DistrictId, type Entity, SIM_HZ, type Simulation } from "@seki/sim";
import { type AbilityVm, type ContractIntents, type LootVm, type Screen, type TradeVm, type UiStore, patchUi } from "@seki/ui";
import { createStatsCache } from "../character-view";
import { createJournalCache } from "../journal";
import { createMinimapTracker } from "../minimap";
import { contractEntryId, describeObjective, shownEntryId } from "../objective";
import { createWeaponHud } from "../weapon-hud";
import type { Wave1Hud } from "../wave1-hud";
import type { Wave2Hud } from "../wave2-hud";
import { type SimRef, pushToastTimed } from "./shared";

/** A flashback waits this many ticks (5 s) after the last shot near the player, unless the shooter is down. */
export const RECALL_CALM_TICKS = 5 * SIM_HZ;
/** HUD zoom (share of the hip field of view) is rounded to this step, like the spread. */
const ZOOM_STEP = 0.01;
/** HUD aim spread is rounded to this many radians, so the store changes only when the cone visibly moves. */
const SPREAD_STEP = 0.002;
/** Daylight reaches the renderer in steps of 1/64. */
const DAYLIGHT_STEPS = 64;

/** The player's current field of view as a share of the hip one: 1 + (zoom - 1) * aim (ADR-0019). */
const aimZoomOf = (player: Entity | undefined): number => {
  const zoom = player?.combatant?.stats?.ads?.zoom ?? 1;
  const aim = player?.posture?.aim ?? 0;
  return Math.round((1 + (zoom - 1) * aim) / ZOOM_STEP) * ZOOM_STEP;
};

/** No shot near the player for RECALL_CALM_TICKS, or whoever fired it is down. */
export const isCalm = (sim: Simulation): boolean => {
  const { session, tick, world } = sim;
  const threat = session.lastThreat;
  if (threat === null || tick - threat.tick >= RECALL_CALM_TICKS) return true;
  for (const e of world.with("health")) if (e.id === threat.sourceId) return e.health.current <= 0;
  return true;
};

/** The job whose targets the minimap marks: the one the HUD shows (ADR-0035). */
export const mapFocus = (domain: DomainState): "story" | "contract" => {
  const contract = domain.contracts.active;
  return contract && shownEntryId(domain) === contractEntryId(contract) ? "contract" : "story";
};

/** What the HUD needs to know about the panels the controllers keep. */
export interface HudPanels {
  screen(): Screen;
  /** A conversation, a shop, a bag, a breach or the phone is on screen. */
  talking(): boolean;
  characterOpen(): boolean;
  /** On the metro (ADR-0035): the minimap's dynamic zoom is off. */
  riding(): boolean;
  /** The open bag (the loot controller closes an emptied one). */
  loot(): LootVm | null;
  /** The bag as the open counter sees it; nothing while no shop is open. */
  trade(): { trade?: TradeVm };
}

export interface HudSyncDeps {
  readonly sim: SimRef;
  readonly ui: UiStore;
  readonly render: RenderPort;
  readonly wave1: Wave1Hud;
  readonly wave2: Wave2Hud;
  readonly panels: HudPanels;
}

/** The HUD in step with the running game: the per-frame store push, time of day, the district name, the contract cards. */
export class HudSync implements ContractIntents {
  private readonly characterStats = createStatsCache();
  private readonly journal = createJournalCache();
  private readonly minimap = createMinimapTracker();
  private readonly weaponHud = createWeaponHud();
  private lastAbilityVm: AbilityVm | null = null;
  /** Last district the player was seen in; a change raises a toast. */
  private district: DistrictId | null = null;
  /** Daylight level last sent to the renderer; null after the views were cleared. */
  private daylightSent: number | null = null;

  constructor(private readonly deps: HudSyncDeps) {}

  /** The player fought within a few seconds or is hunted: the contextual HUD shows. */
  get inCombat(): boolean {
    return !isCalm(this.deps.sim()) || this.deps.wave1.fighting || this.deps.wave1.hunted;
  }

  /** A new game or a load: the views were cleared and the district is the new one's. */
  reset(next: Simulation): void {
    this.daylightSent = null;
    this.deps.wave1.reset();
    this.deps.wave2.reset();
    this.district = next.district;
  }

  /** The render-time part: time of day, the district name, then the store push. */
  frame(): void {
    this.syncTimeOfDay();
    this.announceDistrict();
    this.sync();
  }

  dismissDebrief(): void {
    patchUi(this.deps.ui, { debrief: null });
  }

  sync(): void {
    const sim = this.deps.sim();
    const loot = this.deps.panels.loot();
    const player = sim.player();
    const { title, objective } = describeObjective(sim.domain, sim.tick);
    const hp = player?.health?.current ?? 0;
    const maxHp = player?.health?.max ?? 100;
    patchUi(this.deps.ui, {
      hp,
      maxHp,
      inventory: sim.domain.inventory,
      equipment: sim.domain.equipment,
      ammo: sim.domain.ammo,
      characterStats: this.characterStats(sim.domain, hp, maxHp),
      eddies: sim.domain.wallet.eddies,
      alias: sim.domain.character.alias,
      questTitle: title,
      objective,
      cameraMode: sim.domain.preferences.cameraMode,
      memories: sim.domain.character.memories,
      medkits: sim.domain.inventory.stacks.medkit ?? 0,
      medkitRoom: stackRoom(sim.domain.inventory, sim.domain.equipment, "medkit"),
      ability: this.abilityVm(sim),
      weapons: this.weaponHud(sim),
      loot,
      ...this.deps.panels.trade(),
      cyberware: sim.domain.character.cyberware,
      reputation: sim.domain.reputation,
      contractsDone: sim.domain.contracts.completed,
      aimSpread: Math.round(sim.aimSpread() / SPREAD_STEP) * SPREAD_STEP,
      crouched: player?.posture?.crouched ?? false,
      aiming: player?.posture?.aiming ?? false,
      aimZoom: aimZoomOf(player),
      blocking: player?.melee?.guard ?? false,
      journal: this.journal(sim.domain),
      clock: formatClock(sim.clock),
      day: dayOf(sim.clock),
      dayPhase: dayPhase(sim.clock),
      ...this.minimapFrame(sim),
      ...this.wave1Frame(sim, player),
    });
  }

  /** The minimap with the wave 2 context (ADR-0035): zoom by speed, enforcers while disguised. */
  private minimapFrame(sim: Simulation) {
    const { wave2, panels } = this.deps;
    return this.minimap(sim.world, sim.domain.flags, sim.domain.contracts, {
      ticksPerSecond: SIM_HZ,
      dashing: wave2.dashing,
      riding: panels.riding(),
      disguised: wave2.disguised,
      enforcers: wave2.enforcers,
      focus: mapFocus(sim.domain),
    });
  }

  private wave1Frame(sim: Simulation, player: Entity | undefined) {
    const { panels, wave1, wave2, ui } = this.deps;
    const combat = panels.screen() === "playing" && this.inCombat;
    // The open phone shows the messages itself; banners wait.
    const busy = panels.talking() || combat;
    const calm = !busy && !panels.characterOpen() && wave1.heatLevel === 0 && !ui.getState().scanning;
    return { combat, ...wave1.sync({ world: sim.world, player, busy, calm }), ...wave2.sync(player, busy, calm) };
  }

  private abilityVm(sim: Simulation): AbilityVm | null {
    const id = loadoutAbility(sim.domain.character.cyberware);
    if (!id) return null;
    const def = ABILITY_CATALOG[id];
    const s = sim.domain.ability;
    // Rounded so the store only changes ~10 times a second, not every frame.
    const round = (n: number) => Math.ceil(n * 10) / 10;
    const next = { name: def.name, activeTime: round(s.activeTime), cooldown: round(s.cooldown), cooldownTotal: def.cooldown };
    const prev = this.lastAbilityVm;
    if (prev && prev.name === next.name && prev.activeTime === next.activeTime && prev.cooldown === next.cooldown) return prev;
    this.lastAbilityVm = next;
    return next;
  }

  /**
   * Time of day reaches the renderer as world state (ADR-0017): a time-of-day effect whenever
   * the light level moves a step of 1/64, which is every ~2 game minutes at dawn and dusk and
   * never during the night or the day.
   */
  private syncTimeOfDay(): void {
    const clock = this.deps.sim().clock;
    const level = Math.round(daylight(clock) * DAYLIGHT_STEPS) / DAYLIGHT_STEPS;
    if (level === this.daylightSent) return;
    this.daylightSent = level;
    this.deps.render.playEffect({ kind: "time-of-day", daylight: level, hour: secondOfDay(clock) / 3600 });
  }

  /** Names the district when the player crosses into another one (streaming itself is silent). */
  private announceDistrict(): void {
    const next = this.deps.sim().district;
    if (next === null || next === this.district) return;
    const first = this.district === null;
    this.district = next;
    if (!first && this.deps.panels.screen() === "playing") pushToastTimed(this.deps.ui, "system", DISTRICTS[next].name);
  }
}
