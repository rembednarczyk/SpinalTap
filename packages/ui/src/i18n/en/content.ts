/**
 * English texts of the game content (ADR-0056, stage 4): the interaction prompts the simulation
 * names by key, the observation hooks of contracts, the scanner's names, the speakers of the
 * dialogue who are a role rather than a name, the fixers' lines about a contract's variation,
 * the HUD's own objective lines and the map preview's overlay. Names of people and of Lublin's
 * places stay as they are in both languages.
 */
export const enContent = {
  // Interaction prompts (sim `interactable.prompt`).
  "prompt.talk.kaito": "Talk to Kaito",
  "prompt.talk.ume": "Talk to Grandma Ume",
  "prompt.talk.barman": "Talk to the bartender",
  "prompt.talk.ren": "Talk to Ren",
  "prompt.talk.kurosawa": "Talk to Kurosawa",
  "prompt.talk.hana": "Talk to Hana",
  "prompt.talk.hideo": "Talk to Hideo",
  "prompt.talk.tetsu": "Talk to Tetsu (DENKI)",
  "prompt.talk.mei": "Talk to Mei",
  "prompt.talk.genzo": "Talk to Genzō",
  "prompt.chat": "Chat",
  "prompt.shop.mori": "Doctor Mori's clinic",
  "prompt.shop.oyaji": "Oyaji's stall",
  "prompt.shop.sachiko": "Sachiko's kiosk",
  "prompt.shop.kenta": "Kenta's okonomiyaki",
  "prompt.shop.fumiko": "Fumiko's ramen",
  "prompt.shop.goro": "Goro's umbrellas",
  "prompt.closed.oyaji": "Oyaji's stall: closed until 8:00",
  "prompt.closed.fumiko": "Fumiko's ramen: closed until 16:00",
  "prompt.elevator": "Elevator",
  "prompt.ladder.up": "Climb",
  "prompt.ladder.down": "Climb down the ladder",
  "prompt.terminal.hack": "Hack the terminal",
  "prompt.terminal.read": "Read the terminal",
  "prompt.pickup.crate": "Take Hana's crate",
  "prompt.pickup.data": "Copy the Tessen data",
  "prompt.metro": "Ticket",
  "prompt.help": "Help",
  "prompt.door.force": "Force the lock (raises the alarm)",
  "prompt.door.locked": "Keypad door: locked",
  "prompt.loot": "Search",
} as const;
