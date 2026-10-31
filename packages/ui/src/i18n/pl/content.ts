import type { Message } from "../message";
import type { enContent as en } from "../en/content";

/** Polish texts of the game content (ADR-0056, stage 4): word for word what the game said before. */
export const plContent = {
  // Interaction prompts (sim `interactable.prompt`).
  "prompt.talk.kaito": "Rozmawiaj z Kaito",
  "prompt.talk.ume": "Rozmawiaj z babcią Ume",
  "prompt.talk.barman": "Rozmawiaj z barmanem",
  "prompt.talk.ren": "Rozmawiaj z Renem",
  "prompt.talk.kurosawa": "Rozmawiaj z Kurosawą",
  "prompt.talk.hana": "Rozmawiaj z Haną",
  "prompt.talk.hideo": "Rozmawiaj z Hideo",
  "prompt.talk.tetsu": "Rozmawiaj z Tetsu (DENKI)",
  "prompt.talk.mei": "Rozmawiaj z Mei",
  "prompt.talk.genzo": "Rozmawiaj z Genzō",
  "prompt.chat": "Zagadaj",
  "prompt.shop.mori": "Klinika doktora Mori",
  "prompt.shop.oyaji": "Stragan Oyajiego",
  "prompt.shop.sachiko": "Kiosk Sachiko",
  "prompt.shop.kenta": "Okonomiyaki u Kenty",
  "prompt.shop.fumiko": "Ramen u Fumiko",
  "prompt.shop.goro": "Parasole u Goro",
  "prompt.closed.oyaji": "Stragan Oyajiego: zamknięte do 8:00",
  "prompt.closed.fumiko": "Ramen u Fumiko: zamknięte do 16:00",
  "prompt.elevator": "Winda",
  "prompt.ladder.up": "Wspinaj się",
  "prompt.ladder.down": "Zejdź po drabinie",
  "prompt.terminal.hack": "Włam się do terminala",
  "prompt.terminal.read": "Czytaj terminal",
  "prompt.pickup.crate": "Zabierz skrzynkę Hany",
  "prompt.pickup.data": "Zgraj dane Tessen",
  "prompt.metro": "Bilet",
  "prompt.help": "Pomóż",
  "prompt.door.force": "Wyłam zamek (podniesie alarm)",
  "prompt.door.locked": "Drzwi na kod: zamknięte",
  "prompt.loot": "Przeszukaj",
} as const satisfies Readonly<Record<keyof typeof en, Message>>;
