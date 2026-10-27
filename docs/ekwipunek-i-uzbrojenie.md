# Ekwipunek i uzbrojenie: plan systemu

**Status:** projekt do implementacji, decyzje architektoniczne w [ADR-0015](adr/0015-ekwipunek-uzbrojenie-loot.md).
**Poprzedza:** lootowanie wrogów i menu postaci na telefonie (`docs/backlog.md`).
**Założenia z prac równoległych:** pakiet walki daje kucanie, rozrzut zależny od postawy i wszczepów
(statystyka `aimStability`), hitboxy ze strefami ciała `head | torso | arms | legs` i przerywanie
dialogu; harmonogramy dobowe zajmują zapis v7; na targu pojawiają się nowe zlecenia. Ten dokument
nie zmienia tych prac, tylko się do nich podłącza. Miejsca zależne od nich są oznaczone **[walka]**.

Liczby w tabelach są wartościami startowymi do balansu. Kod ma je trzymać w katalogach `core`, nie
w systemach.

---

## Spis treści

1. [Cele i zakres](#1-cele-i-zakres)
2. [Model przedmiotów](#2-model-przedmiotów)
3. [Uzbrojenie](#3-uzbrojenie)
4. [Pancerz i odzież per strefa ciała](#4-pancerz-i-odzież-per-strefa-ciała)
5. [Tabele łupów](#5-tabele-łupów)
6. [Ekonomia](#6-ekonomia)
7. [Menu postaci](#7-menu-postaci)
8. [Kontrakty między pakietami](#8-kontrakty-między-pakietami)
9. [Etapy wdrożenia](#9-etapy-wdrożenia)
10. [Ryzyka i otwarte pytania](#10-ryzyka-i-otwarte-pytania)

---

## 1. Cele i zakres

### Stan obecny (punkt wyjścia)

- `core/inventory`: jeden przedmiot (`medkit`, 90 €$, +40 HP), licznik do `MAX_STACK = 9`.
- `core/combat`: dwie bronie w `WEAPONS` (`pistol` Unity-9: 22 obr., 0,28 s, 60 m, celność 0,92;
  `gangerSmg`: 7 obr., 0,9 s, 18 m, 0,55). Brak amunicji, magazynka i przeładowania.
  Trafienie w głowę ×1,6 (`HEADSHOT_MULTIPLIER`), kabura i dobycie 0,4 s (`DRAW_TIME`).
- Pancerz to jedna liczba: gracz `BASE_STATS.armor = 2` plus wszczepy i wspomnienia, ganger stałe 3,
  redukcja płaska z minimum 20% (`mitigate`).
- Wszczepy kupuje się i instaluje od razu u Mori; zastąpiony implant przepada.
- Ekonomia: start 120 €$, pierwszy kontrakt 500 €$, kontrakt proceduralny `250 + 125 × cele`
  (2 do 4 celów, czyli 500 do 750 €$), skalowany reputacją u fixerów od ×0,5 do ×1,5.
  Klinika: implanty 500 do 1100 €$, apteczka 90 €$, ceny ×0,8 do ×1,25 według `shopTerms`.
- Ganger ma 80 HP; gracz 100 HP. Ciało pokonanego znika ze świata w `deathSystem`.
- Renderer: pistolet w prawej dłoni i w kaburze na prawym biodrze (rig proceduralny), modele
  importowane dostają pudełko w kości dłoni (`holdInRightHand`), FPP ma viewmodel w `camera-rig`.

### Co gracz robi z ekwipunkiem w pętli gry

| Moment pętli | Co robi gracz | Co daje system |
|---|---|---|
| Zlecenie od Kaito lub z targu | Wybiera broń i odzież pod miejsce (zaułek blisko: strzelba, ulica: karabinek). | Sloty broni, porównanie, podgląd postaci. |
| Walka | Strzela, przeładowuje, zmienia broń, leczy się. | Amunicja w magazynku i zapasie, przeładowanie z animacją, pancerz per strefa. |
| Po walce | Przeszukuje torbę po wrogu. | Tabela łupów zależna od typu wroga, „Weź wszystko”. |
| Klinika Mori | Instaluje wszczep znaleziony lub kupiony, leczy zapas apteczek. | Wszczep jako przedmiot przed instalacją, opłata za montaż. |
| Stragan na targu | Sprzedaje złom i zbędną broń, kupuje amunicję i mody, naprawia odzież. | Skup, naprawa, sklep z amunicją. |
| Menu postaci | Zakłada, porównuje, wyrzuca, montuje mody. | Siatka ekwipunku, statystyki, podgląd 3D. |

### Zakres

W zakresie: model przedmiotów, sloty broni, amunicja, przeładowanie, mody, odzież i pancerz per
strefa, łupy z wrogów, skup i naprawa, menu postaci, kontrakty i zapis.

Poza zakresem (później): crafting, losowe afiksy, wytrzymałość broni, waga i przeciążenie,
skrzynie w świecie (format łupów to obsługuje, ale treść przyjdzie osobno), handel z NPC innymi
niż Mori i stragan na targu.

---

## 2. Model przedmiotów

### Definicja i instancja

Przedmiot ma **definicję** w katalogu `core` (stała, w kodzie) i w ekwipunku występuje jako:

- **stos**: licznik po identyfikatorze definicji, dla przedmiotów bez stanu własnego
  (apteczki, złom, części);
- **instancja**: rekord z `uid`, dla przedmiotów ze stanem (broń: amunicja w magazynku i mody;
  odzież: stan techniczny; wszczep przed instalacją: tylko rzadkość).

`uid` nadaje domena z licznika `inventory.nextUid` (`"i1"`, `"i2"`, ...). Bez losowości i bez zegara.

### Kategorie

| Kategoria | Postać w ekwipunku | Przykłady | Uwagi |
|---|---|---|---|
| `weapon` | instancja | Unity-9, Hebi SMG, Raijin 12 | Sloty: główna, boczna, wręcz (§3). |
| `ammo` | osobna ładownica, bez komórek | 9 mm, .44, śrut 12, 5,56 | Limit per typ amunicji (§3.3). |
| `consumable` | stos | Apteczka, Opatrunek | Użycie z menu lub szybkim przyciskiem. |
| `garment` | instancja | Wizjer, Kurtka Hebi, Kamizelka balistyczna | Sloty: głowa, tors, nogi (§4). |
| `cyberware` | instancja | Stabilizator chwytu (nieinstalowany) | Instalacja tylko w klinice (§2, „Wszczepy jako przedmiot”). |
| `mod` | instancja | Tłumik, Celownik holo, Magazynek powiększony | Montaż w menu, bez kosztu (§3.4). |
| `junk` | stos | Złom elektroniczny, Części broni, Chip z danymi | Tylko sprzedaż; części obniżają koszt naprawy. |
| `key` | osobna zakładka, bez limitu | Przedmioty fabularne z ink | Nie da się ich wyrzucić ani sprzedać. |

Eddies nie są przedmiotem: łup wpłaca je do portfela przez `credit`.

### Rzadkość

Cztery poziomy. Rzadkość nie losuje afiksów: daje stały mnożnik, więc broń o danej rzadkości ma
zawsze te same statystyki, a zapis przechowuje tylko poziom.

| Poziom | Nazwa w UI | Kolor ramki | Broń: obrażenia | Broń: rozrzut | Odzież: pancerz strefy głównej | Wartość |
|---|---|---|---|---|---|---|
| `common` | zwykły | szary | ×1,00 | ×1,00 | +0 | ×1,0 |
| `uncommon` | niezwykły | cyjan | ×1,08 | ×0,92 | +1 | ×1,6 |
| `rare` | rzadki | magenta | ×1,16 | ×0,85 | +2 | ×2,6 |
| `unique` | unikat | złoty | z definicji | z definicji | z definicji | z definicji |

`unique` to przedmioty nazwane, z własną definicją i statystykami (np. nagroda fabularna). Nie
występują w losowaniu rzadkości, tylko jako jawny wpis tabeli łupów lub nagroda questa.
Kolor ramki zawsze idzie w parze z etykietą tekstową (dostępność, ekran w słońcu).

### Statystyki i stackowanie

| Definicja | Pola wspólne | Pola własne |
|---|---|---|
| wszystkie | `id`, `name`, `description`, `category`, `value` (€$, cena katalogowa) | |
| stos | | `stack` (limit na komórkę) |
| `weapon` | | §3.2 |
| `garment` | | `slot`, `armor: Partial<Record<BodyZone, number>>`, `modifiers?: StatModifiers`, `look` |
| `mod` | | `slot: "muzzle" \| "sight" \| "magazine"`, efekt (§3.4) |
| `cyberware` | | odwołanie do `CYBERWARE_CATALOG` (bez duplikacji statystyk) |

Limity stosu: apteczka 9 (jak dziś `MAX_STACK`), opatrunek 9, złom 20, części 10, chip 5.
Stos ponad limit zajmuje kolejną komórkę.

### Limit ekwipunku: sloty

Rozważone warianty:

| Wariant | Za | Przeciw na telefonie |
|---|---|---|
| Siatka z kształtami (Tetris, RE) | Ciekawa gra przestrzenią. | Precyzyjne przeciąganie i obracanie palcem, układ trzeba zapisywać, małe komórki. |
| Waga | Realizm, jedna liczba. | Niewidoczna przy wyborze, wymaga liczenia, kara za przeciążenie wpływa na ruch i determinizm balansu. |
| **Sloty (komórka = przedmiot lub stos)** | Duże cele dotyku, odpowiedź na pytanie „czy się zmieszczę” widać od razu, stan to lista. | Mniej głębi decyzji. |

**Decyzja: sloty.** Pojemność startowa 24 komórki (siatka 6 × 4 w UI). Ulepszenie plecaka na targu:
+6 komórek dwa razy (600 €$ i 1200 €$), maksymalnie 36. Nie zajmują komórek: założona broń i odzież,
amunicja (ładownica), eddies, przedmioty fabularne.

Układ siatki nie jest zapisywany: UI sortuje według kategorii, rzadkości albo wartości (wybór
zapamiętany lokalnie w UI). Dzięki temu nie ma przeciągania jako jedynej metody zarządzania, a stan
domeny jest prostą listą w kolejności podniesienia.

### Wszczepy jako przedmiot przed instalacją

- Wszczep z łupu trafia do ekwipunku jako instancja `cyberware` (zajmuje komórkę).
- Instalacja wymaga kliniki: komenda `install-cyberware-item`, opłata za montaż 25% wartości
  katalogowej po `shopTerms` kliniki (Stabilizator chwytu: 125 €$ zamiast 500 €$).
- Zakup w klinice dalej instaluje od razu (`buyCyberware`), ale **zastąpiony implant wraca do
  ekwipunku**, jeśli jest wolna komórka. Gdy jej nie ma, panel kliniki pokazuje ostrzeżenie
  „Brak miejsca: stary implant przepadnie” przed zakupem.
- Wymontowanie implantu w klinice: bez opłaty, implant do ekwipunku.
- Optyka startowa (wartość 0) nie ma ceny skupu.

---

## 3. Uzbrojenie

### 3.1 Sloty broni

| Slot | Klasy broni | Miejsce na postaci, gdy schowana | Czas dobycia |
|---|---|---|---|
| `primary` (główna) | PM, strzelba, karabinek | plecy, skos od prawego barku | 0,7 s (PM 0,55 s) |
| `secondary` (boczna) | pistolet, rewolwer | kabura na prawym biodrze (jak dziś) | 0,4 s (`DRAW_TIME`) |
| `melee` (wręcz) | pałka, ostrze | lewe biodro (pałka) lub plecy (ostrze) | 0,3 s |

W danej chwili aktywny jest jeden slot (`equipment.active`). Wybór slotu:

- klawiatura `1`, `2`, `3`, kółko myszy;
- dotyk: pasek broni w HUD przy przycisku strzału, stuknięcie w ikonę wybiera slot;
- przełączenie = schowanie bieżącej broni (połowa jej czasu dobycia) + dobycie nowej (pełny czas).

Obecny przełącznik kabury (`toggleWeapon`, X) chowa i wyciąga **aktywną** broń, bez zmiany slotu.
Strzał przy schowanej broni dobywa ją (zachowanie z dziś).

### 3.2 Typy broni i parametry

`WeaponDefinition` w `core` zastępuje dzisiejszy `Weapon`:

```ts
type WeaponClass = "pistol" | "revolver" | "smg" | "shotgun" | "rifle" | "baton" | "blade";
type WeaponSlot = "primary" | "secondary" | "melee";
type BodyZone = "head" | "torso" | "arms" | "legs"; // [walka]: typ z pakietu hitboxów

interface WeaponDefinition {
  readonly id: WeaponId;
  readonly name: string;
  readonly class: WeaponClass;
  readonly slot: WeaponSlot;
  readonly damage: number;          // na pocisk (śrut: na śrucinę)
  readonly pellets: number;         // 1, strzelba 8
  readonly interval: number;        // s między strzałami (dzisiejszy cooldown)
  readonly magazine: number;        // 0 dla broni białej
  readonly reload: number;          // s, pełne przeładowanie
  readonly reloadMode: "magazine" | "per-round";
  readonly ammo: AmmoId | null;
  readonly baseSpread: number;      // stopnie, półkąt stożka [walka]
  readonly range: number;           // m
  readonly zones: Readonly<Record<BodyZone, number>>;
  readonly drawTime: number;
  readonly modSlots: readonly ModSlot[];
  readonly value: number;
  readonly look: WeaponLook;        // co narysować (§8.4)
}
```

Tabela startowa (gracz):

| Broń | Klasa / slot | Obr. | Odstęp (s) | Magazynek | Przeład. (s) | Rozrzut (°) | Zasięg (m) | Głowa / tors / ręce / nogi | Amunicja | Mody | Wartość |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Unity-9 | pistolet / boczna | 22 | 0,28 | 12 | 1,4 | 0,8 | 60 | 1,6 / 1 / 0,8 / 0,8 | 9 mm | M S Mg | 400 |
| Oni .44 | rewolwer / boczna | 48 | 0,60 | 6 | 2,4 | 0,6 | 70 | 2,0 / 1 / 0,8 / 0,8 | .44 | S | 1300 |
| Hebi SMG | PM / główna | 9 | 0,10 | 30 | 2,0 | 2,5 | 25 | 1,4 / 1 / 0,8 / 0,8 | 9 mm | M S Mg | 700 |
| Raijin 12 | strzelba / główna | 8 × 9 | 0,85 | 6 | 0,5 na nabój | 6,0 | 14 | 1,25 / 1 / 0,8 / 0,8 | śrut 12 | S Mg | 1200 |
| Tessen AR-5 | karabinek / główna | 26 | 0,15 | 24 | 2,2 | 1,2 | 80 | 1,8 / 1 / 0,8 / 0,8 | 5,56 | M S Mg | 1800 |
| Pałka teleskopowa | wręcz | 30 | 0,60 | brak | brak | brak | 2,2 | 1,3 / 1 / 0,8 / 0,8 | brak | brak | 250 |
| Ostrze Shirasaya | wręcz | 45 | 0,75 | brak | brak | brak | 2,6 | 1,5 / 1 / 0,8 / 0,8 | brak | brak | 1500 |

M = tłumik, S = celownik, Mg = magazynek.

Kontrola z dzisiejszym balansem: Unity-9 w tors gangera (pancerz 3) daje 19 obrażeń, czyli
5 trafień na 80 HP; w głowę (ganger bez osłony głowy) 35, czyli 3 trafienia. To zgadza się z obecnym
zachowaniem, więc pistolet startowy zachowuje odczucie z M1.

**NPC.** Ganger nie dostaje statystyk gracza z tej tabeli. Definicja broni ma opcjonalny profil
`npc: { damage, interval, accuracy }`; Hebi SMG w rękach gangera ma `{ 7, 0,9, 0,55 }`, czyli
dzisiejszy `gangerSmg`. NPC mają nieskończony zapas, ale magazynek i przeładowanie liczą się
(30 strzałów, potem 2,0 s), co daje graczowi okno do kontrataku. Bez tego profilu loot „SMG gangera”
dawałby graczowi broń słabszą od pistoletu albo gangerzy staliby się zabójczy.

**Broń biała** używa tego samego `fireShot` z zasięgiem 2,2 do 2,6 m i rozrzutem 0 (krótki hitscan
w osi celowania). Bez amunicji i przeładowania. Trafienie zużywa te same dwie liczby losowe co strzał
(trafienie, krytyk), więc strumień RNG pozostaje wyrównany.

**Strzelba**: każda śrucina to osobny promień i osobny `resolveAttack`. Liczba liczb losowych na
strzał jest stała: `pellets × (2 na rozrzut [walka] + 2 na trafienie i krytyk)`.

### 3.3 Amunicja

| Typ | Broń | Limit w ładownicy | Paczka w sklepie | Cena za sztukę |
|---|---|---|---|---|
| `9mm` | Unity-9, Hebi SMG | 180 | 30 szt. za 30 €$ | 1,0 |
| `44` | Oni .44 | 48 | 12 szt. za 48 €$ | 4,0 |
| `12g` | Raijin 12 | 40 | 10 szt. za 30 €$ | 3,0 |
| `556` | Tessen AR-5 | 150 | 30 szt. za 60 €$ | 2,0 |

- Ładownica (`ammo`) jest w domenie, poza komórkami.
- Naboje w magazynku należą do instancji broni (`loaded`), więc zmiana broni nie gubi stanu
  magazynka, a zdjęta broń zachowuje naboje.
- Przeładowanie: klawisz `R`, przycisk dotykowy `R` obok strzału, automatycznie przy próbie strzału
  z pustym magazynkiem, jeśli zapas > 0.
- Tryb `magazine`: po czasie `reload` magazynek uzupełniany z ładownicy, naboje z wyjmowanego
  magazynka wracają do ładownicy (bez kary za taktyczne przeładowanie, prostsze dla gracza).
- Tryb `per-round` (strzelba): co 0,5 s jeden nabój; strzał przerywa przeładowanie, jeśli w komorze
  jest co najmniej jeden.
- Przerwanie przeładowania: zmiana slotu, schowanie broni, sprint, otwarcie interakcji. Przerwane
  przeładowanie typu `magazine` nic nie zmienia (naboje przechodzą dopiero na końcu).
- Start nowej gry: Unity-9 z pełnym magazynkiem, 48 naboi 9 mm.

### 3.4 Modyfikacje

| Mod | Slot | Efekt | Wartość |
|---|---|---|---|
| Tłumik | `muzzle` | Promień alarmu strzału 22 m → 8 m (`alertNearbyGangers`), obrażenia ×0,95. | 350 |
| Celownik holo | `sight` | Rozrzut bazowy ×0,8; w FPP lekkie przybliżenie viewmodelu (tylko prezentacja). | 300 |
| Magazynek powiększony | `magazine` | Magazynek ×1,5 (zaokrąglenie w dół; strzelba +2), przeładowanie ×1,15. | 250 |

- Montaż i demontaż w menu postaci, bez kosztu i bez wizyty u NPC. Zdjęty mod wraca do komórki;
  bez wolnej komórki akcja jest zablokowana z komunikatem.
- Efekty modów liczy czysta funkcja `effectiveWeapon(def, instance)` w `core`, używana przez sim
  (strzał) i UI (porównanie), więc liczby w menu zgadzają się z grą.
- Zdjęcie magazynka powiększonego z broni, która ma w nim więcej naboi niż bazowa pojemność,
  przenosi nadmiar do ładownicy.

### 3.5 Kabura, dobycie i rozrzut

Rozrzut liczy pakiet walki **[walka]**. Ten system dostarcza tylko wejścia:

```text
spread = effectiveWeapon.baseSpread
       × stanceFactor(postawa)              // [walka]: stoi, kuca, idzie, biegnie
       × (1 − aimStability)                 // [walka]: suma z wszczepów i wspomnień, ograniczona do 0,6
       + bloom                              // narasta o recoilPerShot, opada w czasie
```

Dodatkowe pola broni dla pakietu walki: `recoilPerShot` (Unity-9 0,25°, Hebi SMG 0,35°, Raijin 1,5°,
Tessen 0,3°, Oni 1,2°) i `recovery` (stopnie na sekundę, domyślnie 6). Po dobyciu broni pierwszy
strzał ma `bloom` równy `2 × recoilPerShot`, przez co szybkie dobycie i strzał jest mniej celny niż
strzał z broni trzymanej w gotowości.

Kolejność stanów broni w `Combatant`: `holstered` → `drawing` (czas `drawTime`) → gotowa →
`reloading` → gotowa. Strzał wymaga: nie schowana, `drawing = 0`, `reloading = 0` (wyjątek: strzelba
z nabojem w komorze), `cooldown = 0`, `loaded > 0`.

Stabilizator chwytu (`steady_grip`) daje dziś `damageBonus: 4`. Po wejściu `aimStability`
rekomendacja: `damageBonus: 2` i `aimStability: 0,15`, co zostawia mu sens nazwy. To zmienia
kryterium ADR-0010 (26 zamiast 22 obrażeń), więc decyzja należy do pakietu walki i musi trafić do
testu `m1-loop` razem z nowym złotym hashem.

---

## 4. Pancerz i odzież per strefa ciała

### Sloty odzieży i strefy

Trzy sloty odzieży, cztery strefy trafień **[walka]**. Ręce nie mają własnego slotu: osłania je
odzież torsu (rękawy).

| Slot | Strefy pokrywane |
|---|---|
| `head` | `head` |
| `torso` | `torso`, `arms` |
| `legs` | `legs` |

Pancerz strefy:

```text
zoneArmor(z) = stats.armor                 // globalny: baza 2, Splot podskórny +4, wspomnienia
             + Σ garment.armor[z] × conditionFactor
conditionFactor = 0,5 + 0,5 × condition / 100
```

Obrażenia trafienia: `mitigate(raw × weapon.zones[z], zoneArmor(z))`, z dzisiejszym minimum 20%.
Wspólny pancerz z wszczepów działa wszędzie, bo to podskórna siatka; odzież działa tylko tam,
gdzie leży.

### Katalog odzieży

| Odzież | Slot | Pancerz (strefa: wartość) | Inne | Wartość | Skąd |
|---|---|---|---|---|---|
| Kurtka Seki | tors | tors 1, ręce 1 | | 150 | start |
| Spodnie cargo | nogi | nogi 1 | | 80 | start |
| Wizjer taktyczny | głowa | głowa 2 | | 300 | stragan |
| Kask motocyklowy | głowa | głowa 4 | w FPP lekka winieta | 450 | stragan, łup rzadki |
| Kurtka Hebi | tors | tors 3, ręce 2 | | 600 | łup z gangerów, stragan |
| Kamizelka balistyczna | tors | tors 5 | szybkość −0,2 m/s | 900 | stragan |
| Spodnie z kevlarem | nogi | nogi 3 | | 500 | stragan |

Wartości są celowo niskie, bo redukcja jest płaska: SMG gangera (7 obrażeń) przy pancerzu 7 zadaje
już tylko minimum. Limit sumy pancerza strefy na start: 8 (patrz §10).

### Stan techniczny i zużycie

- `condition` 0 do 100 na instancji odzieży. Każde trafienie w strefę pokrytą danym elementem odbiera
  mu 2 punkty. Przy 0 element dalej działa w połowie (`conditionFactor = 0,5`) i nie znika.
- Broń nie ma stanu technicznego (świadomie: mniej zarządzania na telefonie).

### Pancerz NPC

Typ wroga ma stały strój (§5.1), który daje jego pancerz per strefa i wygląd. Dzisiejszy pancerz
gangera 3 staje się kurtką Hebi bez osłony głowy: tors 3, ręce 2, nogi 1, głowa 0. Trafienie w głowę
omija więc pancerz, co wzmacnia nagrodę za celność bez ruszania `HEADSHOT_MULTIPLIER`.

### Wygląd postaci

Odzież i broń zmieniają wygląd przez `AppearanceDescriptor` (§8.4). Każda definicja odzieży ma
`look`:

```ts
interface GarmentLook {
  readonly tint?: PaletteKey;                         // kolor partii ciała rigu proceduralnego
  readonly attachments?: readonly { readonly point: AttachPoint; readonly mesh: GarmentMeshId }[];
}
type AttachPoint = "head" | "eyes" | "chest" | "back" | "hipR" | "hipL" | "thighL" | "handR";
```

| Model postaci | Co się zmienia | Jak |
|---|---|---|
| Proceduralny (`characters.ts`) | Kolory partii (kurtka, spodnie), dodatki (kask, wizjer, kamizelka jako płyta na klatce), broń w dłoni i w miejscu przechowania. | `tint` podmienia materiał toon partii; dodatki to proste bryły przypięte do jointów; kontur jak reszta rigu. |
| Importowany VRM/glTF | Dodatki na kościach i broń. Kolory ubrania VRoid zostają z tekstur. | Dodatki przypięte do kości `Head`, `Chest`/`UpperChest`, `Hips`, `UpperLeg` przez `HumanoidRetarget`, jak dziś `holdInRightHand`. Bez konturu z hulla (patrz `docs/models.md`), tusz z line art. |
| Importowany, etap późniejszy | Pełna zmiana stroju. | Opcjonalne pole manifestu `outfits: { "<garmentId>": "plik.vrm" }`: wymiana całego modelu przy zmianie odzieży torsu. Ładowane leniwie, jeden model w pamięci naraz. |

Wszczepy widoczne na postaci: optyka (świecące tęczówki, emisja na materiale oka rigu; na VRM
dwa małe kwady przy kości `Head`), ramiona (płytki na przedramionach, tylko rig proceduralny w
pierwszym etapie). Szkielet i układ nerwowy nie są widoczne.

Budżet: bohaterka do 6 dodatków (+6 draw calli i cienie), NPC tylko broń i `tint` (bez dodatkowych
draw calli w rigu proceduralnym). Mieści się w budżecie ulicy 280 z ADR-0007.

---

## 5. Tabele łupów

### 5.1 Typy wrogów

Dziś jest jeden preset `ganger`. Komponent `enemy: { type: EnemyTypeId }` w sim wiąże byt z typem,
a typ w `core` z bronią, strojem, HP i tabelą łupów:

| Typ | Frakcja | Gdzie | HP | Broń | Strój | Tabela |
|---|---|---|---|---|---|---|
| `hebi_ganger` | hebi | zaułek, cele kontraktów | 80 | Hebi SMG (profil NPC) | Kurtka Hebi | `hebi_common` |
| `hebi_lookout` | hebi | targ (czujka) | 80 | Unity-9 (profil NPC: 14 obr., 1,1 s, 0,6) | Kurtka Hebi | `hebi_common` |
| `hebi_enforcer` | hebi | przyszłe kontrakty z 4 celami (dowódca) | 140 | Raijin 12 (profil NPC) | Kurtka Hebi + Kask | `hebi_enforcer` |

Tabela frakcji (`hebi_common`) jest wspólną bazą; typ może dołożyć wpisy gwarantowane (dowódca
zawsze zostawia swoją broń). Nowa frakcja (np. ochrona korporacyjna) dostaje własną tabelę bez zmian
w kodzie losowania.

### 5.2 Format i liczby

```ts
interface LootTable {
  readonly eddies: readonly [min: number, max: number];
  readonly guaranteed: readonly LootEntry[];
  readonly rolls: number;                     // ile losowań z `entries`
  readonly entries: readonly (LootEntry & { readonly weight: number })[];
}
interface LootEntry {
  readonly item: ItemDefId | AmmoId;
  readonly qty: readonly [min: number, max: number];
  readonly rarity?: "roll" | Rarity;          // "roll": losowanie 75 / 20 / 5 (zwykły / niezwykły / rzadki)
}
```

`hebi_common`: eddies 8 do 30, 1 losowanie:

| Wpis | Waga | Ilość | Rzadkość |
|---|---|---|---|
| Amunicja 9 mm | 36 | 6 do 14 | |
| Złom elektroniczny | 24 | 1 do 2 | |
| Apteczka | 10 | 1 | |
| Opatrunek (+15 HP, 30 €$) | 10 | 1 | |
| Części broni | 8 | 1 | |
| Hebi SMG | 5 | 1 | losowana |
| Kurtka Hebi | 3 | 1 | losowana |
| Mod (tłumik, celownik, magazynek po równo) | 3 | 1 | |
| Stabilizator chwytu (wszczep) | 1 | 1 | zwykły |

`hebi_enforcer`: eddies 30 do 80, gwarantowany Raijin 12 (rzadkość losowana) i 6 do 12 naboi śrutu,
3 losowania z `hebi_common`.

### 5.3 Losowanie a determinizm

- Funkcja `rollLoot(table, rng: RandomPort): LootLine[]` w `core`, czysta.
- **Stała liczba liczb losowych:** eddies 1, każde losowanie 3 (wpis, ilość, rzadkość) niezależnie
  od wyniku, każdy wpis gwarantowany 2 (ilość, rzadkość). Zmiana wag nie przesuwa strumienia.
- **Osobny strumień na pojemnik:** sim tworzy `RandomPort` z ziarna gry i klucza bytu
  (`deriveRandom(seed, "loot:" + key)`, mulberry32 z FNV-1a klucza). Łup nie zużywa głównego
  strumienia RNG, więc dodanie łupów nie zmienia przebiegu walki, a łup danego wroga jest ten sam
  niezależnie od liczby oddanych wcześniej strzałów. Funkcja żyje w `sim/rng` (jedyne miejsce, które
  zna `SeededRandom`).
- Losowanie odbywa się raz, w `deathSystem`, w chwili śmierci. Wynik trafia do domeny, więc zmiana
  tabel w nowej wersji gry nie zmienia zawartości torby leżącej w starym zapisie.

### 5.4 Torba jako obiekt interakcji

**Decyzja: torba** (upuszczona przez wroga) zamiast ciała. Ciało wymagałoby trzymania rigu w pozie
leżącej (draw calle, kontur, cienie, modele VRM) i kolizji z interakcją przy kilku ciałach w zaułku.
Śmierć dalej gra upadek i despawn jak dziś; w miejscu upadku pojawia się torba.

| Cecha | Wartość |
|---|---|
| Widok | `ViewDescriptor { kind: "loot", style: "bag" }`, mała bryła z neonowym paskiem w kolorze rzadkości najlepszego przedmiotu. |
| Interakcja | `Interactable { kind: "loot" }`, promień 1,6 m, podpowiedź „Przeszukaj”. |
| Panel | Lista linii z ikoną i ilością, przycisk „Weź wszystko” w miejscu przycisku E na dotyku (podwójne stuknięcie E bierze wszystko). Świat się nie zatrzymuje, jak w klinice; trafienie gracza zamyka panel **[walka: przerywanie dialogu]**. |
| Częściowe zabranie | Brane są linie, które się mieszczą; eddies i amunicja zawsze (amunicja do limitu ładownicy, nadmiar zostaje). |
| Czas życia | 300 s czasu symulacji od śmierci (`expiresAtTick`). Torba w wyładowanym chunku śpi, ale czas płynie dalej; po powrocie przeterminowana torba nie powstaje. Pusta torba znika od razu. |
| Limit | 12 toreb w domenie; nowa wypiera najstarszą (zdarzenie `LootExpired`). |
| Wyrzucenie przedmiotu | Akcja „Wyrzuć” tworzy torbę `drop:<n>` u stóp gracza z tym samym czasem życia, więc pomyłkę da się cofnąć. |

### 5.5 Zapis zebranych łupów

Torby są stanem domeny, nie bytem ze snapshotu:

```ts
interface LootContainer {
  readonly key: string;              // "loot:<klucz wroga>" lub "drop:<n>"
  readonly position: Vec3;
  readonly chunk: string;
  readonly expiresAtTick: number;
  readonly lines: readonly LootLine[];
}
interface LootState { readonly containers: readonly LootContainer[]; readonly dropSeq: number }
```

Fabryka świata przy wczytaniu i przy ładowaniu chunka odtwarza torby z `domain.loot`, tak jak dziś
odtwarza żyjących gangerów z flag `dead:<key>`. Wróg nie odradza się (flaga `dead:`), więc nie da się
wylosować łupu drugi raz. Cele kontraktów są nowymi bytami z nowymi kluczami (`c<n>-g<i>`), więc ich
łupy są różne.

---

## 6. Ekonomia

### Ceny i reguły

| Reguła | Wzór | Uwagi |
|---|---|---|
| Kupno | `priceWithTerms(value × rarityValue, shopTerms(rep właściciela))` | Bez zmian względem kliniki. |
| Sprzedaż | `floor(value × rarityValue × 0,25 × sellFactor(tier) × conditionFactor)` | `sellFactor`: nieufnie 0,75, neutralnie 1, sympatia 1,1, zaufanie 1,2. `conditionFactor` jak w §4 (broń 1). |
| Sprzedaż `junk` | `floor(value × sellFactor(tier))` | Złom i chipy są po to, żeby je sprzedać. |
| Naprawa odzieży | `ceil(value × rarityValue × 0,3 × (100 − condition) / 100)` | Jedna sztuka „Części broni” zmniejsza koszt o 25 €$ (do zera). |
| Montaż wszczepu z ekwipunku | `priceWithTerms(0,25 × value, terms kliniki)` | §2, „Wszczepy jako przedmiot”. |
| Ulepszenie plecaka | 600 €$, potem 1200 €$ | Stragan na targu. |

Kto handluje:

- **Klinika Mori** (frakcja `clinic`): wszczepy, apteczki, opatrunki; skupuje tylko wszczepy.
- **Stragan Oyaji na targu** (frakcja `civilians`): amunicja, mody, odzież, broń zwykła i niezwykła,
  skup wszystkiego poza przedmiotami fabularnymi, naprawa, plecak. Interakcja `shop` z `shopId`.
  Dialog ink z Oyaji należy do Narrative i może powstać razem z nowymi zleceniami na targu.

### Balans względem dzisiejszych liczb

Przychód z kontraktu: 500 do 750 €$ (2 do 4 celów), przy dobrej reputacji u fixerów do +50%.

Wartość łupu z jednego gangera (`hebi_common`, wartości oczekiwane):

| Składnik | Gotówka po sprzedaży | Wartość użytkowa |
|---|---|---|
| Eddies (10 do 34 od E10, wcześniej 8 do 30) | 22 | 22 |
| 9 mm (0,36 × 10 szt.) | 0 | 3,6 (oszczędzony zakup) |
| Złom (0,24 × 1,5 × 12) | 4,3 | 4,3 |
| Apteczka (0,10) | 2,2 | 9,0 |
| Opatrunek (0,10) | 0,7 | 3,0 |
| Części (0,08 × 25) | 2,0 | 2,0 |
| Hebi SMG (0,05, średnio ×1,2 za rzadkość) | 10,5 | 10,5 |
| Kurtka Hebi (0,03) | 5,4 | 5,4 |
| Mod (0,03) | 2,3 | 2,3 |
| Wszczep (0,01) | 1,3 | 5,0 |
| **Razem** | **~51 €$** | **~67 €$** |

Kontrakt z 3 celami (625 €$) daje więc łup za około 152 €$ gotówki, czyli 24% wypłaty (przy dawnych 8 do 30 eddies: 145 €$ i 23%, ale ochrona z dwoma gangerami spadała do 17%, stąd korekta w E10). Cel: łup
w przedziale 20 do 30% wypłaty, żeby przeszukiwanie się opłacało, ale nie zastępowało zleceń.

Koszty jednego kontraktu z 3 celami:

| Koszt | Pistolet | Hebi SMG |
|---|---|---|
| Amunicja (5 trafień na gangera, celność ~65%) | ~24 szt. = 24 €$ | ~70 szt. = 70 €$ |
| Amunicja z łupu | ~11 szt. | ~11 szt. |
| Naprawa odzieży (10 trafień w gracza, kurtka Hebi) | ~36 €$ | ~36 €$ |
| Apteczki (1 na kontrakt, łup daje ~0,3) | ~63 €$ | ~63 €$ |
| **Saldo kontraktu (625 €$ + łup 145 €$ − koszty)** | **~ +660 €$** | **~ +610 €$** |

Co to oznacza dla zakupów (wpis porównawczy z kliniką):

- najtańszy implant (Stabilizator chwytu, 500 €$) to jeden kontrakt;
- Akcelerator Kairos (1100 €$) i Raijin 12 (1200 €$) to dwa kontrakty;
- Tessen AR-5 (1800 €$) to trzy kontrakty i ma być celem średnioterminowym;
- mody (250 do 350 €$) i odzież (300 do 900 €$) wypełniają przerwy między dużymi zakupami.

Test balansu w `core` (etap E10) liczy wartości oczekiwane tabel analitycznie (bez symulacji
losowej) i pilnuje przedziału 20 do 30%.

---

## 7. Menu postaci

### UX

- Jeden ekran „Postać” z zakładkami **Ekwipunek | Karta | Dziennik**. Karta to dzisiejszy
  `CharacterPanel` (wszczepy, wspomnienia, reputacja), Dziennik to `JournalPanel`. Klawisze: `I`
  ekwipunek, `Tab` karta, `J` dziennik; każdy otwiera ekran na swojej zakładce, ponowne naciśnięcie
  zamyka. Na dotyku dzisiejsze dwa małe przyciski (karta, dziennik) zastępuje jeden „Postać”.
- **Menu zatrzymuje symulację** (jak pauza). Komendy z menu (załóż, użyj, wyrzuć, mod) są
  stosowane od razu przez `simulation.applyPendingCommands()` (§8.5), więc podgląd i statystyki
  odświeżają się natychmiast. Sklep i panel łupu zatrzymują tylko gracza, jak dziś klinika.
- Projekt pod poziomy telefon 844 × 390 px CSS (punkt odniesienia), działa od 667 × 375. Cele
  dotyku co najmniej 48 × 48 px, komórka siatki 52 px. Marginesy z `env(safe-area-inset-*)` (wycięcie
  ekranu po lewej lub prawej). Pionowa orientacja: istniejąca podpowiedź „Obróć telefon poziomo”.
- Na desktopie ten sam układ, skalowany do maksymalnie 1280 × 720 i wyśrodkowany.

### Makieta (844 × 390)

```text
+----------------------------------------------------------------------------------------------+
| [Ekwipunek] [ Karta ] [Dziennik]                     €$ 1 240    9mm 72  .44 0  12g 6   [ X ] |
+-------------------------+------------------------------------------+-------------------------+
| [Glowa: Wizjer    ]     | Wszystko | Bron | Odziez | Zuzyw. | Inne | HEBI SMG      niezwykla |
|                         | +----++----++----++----++----++----+     | --------------------------|
|      .-----.            | |SMG*||APx3||OPx2||ZLx7||CZx1||TLM |     |            ta    zalozona |
|     ( Seki )   <- obrot | +----++----++----++----++----++----+     | Obrazenia   9.7   --      |
|      | 3D  |            | +----++----++----++----++----++----+     | Na minute   600   --      |
|      '-----'            | |KRT ||CEL ||WSZ ||    ||    ||    |     | Magazynek   30    --      |
| [Tors:  Kurtka Hebi ]   | +----++----++----++----++----++----+     | Rozrzut     2.3   --      |
| [Nogi:  Cargo       ]   | +----++----++----++----++----++----+     | Zasieg      25 m  --      |
|                         | |    ||    ||    ||    ||    ||    |     | (slot glowny pusty)       |
| [1 SMG][2 Unity-9][3 -] | +----++----++----++----++----++----+     |                           |
| HP 86/100  Pancerz T5   | |    ||    ||    ||    ||    ||    |     | [ ZALOZ ] [ MODY ]        |
| Kryt 24% x2.2  Rozrz 1.4| +----++----++----++----++----++----+     | [ SPRZEDAJ ] [ WYRZUC ]   |
|                         |  14 / 24                Sortuj: kategoria |                           |
+-------------------------+------------------------------------------+-------------------------+
```

Kolumny: lewa 30% (podgląd i założone), środkowa 40% (siatka 6 × 4 = 342 × 226 px), prawa 30%
(szczegóły, porównanie, akcje). Na ekranach poniżej 700 px szerokości prawa kolumna wjeżdża jako
panel nad siatką po zaznaczeniu przedmiotu.

### Elementy

| Element | Zawartość | Dotyk | Mysz i klawiatura |
|---|---|---|---|
| Podgląd 3D | Seki w aktualnym stroju, z bronią aktywnego slotu w dłoni i pozostałymi w miejscach przechowania, widoczne wszczepy. | Przeciągnięcie jednym palcem obraca (yaw), podwójne stuknięcie wraca do frontu. | Przeciąganie, kółko lekki zoom. |
| Sloty założone | Głowa, tors, nogi wokół podglądu; trzy sloty broni pod nim. | Stuknięcie zaznacza założony przedmiot (akcje: zdejmij, mody). | Kliknięcie; przeciągnięcie przedmiotu z siatki na slot zakłada. |
| Statystyki | HP, pancerz per strefa (sylwetka z liczbami po stuknięciu), kryt (szansa, mnożnik), rozrzut aktywnej broni na stojąco, obrażenia, szybkość. Reputacja w zakładce Karta. | Stuknięcie w liczbę pokazuje skąd się bierze (baza, wszczepy, odzież). | Najechanie. |
| Siatka | 24 do 36 komórek, filtry kategorii, sortowanie, licznik zajętości, ramka rzadkości i etykieta. | Stuknięcie zaznacza, podwójne stuknięcie wykonuje akcję domyślną (załóż, użyj), przytrzymanie 400 ms otwiera szczegóły. | Kliknięcie, podwójne kliknięcie, prawy przycisk to akcja domyślna, strzałki przesuwają zaznaczenie, Enter akcja domyślna. |
| Porównanie | Zaznaczony przedmiot obok założonego w tym samym slocie; zmiany w kolorze i strzałką (▲ lepiej, ▼ gorzej), zawsze też liczbą. | Widoczne od razu po zaznaczeniu. | Także po najechaniu na komórkę. |
| Akcje | Użyj, Załóż / Zdejmij, Mody, Wyrzuć, Sprzedaj (tylko przy otwartym sklepie), Zamontuj w klinice (wszczep, tylko w klinice). | Duże przyciski w prawej kolumnie; Wyrzuć i Sprzedaj przedmiotu rzadkiego proszą o potwierdzenie; stos pyta o ilość suwakiem. | Te same przyciski, skróty `E` załóż/użyj, `X` wyrzuć, `S` sprzedaj. |
| Mody | Nakładka z trzema slotami modów broni i pasującymi modami z siatki. | Stuknięcie w mod montuje. | Kliknięcie lub przeciągnięcie. |

### Spójność z kartą, dziennikiem i sklepem

- Wspólne komponenty `ItemCell`, `ItemDetail`, `StatDelta`, `PriceTag`: sklep pokazuje swoje
  towary tą samą komórką i tym samym porównaniem z założonym przedmiotem.
- Sklep dostaje zakładkę **Sprzedaj**: siatka ekwipunku gracza z ceną skupu w komórce.
- Wszystkie ceny i statystyki liczy `core` (`priceWithTerms`, `sellPrice`, `effectiveWeapon`,
  `compareItems`); UI ich nie przelicza po swojemu.
- Toasty: podniesienie łupu, pełny ekwipunek, zniknięcie torby z niezabranym łupem.

### Lista komponentów (`packages/ui`)

| Komponent | Plik |
|---|---|
| `CharacterScreen` (zakładki, klawisze I/Tab/J) | `menus/character-screen.tsx` |
| `InventoryTab` | `inventory/inventory-tab.tsx` |
| `CharacterPreview` (host podglądu, mierzy prostokąt, obrót) | `inventory/character-preview.tsx` |
| `EquipmentSlots` | `inventory/equipment-slots.tsx` |
| `StatsPanel` | `inventory/stats-panel.tsx` |
| `ItemGrid`, `ItemCell`, `GridFilters` | `inventory/item-grid.tsx` |
| `ItemDetail`, `StatDelta` | `inventory/item-detail.tsx` |
| `ActionBar`, `QuantityPicker`, `ConfirmSheet` | `inventory/actions.tsx` |
| `ModOverlay` | `inventory/mod-overlay.tsx` |
| `LootPanel` | `loot/loot-panel.tsx` |
| `SellTab` w `ShopPanel` | `shop/sell-tab.tsx` |
| HUD: `WeaponStrip` (sloty i amunicja), przycisk `R` w `TouchControls` | `hud/weapon-strip.tsx`, `touch/touch-controls.tsx` |

Testy komponentów (Vitest + Testing Library): zaznaczenie i akcja domyślna, porównanie, blokada
akcji przy pełnym ekwipunku, potwierdzenie przy rzadkim przedmiocie, podgląd wysyła prostokąt
i obrót przez intencje.

---

## 8. Kontrakty między pakietami

### 8.1 Typy w `core`

Nowy moduł `core/items` (Core Domain) z katalogami i czystymi funkcjami, typy kontraktowe w
`core/ports`, `core/events`, `core/commands` (Architekt):

```ts
// core/items
type Rarity = "common" | "uncommon" | "rare" | "unique";
type ItemCategory = "weapon" | "consumable" | "garment" | "cyberware" | "mod" | "junk" | "key";
type StackableId = ConsumableId | JunkId;
type ItemDefId = WeaponId | GarmentId | ModId | CyberwareId | StackableId | KeyItemId;

interface ItemInstance {
  readonly uid: string;
  readonly def: WeaponId | GarmentId | ModId | CyberwareId;
  readonly rarity: Rarity;
  readonly loaded?: number;                                  // broń palna
  readonly mods?: Readonly<Partial<Record<ModSlot, string>>>;// uid zamontowanych modów
  readonly condition?: number;                               // odzież
}
interface InventoryState {
  readonly stacks: Readonly<Partial<Record<StackableId, number>>>;
  readonly items: readonly ItemInstance[];   // w ekwipunku i założone; miejsce mówi equipment
  readonly keyItems: readonly KeyItemId[];
  readonly capacity: number;
  readonly nextUid: number;
}
interface Equipment {
  readonly primary: string | null; readonly secondary: string | null; readonly melee: string | null;
  readonly head: string | null; readonly torso: string | null; readonly legs: string | null;
  readonly active: WeaponSlot;
}
type AmmoPouch = Readonly<Partial<Record<AmmoId, number>>>;
type ItemRef = { readonly uid: string } | { readonly stack: StackableId };
```

Funkcje (wszystkie czyste, z wynikiem `{ ok: true, ... } | { ok: false, reason }` jak w `shop`):
`usedCells`, `addToInventory`, `removeFromInventory`, `equip`, `unequip`, `useConsumable`,
`effectiveWeapon`, `zoneArmor`, `wearGarment`, `reloadPlan`, `installMod`, `removeMod`,
`rollLoot`, `takeLoot`, `sellPrice`, `sell`, `repairCost`, `repair`, `compareItems`,
`appearanceOf(domain)`.

`DomainState` dostaje `equipment`, `ammo`, `loot`, a `inventory` zmienia typ na `InventoryState`.
`Inventory`, `ItemId` i `MAX_STACK` zostają jako aliasy do czasu migracji wszystkich użyć (etap E1),
potem znikają.

### 8.2 Komponenty w `sim`

```ts
interface Combatant {
  weapon: WeaponId;          // gracz: z equipment, NPC: z typu wroga
  slot: WeaponSlot;
  cooldown: number;
  holstered: boolean;
  drawing: number;
  reloading: number;         // s do końca przeładowania, 0 = brak
  loaded: number;            // NPC; gracz czyta i zapisuje instancję w domenie
  bloom: number;             // [walka]
}
interface Enemy { readonly type: EnemyTypeId }
interface LootBag { readonly key: string }   // treść w domain.loot, byt tylko ją wskazuje
// Interactable.kind: "dialogue" | "shop" | "loot"; dla "shop" także shopId: "clinic" | "oyaji"
```

Systemy (kolejność tylko w `createSystems()`): `weaponSystem` (wybór slotu, kabura, przeładowanie,
zaraz przed `combat`), istniejący `combat` (strzał zużywa `loaded`), `death` (losuje łup, tworzy
torbę), nowy `lootSystem` (czas życia toreb, zaraz po `death`), `item` (szybkie użycie apteczki,
bez zmian w zachowaniu). Źródłem prawdy dla broni gracza jest domena; `Combatant` gracza to cache
odświeżany po komendzie zmieniającej `equipment`.

### 8.3 Komendy, wejście i zdarzenia

Nowe `GameCommand` (z menu, sklepu, panelu łupu; żadna nie zużywa RNG):

| Komenda | Pola |
|---|---|
| `equip-item` | `uid`, `slot?` |
| `unequip-item` | `slot: WeaponSlot \| GarmentSlot` |
| `use-item` | `ref: ItemRef` |
| `drop-item` | `ref: ItemRef`, `qty` |
| `sell-item` | `ref: ItemRef`, `qty` (wymaga otwartego sklepu) |
| `buy-item` | `shopId`, `itemId` (rozszerzenie istniejącej) |
| `repair-item` | `uid`, `useParts: number` |
| `install-mod` / `remove-mod` | `weaponUid`, `modUid` / `weaponUid`, `slot` |
| `install-cyberware-item` / `remove-cyberware` | `uid` / `slot` (tylko w klinice) |
| `take-loot` | `containerKey`, `line: number \| "all"` |
| `upgrade-capacity` | (stragan) |

`InputFrame` (Input + Architekt): `reload: boolean` (zbocze), `weaponSlot: 0 | 1 | 2 | 3`
(0 = bez zmiany, zbocze). `TouchButton` dostaje `"reload"`, a pasek broni w HUD wywołuje
`weaponSlot` przez `TouchPadSink`.

Nowe zdarzenia w `DomainEvents`:

```ts
ItemAdded: { ref: ItemRef; defId: ItemDefId; qty: number; source: "loot" | "shop" | "quest" | "clinic" };
ItemRemoved: { ref: ItemRef; qty: number; reason: "used" | "dropped" | "sold" | "installed" };
ItemEquipped: { uid: string; slot: EquipSlot; replaced: string | null };
ItemUnequipped: { uid: string; slot: EquipSlot };
ItemSold: { defId: ItemDefId; qty: number; price: number };
ItemRepaired: { uid: string; price: number };
InventoryFull: { defId: ItemDefId };
WeaponSwitched: { entityId: EntityId; slot: WeaponSlot; weapon: WeaponId };
ReloadStarted: { entityId: EntityId; duration: number };
ReloadFinished: { entityId: EntityId; loaded: number };
AmmoChanged: { loaded: number; reserve: number };          // tylko gracz, dla HUD
LootDropped: { containerKey: string; at: Vec3; best: Rarity | null };
LootTaken: { containerKey: string; lines: readonly LootLine[] };
LootExpired: { containerKey: string };
```

`ItemUsed` i `ItemBought` zostają; `ItemUsed.itemId` przechodzi na `ItemRef`.

### 8.4 RenderPort i wygląd postaci

```ts
interface AppearanceDescriptor {
  readonly weapons: {
    readonly primary: WeaponLook | null;
    readonly secondary: WeaponLook | null;
    readonly melee: WeaponLook | null;
    readonly active: WeaponSlot;
  };
  readonly garments: Readonly<Partial<Record<GarmentSlot, GarmentLook>>>;
  readonly implants: readonly ("optics" | "arms")[];
}
type WeaponLook = "pistol" | "revolver" | "smg" | "shotgun" | "rifle" | "baton" | "blade";

interface RenderPort {
  // istniejące metody bez zmian
  setAppearance(entityId: EntityId, appearance: AppearanceDescriptor): void;
}
// EffectDescriptor: { kind: "weapon"; entityId; drawn; slot } (pole slot dodane)
//                   { kind: "reload"; entityId; duration }
// ViewDescriptor:   { kind: "loot"; style: "bag"; best: Rarity | null }
```

- `appearanceOf(domain)` w `core` buduje deskryptor gracza; `RenderSync` w `sim/presentation`
  wywołuje `setAppearance`, gdy wynik się zmienił (porównanie referencji, deskryptor memoizowany
  po `equipment`, `inventory.items` i `character.cyberware`). NPC dostają deskryptor ze swojego
  typu raz, przy spawnie.
- Renderer mapuje `WeaponLook` na mesh: dziś bryły w stylu obecnego pistoletu, później glTF z
  Quaternius (pozycja „Broń z publicznych assetów” w backlogu) bez zmiany kontraktu. Miejsca
  przechowania: `hipR` (boczna), `back` (główna), `hipL` lub `back` (wręcz). Viewmodel FPP w
  `camera-rig` dostaje ten sam `WeaponLook` aktywnego slotu i animację przeładowania z efektu
  `reload` (czas z deskryptora, żeby animacja kończyła się z symulacją).
- Rozdzielenie `spawn` i `setAppearance` pozwala zmieniać strój bez respawnu widoku (i bez
  ponownego ładowania modelu VRM).

### 8.5 Podgląd 3D w menu

UI nie zna `engine`, więc kontrakt idzie przez intencje UI i kompozycję w `app`:

```ts
// packages/ui/src/intents.ts (UI)
interface PreviewRect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
interface UiIntents {
  // istniejące ...
  openCharacterScreen(tab: "inventory" | "sheet" | "journal"): void;
  closeCharacterScreen(): void;
  setPreviewViewport(rect: PreviewRect | null): void;  // CSS px, null = ukryty
  rotatePreview(deltaYaw: number): void;
  resetPreview(): void;
  equip(uid: string, slot?: EquipSlot): void;          // i pozostałe akcje z §8.3
}
```

- `CharacterPreview` renderuje pusty, przezroczysty `div`, mierzy go `ResizeObserver`em i wysyła
  prostokąt. Przeciąganie zamienia na `rotatePreview`.
- `app` przekazuje prostokąt i `appearanceOf(domain)` do `PreviewStage` w
  `engine/src/renderer/preview-stage.ts` (Rendering): osobna `Scene` na **tym samym** `Engine` i
  canvasie, z własną kamerą, światłem i jednym rigiem bohaterki (proceduralnym albo z
  `ModelLibrary`, z instancji już załadowanego kontenera). Renderowana w viewporcie prostokąta.
- Gdy menu jest otwarte, symulacja stoi, a scena gry nie jest renderowana (tło menu jest
  nieprzezroczyste). Jedna scena w klatce mieści się w budżecie telefonu; drugi kontekst WebGL
  (osobny canvas) odrzucamy: osobna kompilacja shaderów i podwójna pamięć tekstur.
- Na jakości `low` podgląd renderuje się tylko przy zmianie (obrót, nowy strój), nie co klatkę.
- Test kontraktowy: atrapa `PreviewStage` w `app/test` sprawdza, że prostokąt i deskryptor
  docierają po otwarciu menu i znikają po zamknięciu.

`Simulation.applyPendingCommands()` (Simulation/ECS) wykonuje tylko fazę stosowania komend z
następnego `step`. Wynik jest identyczny z kolejnym krokiem, bo komendy z menu nie zużywają RNG
ani czasu; replay zapisuje je w ramce następnego kroku, jak dziś.

### 8.6 Zapis i migracja

- `SAVE_SCHEMA_VERSION`: kolejny numer po harmonogramach (v7), czyli prawdopodobnie **v8**; numer
  ustalany przy scaleniu.
- Migracja `vN−1 → vN` w `packages/persistence/src/migrations.ts`:
  - `domain.inventory { medkit: n }` → `{ stacks: { medkit: n }, items: [Unity-9 "i1" zwykły,
    loaded 12; Kurtka Seki "i2"; Spodnie cargo "i3"], keyItems: [], capacity: 24, nextUid: 4 }`;
  - `domain.equipment = { secondary: "i1", torso: "i2", legs: "i3", primary: null, melee: null,
    head: null, active: "secondary" }`;
  - `domain.ammo = { "9mm": 48 }`;
  - `domain.loot = { containers: [], dropSeq: 0 }`;
  - identyfikatory zapisane literalnie w migracji (zasada z migracji v4).
- Testy: przejście z fixture v6 i v7 do vN, zapis i odczyt z torbami w wyładowanym chunku,
  instancja z nieznanym `def` odrzucona przez `validate.ts` (pomijana z ostrzeżeniem,
  zapis się wczytuje).
- Nie zapisujemy: `reloading` (przerwane przeładowanie po wczytaniu nie nastąpiło), `bloom`,
  magazynków NPC (wracają pełne), stanu podglądu i sortowania siatki.
- Złoty hash w `sim/test/determinism.test.ts` zmienia się w E4 (amunicja i przeładowanie wchodzą
  do symulacji) i w E6 (łup w domenie). Każda zmiana z uzasadnieniem w commicie.

---

## 9. Etapy wdrożenia

Każdy etap to jeden PR z zielonym `pnpm ci`. Kolejność uwzględnia zależność od pakietu walki.

| # | Etap | Obszar (CLAUDE.md) | Kryterium akceptacji | Testy |
|---|---|---|---|---|
| E0 | Kontrakty: typy w `core/ports`, `events`, `commands`, `InputFrame.reload/weaponSlot`, `RenderPort.setAppearance` z pustą implementacją w atrapie i w Babylonie. | Architekt | Kompiluje się, zachowanie gry bez zmian, złoty hash bez zmian. | typecheck, depcheck, test kontraktowy atrapy RenderPort. |
| E1 | `core/items`: katalogi, rzadkość, `InventoryState`, sloty i stosy, `equip`/`unequip`, `useConsumable`. Aliasy dla starego `Inventory`. | Core Domain | Wszystkie funkcje czyste, 100% gałęzi w `core/items`. | Jednostkowe: pojemność, stos ponad limit, pełny ekwipunek, zamiana założonego. |
| E2 | Broń i pancerz w `core`: `WeaponDefinition`, profile NPC, `effectiveWeapon`, mody, `reloadPlan`, `zoneArmor`, zużycie odzieży. | Core Domain | Unity-9 w tors gangera = 19, w głowę = 35; Hebi SMG gangera na gracza bez odzieży = 5. | Jednostkowe z liczbami z §3 i §4. |
| E3 | Zapis: nowe pola `DomainState`, migracja vN, walidacja. | Persistence (+ Core dla typów) | Zapis v6 i v7 wczytuje się z bronią startową; round-trip. | Migracje z fixture, uszkodzona instancja. |
| E4 | `weaponSystem`: sloty, dobycie per broń, magazynek, przeładowanie, amunicja; HUD `WeaponStrip`, przycisk `R`, klawisze `1-3`, `R`. | Simulation / ECS, Input, UI | Gracz strzela 12 razy, przeładowuje 1,4 s, zapas maleje; zmiana slotu przerywa przeładowanie. | Integracyjne sim, replay, nowy złoty hash, test komponentu HUD. |
| E5 | Strefy pancerza w `fireShot` i pancerz NPC ze stroju. Wymaga hitboxów **[walka]**. | Simulation / ECS | Trafienie w głowę gangera omija pancerz; trafienie w tors gracza zużywa kurtkę. | Integracyjne sim. |
| E6 | Łupy: `rollLoot`, `deriveRandom`, torba w `deathSystem`, `lootSystem`, `Interactable "loot"`, `take-loot`, odtwarzanie toreb przy wczytaniu i streamingu. | Core Domain, Simulation / ECS | Ten sam wróg z tym samym ziarnem zawsze daje ten sam łup, niezależnie od liczby strzałów; torba znika po 300 s; zapis zachowuje torbę. | Jednostkowe (stała liczba losowań), integracyjne, replay, złoty hash. |
| E7 | Renderer: `setAppearance`, broń w trzech miejscach, przeładowanie (rig i viewmodel), widok torby, dodatki odzieży na rigu i na VRM. | Rendering / NPR | Seki ma SMG na plecach i pistolet w kaburze; zmiana kurtki widoczna bez respawnu; budżet draw calli dotrzymany. | Migawka NPR (`--update-snapshots=all`, obejrzana), perf-check. |
| E8 | Podgląd: `PreviewStage` (Rendering), intencje i okablowanie w `app` (Infra/Build), `applyPendingCommands` (Simulation). | Rendering / NPR, Infra / Build, Simulation / ECS | Obrót palcem działa na 844 × 390; założenie broni zmienia podgląd w tej samej klatce. | Test kontraktowy atrapy podglądu w `app`, test sim dla `applyPendingCommands`. |
| E9 | UI: `CharacterScreen` z zakładkami, `InventoryTab`, porównanie, akcje, `ModOverlay`, `LootPanel`. | UI / HUD | Wszystkie akcje z §7 działają dotykiem i myszą; karta i dziennik bez regresji. | Testy komponentów, istniejące testy karty i dziennika. |
| E10 | Ekonomia: `sellPrice`, `repair`, stragan Oyaji (`shopId`), zakładka Sprzedaj, plecak; dialog Oyaji. | Core Domain, UI / HUD, Narrative | Sprzedaż i naprawa liczone tą samą funkcją w UI i sim; łup to 20 do 30% wypłaty kontraktu. | Jednostkowe, analityczny test balansu, test panelu sklepu. |
| E11 | Wszczep jako przedmiot: montaż i demontaż w klinice, zwrot zastąpionego implantu. | Core Domain, UI / HUD | Znaleziony Stabilizator chwytu kosztuje 125 €$ montażu; zastąpiony implant wraca do ekwipunku. | Jednostkowe `shop`, test panelu kliniki. |
| E12 | Audio: dźwięki przeładowania, zmiany broni, podniesienia łupu. | Audio | Cue grają na nowe zdarzenia. | Test mapowania zdarzeń na cue. |
| E13 | E2E: zabicie gangera, przeszukanie torby, założenie SMG, widoczne w podglądzie, zapis i odczyt; wariant viewportu telefonu. | QA | Scenariusz zielony na desktopie i w emulacji telefonu (poziomo). | Playwright. |

E1 do E3 można robić równolegle z pakietem walki; E5 czeka na hitboxy; E7 i E8 czekają na E0.

---

## 10. Ryzyka i otwarte pytania

| Temat | Ryzyko lub pytanie | Rekomendacja |
|---|---|---|
| Płaski pancerz | Redukcja płaska z minimum 20% zeruje słabe bronie: SMG gangera (7) przy pancerzu 7 zadaje 1. Odzież łatwo zrobi gracza nietykalnym. | Zostać przy `mitigate` (nie ruszać ADR-0010), ograniczyć sumę pancerza strefy do 8 i trzymać wartości odzieży nisko. Po E5 zmierzyć czas przeżycia w kontrakcie; jeśli przekroczy cel, przejść na redukcję procentową `raw × 10 / (10 + armor)` osobnym ADR. |
| Menu zatrzymuje grę | Leczenie i zmiana broni w pauzie w środku walki ułatwia grę. | Zostawić pauzę (telefon, jedna ręka, przerwy w sesji). Szybkie akcje (apteczka, przeładowanie, sloty) są w HUD, więc menu w walce nie jest potrzebne. Wrócić do tematu po testach gry. |
| Torba zamiast ciała | Mniej immersji. | Torba w E6; ciało jako styl `"body"` w `ViewDescriptor` później, jeśli budżet draw calli pozwoli. Kontrakt już to przewiduje. |
| Wygląd VRM | Ubrania VRoid są wtopione w mesh; podmiana kurtki na modelu importowanym jest niemożliwa bez osobnego pliku. | Etap 1: tylko dodatki na kościach i broń. Pole `outfits` w manifeście jako osobna decyzja, gdy powstanie docelowy model Seki. |
| Kolizja numeru zapisu | Harmonogramy (v7) i ta zmiana mogą wejść w innej kolejności. | Migracja pisana jako „ostatnia + 1”, numer i fixture ustalane przy scaleniu; test migracji przechodzi przez wszystkie wersje. |
| Złoty hash | E4, E5 i E6 zmieniają hash, równolegle zmienia go pakiet walki. | Każdy PR aktualizuje hash po rebase na najnowszy `main`, z opisem w commicie. |
| Rozrzut a `accuracy` | Dzisiejsza `accuracy` (rzut na trafienie) i nowy rozrzut z pakietu walki mogą się dublować. | Ustalić z pakietem walki: rekomendacja, żeby rozrzut zastąpił rzut na trafienie dla gracza, a `accuracy` została tylko w profilu NPC. |
| `steady_grip` | Zmiana z `damageBonus: 4` na `aimStability` łamie kryterium ADR-0010. | Decyzja pakietu walki; jeśli zmiana, to razem z aktualizacją `m1-loop.test.ts`. |
| Stragan Oyaji | Oyaji jest dziś przechodniem (`bystander`) bez interakcji. | Zamienić go w handlarza w E10 w porozumieniu z autorami zleceń na targu; do tego czasu skup i naprawa mogą być tymczasowo w klinice. |
| Wyrzucanie jako exploit | Wyrzucona torba z czasem życia może służyć jako dodatkowy schowek. | Akceptowalne: limit 12 toreb i 300 s. Nie zapisywać toreb `drop:` dłużej niż łupów. |
| Strzelba i RNG | 8 śrucin to do 32 liczb losowych na strzał. | Koszt pomijalny; ważna jest tylko stała liczba, test w E6 i E4 to sprawdza. |
