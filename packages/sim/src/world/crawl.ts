import type { Entity } from "./components";

type Crawl = NonNullable<NonNullable<Entity["interactable"]>["crawl"]>;

/**
 * The interact key at a crawl's mouth (W-3's culvert, ADR-0082 §1 Q1, G-907): Seki gets down and
 * in, under the low ceiling, which keeps her crouched until there is room to stand again (the
 * crouch holds under it whether the key is held or not).
 */
export const enterCrawl = (player: Entity, crawl: Crawl): void => {
  const at = { x: crawl.to.x, y: crawl.to.y, z: crawl.to.z };
  player.position = at;
  player.prevPosition = at;
  player.yaw = crawl.yaw;
  player.prevYaw = crawl.yaw;
  if (player.velocity) player.velocity = { x: 0, y: 0, z: 0 };
  if (player.posture) {
    player.posture.crouched = true;
    player.posture.amount = 1;
    player.posture.prevAmount = 1;
  }
};
