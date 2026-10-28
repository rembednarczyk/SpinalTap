import { type EntityId, type GameCommand, type MetroStationId, debit, metroFare, metroRefusal, metroRideSeconds } from "@seki/core";
import { KIOSK_SIZE, type MetroStationDef, kioskAt, kioskView, metroStation } from "../content/metro";
import { aabbFromCenter } from "./collision";
import type { Entity } from "./components";
import type { SimContext, System } from "./context";
import { propEntity } from "./factory";

/**
 * The metro (ADR-0032, ADR-0034). A ticket bought at a kiosk takes the player off the street:
 * the player entity leaves the world (nobody sees, hears or shoots a rider) and waits in the
 * session as the passenger, already placed on the destination platform, so the streamer brings
 * that district in while the ride lasts. The clock runs on. At `arriveTick` the player comes up
 * on the platform. The ride is in the domain, so a save made in the carriage loads in it.
 */

/** Makers of the platform's entities (props and the kiosk), unkeyed: they are content. */
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
      // The interaction is measured from the kiosk's foot, like a person's.
      interactable: { kind: "metro", station: station.id, dialogueId: `metro_${station.id}`, prompt: "Bilet", radius: 1.8 },
    };
  },
];

const PLAYER_KEY = "player";

/** The player in the world or riding; null if neither (a test world without one). */
export const playerOrPassenger = (ctx: SimContext): Entity | null => ctx.world.with("player").first ?? ctx.session.passenger;

/** Takes the player off the street onto the destination platform, out of the world. */
const park = (ctx: SimContext, player: Entity, to: MetroStationDef): void => {
  ctx.world.remove(player);
  player.position = { ...to.arrival };
  player.prevPosition = { ...to.arrival };
  player.yaw = to.arrivalYaw;
  player.prevYaw = to.arrivalYaw;
  player.velocity = { x: 0, y: 0, z: 0 };
  delete player.fall;
  delete player.climb;
  delete player.mantle;
  ctx.session.passenger = player;
  ctx.session.focusId = null;
  ctx.session.focusPrompt = null;
};

/** Buys the ticket at the kiosk the player stands at and starts the ride, or says why not. */
export const travelMetro = (ctx: SimContext, cmd: Extract<GameCommand, { type: "travel-metro" }>): void => {
  const domain = ctx.state.domain;
  const player = ctx.world.with("player").first;
  if (ctx.session.gameOver || (!player && !ctx.session.passenger)) return;
  const from = player ? kioskAt(player.position) : null;
  const refusal = metroRefusal({
    from: from?.id ?? null,
    to: cmd.to,
    riding: domain.metro.ride !== null,
    eddies: domain.wallet.eddies,
    contract: domain.contracts.active !== null,
    heat: domain.heat.level,
  });
  if (refusal || !from || !player) {
    ctx.bus.emit("MetroRefused", { reason: refusal ?? "not-at-kiosk", to: cmd.to });
    return;
  }
  const fare = metroFare(from.id, cmd.to);
  const paid = debit(domain.wallet, fare);
  if (!paid.ok) return;
  const seconds = metroRideSeconds(from.id, cmd.to);
  const arriveTick = ctx.tick + Math.round(seconds / ctx.dt);
  ctx.state.domain = { ...domain, wallet: paid.wallet, metro: { ride: { from: from.id, to: cmd.to, arriveTick } } };
  ctx.bus.emit("EddiesChanged", { balance: paid.wallet.eddies, delta: -fare });
  ctx.session.dialogueActive = false;
  park(ctx, player, metroStation(cmd.to));
  ctx.bus.emit("InteractionFocusChanged", { targetId: null, prompt: null });
  ctx.bus.emit("MetroDeparted", { from: from.id, to: cmd.to, seconds });
};

/** Brings the passenger up on the platform. */
const arrive = (ctx: SimContext, passenger: Entity, station: MetroStationId): void => {
  const at = metroStation(station);
  passenger.position = { ...at.arrival };
  passenger.prevPosition = { ...at.arrival };
  ctx.session.passenger = null;
  ctx.world.add(passenger);
  ctx.state.domain = { ...ctx.state.domain, metro: { ride: null } };
  ctx.bus.emit("MetroArrived", { station });
};

/**
 * Runs before streaming: a game loaded mid-ride takes its freshly built player off the street
 * again; a ride that is due ends with the player on the destination platform.
 */
export const metroSystem: System = {
  name: "metro",
  run(ctx) {
    const ride = ctx.state.domain.metro.ride;
    if (!ride) return;
    const inWorld = ctx.world.with("player").first;
    if (inWorld?.key === PLAYER_KEY) park(ctx, inWorld, metroStation(ride.to));
    const passenger = ctx.session.passenger;
    if (passenger && ctx.tick >= ride.arriveTick) arrive(ctx, passenger, ride.to);
  },
};
