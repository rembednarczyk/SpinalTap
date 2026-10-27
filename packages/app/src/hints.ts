import type { DomainEvents, EntityId } from "@seki/core";

/** Keys a hint shows: control actions (resolved through the player's bindings) or fixed codes. */
export interface HintDef {
  readonly id: string;
  readonly keys: readonly string[];
  readonly text: string;
  /** Touch devices get their own words and no keys. */
  readonly touchText?: string;
  /** Seconds on screen at most, even when the player never does it. */
  readonly seconds: number;
}

/** The first-run hints, in the order they usually come up. Keys are actions or `code:` codes. */
export const HINTS = {
  move: { id: "move", keys: ["forward", "left", "back", "right", "code:MouseMove"], text: "ruch i rozglądanie", touchText: "Lewy kciuk: ruch. Prawy: rozglądanie.", seconds: 20 },
  sprint: { id: "sprint", keys: ["sprint", "jump", "crouch"], text: "sprint, skok, kucanie", seconds: 10 },
  talk: { id: "talk", keys: ["interact"], text: "rozmowa i interakcja", touchText: "Stuknij przycisk akcji, żeby porozmawiać.", seconds: 15 },
  fight: { id: "fight", keys: ["fire", "aim", "reload"], text: "strzał, celowanie, przeładowanie", touchText: "Ogień i celowanie po prawej stronie.", seconds: 12 },
  loot: { id: "loot", keys: ["interact"], text: "przeszukaj torbę", touchText: "Podejdź do torby i stuknij akcję.", seconds: 20 },
  inventory: { id: "inventory", keys: ["code:KeyI", "nextWeapon"], text: "ekwipunek i zmiana broni", touchText: "Przycisk „Postać” otwiera ekwipunek.", seconds: 10 },
  journal: { id: "journal", keys: ["code:KeyJ"], text: "dziennik zadań", touchText: "Dziennik jest w menu postaci.", seconds: 8 },
} as const satisfies Record<string, HintDef>;

type HintId = keyof typeof HINTS;

/** What the tracker needs to know about each step of play. */
export interface HintTick {
  /** Seconds since the last tick. */
  readonly dt: number;
  /** The player is in control (no menu, dialogue, shop or bag open). */
  readonly inControl: boolean;
  /** Metres the player moved since the last tick. */
  readonly moved: number;
  readonly sprinting: boolean;
  readonly characterOpen: boolean;
}

/**
 * First-run hints (onboarding): each one comes up once, when its moment arrives (a new game,
 * the first talk, the first job, the first bag), stays until the player does it or its time
 * runs out, and is then remembered as seen. One at a time, only while the player is in control.
 */
export class HintTracker {
  private readonly queue: HintId[] = [];
  private current: { id: HintId; shown: number } | null = null;
  private moved = 0;
  private sprinted = 0;
  private shots = 0;

  constructor(
    private readonly seen: Set<string>,
    private readonly onSeen: (seen: readonly string[]) => void,
    private readonly playerId: () => EntityId | null,
  ) {}

  /** The hint to show now, or null. */
  get active(): HintDef | null {
    return this.current ? HINTS[this.current.id] : null;
  }

  /** A new game starts the walk-through. */
  start(): void {
    this.queue.length = 0;
    this.current = null;
    this.moved = 0;
    this.sprinted = 0;
    this.shots = 0;
    this.want("move");
  }

  /** Domain events raise and clear hints. */
  onEvent<K extends keyof DomainEvents>(type: K, e: DomainEvents[K]): void {
    const player = this.playerId();
    switch (type) {
      case "InteractionFocusChanged":
        if ((e as DomainEvents["InteractionFocusChanged"]).prompt) this.want("talk");
        return;
      case "InteractionStarted":
        this.done("talk");
        return;
      case "ContractAccepted":
        this.want("fight");
        return;
      case "ShotFired":
        if ((e as DomainEvents["ShotFired"]).shooterId === player && ++this.shots >= 2) this.done("fight");
        return;
      case "LootDropped":
        this.want("loot");
        return;
      case "LootTaken":
        this.done("loot");
        this.want("inventory");
        return;
      case "WeaponSwitched":
        if ((e as DomainEvents["WeaponSwitched"]).entityId === player) this.done("inventory");
        return;
      case "QuestAdvanced":
        this.want("journal");
        return;
      default:
    }
  }

  /** Moves the current hint on; returns true when what is shown changed. */
  tick(t: HintTick): boolean {
    const before = this.current?.id ?? null;
    this.moved += t.moved;
    if (t.sprinting) this.sprinted += t.dt;
    if (this.moved >= 3) this.done("move");
    if (this.sprinted >= 0.8) this.done("sprint");
    if (t.characterOpen) this.done("inventory");
    if (this.current && t.inControl) {
      this.current.shown += t.dt;
      if (this.current.shown >= HINTS[this.current.id].seconds) this.done(this.current.id);
    }
    if (!this.current && t.inControl) {
      const next = this.queue.shift();
      if (next) this.current = { id: next, shown: 0 };
    }
    return (this.current?.id ?? null) !== before;
  }

  private want(id: HintId): void {
    if (this.seen.has(id) || this.queue.includes(id) || this.current?.id === id) return;
    this.queue.push(id);
  }

  private done(id: HintId): void {
    const i = this.queue.indexOf(id);
    if (i >= 0) this.queue.splice(i, 1);
    if (!this.seen.has(id)) {
      this.seen.add(id);
      this.onSeen([...this.seen]);
    }
    if (this.current?.id === id) this.current = null;
    // Walking done: the next lesson is running and jumping.
    if (id === "move") this.want("sprint");
  }
}
