import type { EndingKey } from "../en/ending";
import type { Message } from "../message";

/** Polish texts of the end screen: the English keys. */
export const plEnding = {
  "endScreen.heading": "Koniec wątku głównego",
  "endScreen.lead": "Lublin żyje dalej, ty też. Kaito ma czekające zlecenia.",
  "endScreen.act1": "Akt I: Echo",
  "endScreen.act2": "Akt II: Lustro",
  "endScreen.act3": "Akt III: Źródło",
  "endScreen.choices": "Twoje wybory",
  "endScreen.level": "Poziom {level}",
  "endScreen.contracts": { one: "{count} wykonane zlecenie", few: "{count} wykonane zlecenia", many: "{count} wykonanych zleceń", other: "{count} wykonanego zlecenia" },
  "endScreen.memories": { one: "{count} odzyskane wspomnienie", few: "{count} odzyskane wspomnienia", many: "{count} odzyskanych wspomnień", other: "{count} odzyskanego wspomnienia" },
  "endScreen.back": "Wróć do miasta",
  "story.choice.case.opened": "Otworzyłaś walizkę Kagami.",
  "story.choice.case.sealed": "Zostawiłaś walizkę Kagami zamkniętą.",
  "story.choice.name.spoken": "Powiedziałaś technikowi swoje imię.",
  "story.choice.name.silent": "Zachowałaś imię dla siebie.",
  "story.choice.crash.wheel": "Sama rozbiłaś auto.",
  "story.choice.crash.ren": "Poszłaś za głosem Rena w słuchawce.",
  "story.choice.rooftop.together": "Wzięłaś robotę dla Kagami razem z Renem.",
  "story.choice.rooftop.alone": "Wzięłaś robotę dla Kagami sama.",
  "story.choice.voice.listened": "Słuchałaś dalej głosu, który mówił zza Rena.",
  "story.choice.voice.torn": "Wyrwałaś słuchawkę.",
  "story.choice.job.refused": "Odmówiłaś Kaito roboty na Rena.",
  "story.choice.job.taken": "Wzięłaś od Kaito robotę na Rena.",
  "story.choice.archive.street": "Oddałaś archiwum ulicy.",
  "story.choice.archive.hebi": "Oddałaś archiwum Renowi i Hebi.",
  "story.choice.archive.kagami": "Oddałaś archiwum Kagami za własny zapis.",
  "story.choice.core.erase": "Wymazałaś rdzeń razem z oryginałem Ayi.",
  "story.choice.core.release": "Wypuściłaś archiwum w sieć miasta.",
  "story.choice.core.keep": "Zostałaś przy rdzeniu, żeby decydować, kto co odzyska.",
} as const satisfies Readonly<Record<EndingKey, Message>>;
