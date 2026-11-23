# Dach trójkątnego pawilonu Alchemii (`alchemia-pawilon-dach`)

Płaski dach szklanego pawilonu na rogu Bajkowskiego i Lubartowskiej (ADR-0074 etap 3, T-230, T-231), za attyką i nad neonem ALCHEMIA. W akcie II „Lustro” (ADR-0023, `m3_lustro`) ukrywa się tu Ren Odagiri, a obok niego leży torba Hebi `stash:targ-roof`. Jedyne wejście to drabina serwisowa na zapleczu od strony T0 (ADR-0021).

## Historia
Na rogu Bajkowskiego i Lubartowskiej, przy przystanku Brama Krakowska, stały kasy biletowe MPK. Za nimi był naziemny parking w173531008 przy płocie działki, którą miasto oddało w 2005 roku w użytkowanie wieczyste spółce Arkady. Koncepcja inwestora z 2026 roku stawia w miejscu kas trójkątny przeszklony pawilon z gastronomią (`docs/plany/alchemia.md`, S1, S7, S13). W grze ten pawilon stoi: restauracja za szkłem jest tłem bez wnętrza, a dach należy do nikogo. Na dach prowadzi tylko drabina serwisowa na skrzynce zaplecza, którą obsługa kuchni wchodzi do wyciągu.

W 2077 roku targ spod wiaduktu na alei Tysiąclecia od kilku lat stoi w Alchemii („trzydzieści lat pod wiaduktem, a teraz tu”, Goro w `m4-ulica.ink`), a Hebi biorą haracz od straganiarzy. Ren Odagiri, kurier Hebi, dwa lata temu woził z Seki walizkę chipów pamięci z nabrzeża do laboratorium Kagami Biotech („Kagami płaci za jeden kurs tyle, co Hebi za rok”). Siedzieli wtedy na tym samym dachu, w deszczu, nad szumem targu (`recall_rooftop`). Po wypadku Ren pół roku pytał o Seki każdego na deptaku (Ume w `m0.ink`). Wyjął z walizki chip z jej imieniem, „zapis zero” sprzed nadpisania, i nosi go w folii. Teraz Kagami wystawiło na niego zlecenie przez Kaito, więc Ren wrócił na dach. Pościg kończy się tu u stóp drabiny, a z dachu widać deptak Lubartowskiej, Plac Łokietka i Stare Miasto aż po Trybunał.

Przed chwilą (cel sceny, §5): Ren rozpiął nową plandekę, bo w nocy przeciekała. Puszka energetyka jeszcze się poci, czytnik chipów miga na zielono, a do wiadra pod rogiem plandeki kapie woda.

## Klimat
- **Światło:** od południa cyjanowy neon ALCHEMIA na tablicy nad dachem (akcent; od strony dachu litery czyta się wspak), od dołu ciepła poświata szkła restauracji (`shop-warm`, w nocy pawilon świeci jak latarnia, ADR-0074 §6). Nad wschodnią attyką wiszą trzy girlandy lampionów deptaka, rozpięte z attyki pawilonu do kamienicy w66286394 (`deptak-night.ts`, z −7,2, −4,2 i −1,2, na wysokości 4,4). Na zachodzie żółte światło osi wejścia głównego i pasy LED pod L2. Obóz Rena nie ma dziś własnego światła (dług).
- **Dźwięk:** z dołu deptak bez aut (T-324): stragany, okienko z cebularzami, przechodnie przy przystanku. Bliżej brzęczy neon. Kiedy pada, deszcz bębni o membranę dachu i plandekę. W grze dach nie ma własnych źródeł dźwięku (dług).
- **Zapach:** smażone ciasto z deptaka, mokra papa, para z wyciągu kuchni (docelowo).
- **Kontrast (§3):** chip z zapisem całego życia w foliowym woreczku leży obok koca na paletach. Pod spodem jest szklana restauracja z planu inwestora.
- **Ruch i życie:** przechodnie i stoiska w dole, girlandy na wietrze (docelowo), Ren obracający fiolkę.

## Przeznaczenie
- Krok `meet_ren` zadania `m3_lustro`: rozmowa `ren_odagiri.first_meeting`, chip od Rena i wspomnienie `rooftop`. Potem powroty: `waiting`, `under_fire` w czasie zasadzki, `finale` po pokonaniu czyścicieli, a w akcie III po zakończeniu „hebi” trop do Zamku (`zrodlo_ren`).
- Łup: torba Hebi `stash:targ-roof` (180 €$, 30 naboi 5,56, apteczka, kolimator holo), stawiana, gdy gracz podejdzie na 40 m (`loot-system.ts`), także przed aktem II.
- **Wejście:** drabina na zachodniej ścianie zaplecza, stopa (424,1; −1,25) na T0 przy osi wejścia głównego, wyjście na dach (425,2; 3,85; −1,25). Attyka ma przerwę 1,3 m tylko przy głowicy drabiny.
- **Ucieczka:** drabina z powrotem albo zeskok przez attykę (1,0 m) na chodnik Bajkowskiego lub deptak. Od szczytu skoku to ok. 5,5 m, czyli ok. 15 obrażeń przy `FALL_SAFE_HEIGHT` 4 m (`movement-system.ts`).
- **Osłony:** attyka 1,0 m (osłona w kucaniu), słupki tablicy neonu.
- **Widok:** na wschód nad deptakiem na Stare Miasto (Ren patrzy na Trybunał (582,4; −61,2)), na południe na Plac Łokietka i Bramę Krakowską, na zachód na rampę P−1 i plac frontu.

## Topografia
- Prawdziwe miejsce: róg Bajkowskiego i Lubartowskiej, wcięcie parkingu w173531008 (Przystankowa), dawne kasy MPK. Chodniki w232464426 (Bajkowskiego) i w749050539 (Lubartowska) wyznaczają boki trójkąta.
- W grze narożniki (423,3; −8,7), (432,3; −8,2) i (436,2; 6,0) (po ADR-0093 O2b zachodni o 2,8 m na wschód), zaplecze x 424,5–428,5, z −3,5…1. Posadzka −0,15, dach 3,85, attyka 1,0 m. Teren zostaje na NMT (−0,79…−0,39), bez `PADS`. Obrys stoi 0,40 m od kostki w232464426 i 0,55 m od w749050539, 20,7 m od pawilonu metra B.
- Odstępstwa celowe: T-230 (bryła z planu inwestora, mniejsza niż „ok. 18 × 15 m”, bo boki wyznaczają chodniki; po O2b 12,9 × 14,7 m) i T-231 (zaplecze z drabiną, tablica neonu do 6,2 m nad posadzką, 1,2 m ponad limit 5 m z §1). Deptak Lubartowskiej bez aut to T-324.

## Inwentarz docelowy
- **Architektura:** membrana dachu ze spadkiem do wpustu i kałużą przy nim; obróbka blacharska attyki; koryto kablowe od tablicy neonu do skrzynki zasilania; kotwy girland deptaka na wschodniej attyce (są, `deptak-night.ts`); wyrzutnia wyciągu kuchni restauracji nad zapleczem. Źródło: bryły w `pavilion.ts`, rysunek w `renderer/alchemia/pavilion-geometry.ts`.
- **Duże obiekty:** tablica neonu ALCHEMIA na dwóch słupkach (jest, silnik); agregat wyciągu z wentylatorem i parą (Blender, nowy skrypt w `tools/blender/`); maszt z anteną satelitarną (ADR-0096, antena Duane's Mind); obóz Rena: plandeka rozpięta między słupkiem tablicy a masztem, materac na dwóch paletach, skrzynka po amunicji jako stolik (Blender; palety i kartony z Street Asset Pack, ADR-0096); torba Hebi jako model torby, a nie ogólny pojemnik.
- **Drobiazg w skupiskach (§14):**
  - obóz: śpiwór, termos, dwie puszki energetyka, puszka z niedopałkami, czytnik chipów z kablem do powerbanku, lampka kempingowa, wiadro pod rogiem plandeki;
  - głowica drabiny: karabińczyk na szczeblu, rozdeptana ulotka targu, wąż Hebi wymalowany sprayem na zapleczu (`graffiti` z modeli gry);
  - przy tablicy: taśma na złączu neonu, plombowana skrzynka zasilania.

## Frakcja i zasady
Frakcja: ulica, technika (obóz kuriera Hebi z czytnikiem chipów na szklanym dachu restauracji z planu inwestora).
- §12 częściowo: drabina i przerwa 1,3 m w attyce to ciasny próg, po którym dach otwiera się na panoramę Starego Miasta (zgodne). Próg zmienia światło z żółtego placu T0 na cyjan neonu i niebo (zgodne). Obrys idzie po chodnikach z danych, więc wymiary są poza siatką 0,5 m z powodu §1; zaplecze 4 × 4,5 m leży na siatce.
- §13 dług: brak pomiaru 60-30-10. Na dachu jest tylko akcent (neon) i poświata z dołu, a światła motywowanego z obozu nie ma: Ren stoi w ciemności. Stopa drabiny nie ma światła nawigacji.
- §14 dług: dach jest pusty, makro to tylko tablica neonu, mezo i mikro po zero. Torba to ogólny pojemnik łupu.
- §15 dług: membrana i attyka są matowe, bez kałuży i bez mokrej plandeki, choć deszcz ma tu skąd przyjść.
- §16 częściowo: kontrast ulicy i szklanej bryły wynika z miejsca, ale po stronie ulicy na dachu nie ma żadnego przedmiotu.
- §17 dług: brak źródeł dźwięku na dachu (brzęczenie neonu, wentylator wyciągu, kapanie). Skalę daje attyka 1,0 m i drabina. Ruchu na dachu nie ma: Ren stoi bez czynności, para i girlandy nie istnieją.

## Scenariusz

### Pierwszy kadr
Seki wychodzi z drabiny na dach zaplecza w (425,2; 3,85; −1,25), twarzą na wschód. Przed nią, 4,8 m dalej, stoi Ren w (430; −3,4), plecami do niej, i patrzy nad deptakiem na Trybunał. Po prawej, od południa, świeci od tyłu cyjanowa tablica ALCHEMIA i rysuje jego sylwetkę. Za wschodnią attyką wiszą girlandy lampionów, a dalej leżą dachy Starego Miasta. Z dołu słychać deptak. Wzrok przyciąga neon (akcent), a docelowo ciepła lampka kempingowa pod plandeką przy jego nogach, gdzie leży torba Hebi (431,3; −2,7).

### Postacie i miejsca
- **Ren Odagiri** (`ren`, preset `civilian`, frakcja `hebi`): (430; 3,85; −3,4), twarzą na Trybunał (582,4; −61,2), rozmowa w promieniu 2,4 m. Jest od flagi `ren_trail` do zakończenia „kagami” (`market.ts`), bez planu dnia, więc o każdej porze. Ink mówi, że siedzi pod plandeką, a w grze stoi.
- **Torba Hebi** `stash:targ-roof` w (431,3; 3,85; −2,7), stawiana w promieniu 40 m.
- Nikt inny tu nie wchodzi: AI nie chodzi po drabinie (ADR-0021). W dole przechodnie deptaka i osi wejścia. Kurosawy z dachu nie widać, bo stoi w pasażu pod L2, 35 m na północ (`alchemia-parking-kiosk`).

### Przebieg
1. **Trop** (`ren_trail`): Ume albo Mori mówią, gdzie śpi Ren. Cel na HUD: „Wejdź drabiną serwisową od zaplecza szklanego pawilonu na rogu Alchemii i znajdź Rena na dachu”. Napięcie niskie, a jedyną przeszkodą jest znalezienie drabiny.
2. **Spotkanie** (`meet_ren`, `first_meeting`): zależnie od zakończenia aktu I („aya” albo „seki”) Ren wita Ayę albo obraca fiolkę z modułem. Wybory z życiorysu (`choice_crash`, `choice_case`) otwierają jego wersję tamtej nocy. Decyzja: czy wziąć chip i czy mu wierzyć. Nagroda: chip „zapis zero”, flaga `met_ren` i wspomnienie `rooftop`.
3. **Wspomnienie** (`recall_rooftop`): ten sam dach dwa lata wcześniej, w deszczu. Wybór „razem” albo „sama” (`choice_rooftop`) wraca w finale.
4. **Czekanie** (`waiting`): „Idź do Kaito”, a po kroku `kaito_job` „Kurosawa czeka na placu na dole, przy windzie”.
5. **Pod ostrzałem** (`under_fire`): w czasie zasadzki Ren słyszy strzały z dołu i odsyła Seki do walki.
6. **Finał** (`finale`, po wyborze „street” albo „hebi” i śmierci trzech czyścicieli): rozliczenie z głosem Rena (`choice_voice`), z obietnicą morza (`choice_rooftop`) i z modułem, potem `end_act2()`. Seki schodzi z walizką cudzych żyć albo z połową zapłaty.
7. **Po akcie:** `after_street` i `after_hebi`. W akcie III po „hebi” Ren pokazuje na dłoni mapę z kropką nad Kaplicą (`zrodlo_ren`, flaga `castle_lead`). Po „kagami” Rena nie ma („Nasi ludzie zdejmą go z dachu jeszcze tej nocy”), a dach zostaje pusty z torbą, jeśli jej nikt nie wziął.

### Drogi
- **Cicha:** jedyna droga na dach to drabina od T0. Z gorącem na karku dach jest schronieniem, bo pościg staje u stóp drabiny.
- **Głośna:** na dachu nie ma walki w zadaniu. Kagami nie wchodzi na górę, a zasadzka toczy się w pasażu pod L2.
- **Ucieczka:** drabiną na T0, a stamtąd do drzwi P1 galerii (oś wejścia x 419,2–422,8), do metra B w (428; 28) 30 m na północ albo na deptak. Zeskok przez attykę na Bajkowskiego albo deptak kosztuje ok. 15 obrażeń.
- **Pułapka:** jedna droga w górę. Kto stoi u stóp drabiny, zamyka dach.
- **Osłony:** attyka 1,0 m i słupki tablicy.

### Pora i stan świata
- Ren nie ma planu dnia, więc jest o każdej porze. Ink ciągnie scenę w noc i deszcz (wspomnienie, „pod wami szumi targ”). W nocy dach świeci neonem i girlandami, w dzień jest szarym blatem nad deptakiem.
- Przed aktem II dach jest pusty i leży na nim tylko torba. Po zakończeniu „kagami” Rena nie ma. Po „street” i „hebi” zostaje do aktu III.
- Frakcje: dach leży poza terytoriami ADR-0091 (najbliższe to `alchemia-arcades`, 110 m na północ). Pasmo targu 10–20 z obszaru `alchemia-car-park` (`district-bands.ts`).

### Wymagania wobec sceny
- Geometria: plandeka, materac, maszt i agregat jako bryły tam, gdzie się stoi (§7), z wolną drogą od głowicy drabiny do Rena i do torby (graf dachu nie istnieje, więc liczy się tylko kolizja gracza).
- Światło: lampka w obozie jako źródło motywowane (30%), neon jako akcent, mała lampa nad drzwiami zaplecza i stopą drabiny w barwie nawigacji.
- Dźwięk: brzęczenie neonu, wentylator wyciągu, kapanie do wiadra.
- Postać: Ren siedzi albo kuca pod plandeką i wstaje do rozmowy.
- Tekst: Ume i Mori mają mówić o drabinie pawilonu, a nie o windzie (HUD mówi już o drabinie).
- Pomiar: ujęcie nocne z głowicy drabiny do `tools/shots/room-spots.json`, wynik `pnpm shots:palette` w karcie.

## Dług sceny
- Obóz Rena: plandeka między słupkiem tablicy a masztem anteny, materac na paletach, skrzynka jako stolik, lampka kempingowa. Bryły na końcu listy w `packages/sim/src/content/alchemia/pavilion.ts` (§7, nowe id na końcu), drobiazg w nowym `packages/sim/src/content/alchemia/pavilion-roof-dress.ts` (wzór `roof-dress.ts`), rysunek w `packages/engine/src/renderer/alchemia/pavilion-geometry.ts`, modele z nowego skryptu w `tools/blender/` oraz antena i palety z ADR-0096.
- Ren siedzi pod plandeką: plan dnia z jednym przystankiem i czynnością `sit` w `packages/sim/src/content/schedules.ts` (jak `sachiko`).
- Torba Hebi jako model torby zamiast ogólnego pojemnika łupu: widok skrytek w `packages/engine/src/renderer/` (rysunek kontenerów łupu) albo pole widoku w `RoofStash` (`market.ts`, zmiana kontraktu widoku do uzgodnienia z architektem).
- Lampa nad drzwiami zaplecza i stopą drabiny: oprawa w `pavilion-geometry.ts`, światło jak `lampAt` przy wózku Hany w `market.ts`.
- Agregat wyciągu kuchni z wentylatorem i parą: bryła w `pavilion.ts`, para w częściach Alchemii w `packages/engine/src/renderer/alchemia/`, dźwięk wentylatora i neonu jako emitery w `packages/engine/src/audio/` (dziś `room-sound-map.ts` zna tylko wnętrza, potrzebna mapa źródeł na zewnątrz).
- Kałuża przy wpuście i mokra plandeka (§15): rysunek w `pavilion-geometry.ts` (kanał `wet`).
- Tekst: Ume (`packages/narrative/ink/{pl,en}/m0.ink`, `ume.ren_trail`: „Wjeżdża się windą za halą”) i Mori (`m3-echo.ink`, `mori.ren_trail`: „Wjeżdża windą za halą”) mówią o windzie na dach hali, której od etapu 1 nie ma. Propozycja: „Śpi na dachu szklanego pawilonu na rogu. Wchodzi się drabiną od zaplecza”. Komentarz knota `ren_odagiri` w `m3-lustro.ink` mówi jeszcze o „roof terrace”.
- Pomiar §13: ujęcie nocne z głowicy drabiny w `tools/shots/room-spots.json`.
