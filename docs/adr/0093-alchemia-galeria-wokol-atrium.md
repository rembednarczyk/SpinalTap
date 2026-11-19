# ADR-0093: Alchemia jako galeria wokół atrium (plansza 1:1)

Status: Przyjęty (19.11). Decyzja użytkownika z 19.11:
> „przeprowadzisz overhaul alchemii - poprawisz obecne wnętrza o plan referencyjny (tam na screenie masz nowy rozkład sklepów). Dodasz taki margines brył jaki Ci będzie potrzebny, możesz dowolnie go zwiększać, przerobić obecną Alchemię i dowolnie ją powiększyć żeby to wszystko zmieścić. Jeśli coś stoi Ci na drodze przesuwasz to a nie obudowujesz. Prawdopodobnie przód zostawisz jak jest, a reszta to gruntowne zmiany. Ma być jak na projekcie referencji.”

Rekomendowane opcje wybiera agent. Wcześniej w tym samym dniu użytkownik zdecydował o dziedzińcu w dachu z pergolami, lampionami i ławkami. Budżety trójkątów można podnosić, a zieleń bierzemy z modeli gry. Zasady miejsc: `docs/zasady-lokacji.md`. Dotyczy ADR-0074 (Alchemia według planu inwestora, etapy 1–8, B1–B4, C1–C7).

## Kontekst
- Plansza `docs/world/koncepty/alchemia/01-rozbudowa-front.jpg` ma obok widoku od frontu trzy rysunki.
  - **Rzut:** pas sklepów wzdłuż ulicy z pasażem wschód–zachód w środku, dwa skrzydła z dziedzińcem między nimi od tyłu i klatki schodowe w trzonach przy pasażu.
  - **Schemat kondygnacji:** parking pod spodem, nad nim sklepy, pasaże ze sklepami, food hall i zielony dach z otworem. Każda kondygnacja jest pierścieniem wokół jednego atrium.
  - **Aksonometria:** zielone tarasy schodzą od dachu, a skrzydła obejmują atrium.
- Dziś Alchemia jest inna:
  - food hall leży na dnie (T1, −6,4) pod tarasem T0 (−2,2);
  - nad nim stoją pełne bryły szkła A (2,3) i B (6,5), do których nikt nie wchodzi, ze schodami po zewnętrznej ścianie;
  - front od Bajkowskiego (L1–L3, C1–C3) to także pełne bryły z fałszywym wnętrzem.
- Teren spada o ok. 10 m z południa na północ. Poziom −6,4 jest parterem od Świętoduskiej (T1), a −2,2 parterem od Bajkowskiego (T0). Galeria z atrium wykorzystuje ten spadek, bo ma dwa parteru, jak galerie na stoku.

## Wzorzec
- Galeria handlowa z centralnym atrium (mall, „galleria”):
  - sklepy w pierścieniu zewnętrznym;
  - wokół atrium pasaż-galeria z balustradą;
  - schody ruchome parami („scissor”) w atrium;
  - dwa trzony komunikacyjne (klatka i winda) w przeciwległych narożnikach, jako drogi ewakuacyjne;
  - food court na najwyższej kondygnacji jako kotwica, która ciągnie ruch w górę (przyjęta praktyka projektowania galerii).
- Różnice:
  - otwór atrium jest otwarty do nieba, jak na planszy: zielony dach z otworem, bez świetlika;
  - fasada jest szklana z widocznym wnętrzem;
  - gęstość i bieda według `docs/zasady-lokacji.md`, a nie sterylna galeria.

## Decyzja
1. **Korpus** to obrys dzisiejszego food hallu: x 400–436, z 32–58. Kondygnacje:
   - **P0, −6,4:** sklepy i wejście od Świętoduskiej (T1), drzwi do P−1;
   - **P1, −2,2:** sklepy i pasaże, wejścia od Bajkowskiego (T0) i od przejścia pod L2;
   - **P2, 2,3:** sklepy i pasaże;
   - **P3, 6,5:** food hall: stoiska wokół atrium i stoliki;
   - **dach, 10,7:** zielony dach na poziomie dachu L3 frontu, z otworem nad atrium, pergolami z lampionami, ławkami, ścieżkami i drzewami z gry.
2. **Atrium:** x 411–425, z 40–50, otwarte od posadzki P0 do nieba. Na środku posadzki P0 stoi punkt orientacyjny (fontanna z hologramem albo kiosk). Wokół atrium na P1–P3 biegnie galeria szeroka na 3 m z bryłową balustradą szklaną 1,1 m.
3. **Trzony:**
   - **SW:** dzisiejsze schody hali i winda, przedłużone do dachu. Winda obsługuje −9,2, −6,4, −2,2, 2,3, 6,5 i 10,7, a schody biegną zakosami w trzonie.
   - **NE:** x 428–436, z 52–58, nowa klatka zakosami i druga winda, od P0 do dachu.
   - Schody ruchome w parach przy południowej krawędzi atrium, P0↔P1↔P2↔P3.
4. **Sklepy** stoją w pierścieniu zewnętrznym na P0–P2: pasy po 7–8 m od wschodu i zachodu, 4–5 m od północy i południa.
   - Każdy sklep ma witrynę od galerii, ścianki działowe, zaplecze i trzy warstwy (`docs/zasady-lokacji.md` §2).
   - Szyldy to nazwy własne.
   - Sklepy dostają mieszkańców z tłumu (ADR-0060).
5. **Food hall przenosi się na P3.** Jednostki z imionami i sprzedawcami (Fumiko, Kenta, Goro, Oyaji i inni) przenosimy z ich ladami, a nie obudowujemy.
   - Okienko Fumiko od T1 zostaje okienkiem jej drugiego lokalu na P0. Zadania i dialogi, które go dotyczą, idą za nią.
   - Dawna hala na P0 staje się kondygnacją sklepów z wejściem od T1.
6. **Usunięte:** kondygnacje A i B z dziedzińcem, zewnętrzne schody A i B, taras T0 nad halą z donicami.
   - Taras T0 zostaje tylko jako pas od P−1 po stronie południowej (z 30–32) z klatką P−1 i kioskiem windy.
   - Z dzisiejszych tarasów zostaje widok: zielony dach i balkony galerii.
7. **Fasada korpusu:**
   - szkło na każdej kondygnacji jako cienkie bryły symulacji, rysowane tylko ramami, więc przez nie widać prawdziwe wnętrze;
   - płyty z belką i pasem LED;
   - zaokrąglone narożniki zewnętrzne (C1) i zasłony zieleni (C2).
8. **Front od Bajkowskiego zostaje** (L1–L3, budynek z arkadami C3, plac). Jego wnętrza łączy z galerią etap O5.
9. **Budżety:** trójkąty bez sztywnego limitu (decyzja z 19.11). Bramką są wywołania rysowania i aktywne siatki scen `npr-perf`, a wnętrza mają przesłanianie jak P−1 i P−2 (`AlchemiaUndergroundCull`).
10. **Zapis:** pozycje gracza w usuniętych bryłach (A, B) przy wczytaniu trafiają na najbliższy węzeł grafu. Jeśli schemat zapisu się zmienia, wymaga to migracji.

## Etapy (osobne PR-y)
- **O1, szkielet:**
  - kondygnacje P1–P3 i dach jako płyty z otworem atrium;
  - fasada z ram, galerie z balustradami, oba trzony ze schodami i windami, schody ruchome;
  - usunięcie A i B oraz zewnętrznych schodów;
  - graf poziomów (każda kondygnacja osiągalna z T1, T0 i P−1), przesłanianie, testy dróg i budżetów.
- **O2, sklepy P0–P2:** witryny, ścianki, zaplecza, szyldy, trzy warstwy wnętrz, tłum.
- **O3, food hall na P3:** przeniesienie jednostek, sprzedawców, lad i tłumu oraz drugiego lokalu Fumiko na P0.
- **O4, zielony dach:** otwór nad atrium, pergole z lampionami, ławki, ścieżki, trawniki, drzewa i krzewy z gry, wyjścia trzonów.
- **O5, front połączony z galerią:** wnętrza L1–L3 jako prawdziwe kondygnacje pasażu.
- **O6, parking jak na schemacie:** pierścień P−1 wokół szybu atrium (do decyzji po O5).

## Konsekwencje
- Graf, punkty tłumu, zadania i dialogi związane z halą zmieniają się w O1 i O3. Testy tras i zadań idą za nimi.
- Złote hashe podłogi testowej się nie zmieniają (to inny świat). Identyfikatory brył Alchemii zmieniają się w O1, świadomie, z opisem w commicie.
- Topografia: wpis T dla korpusu (wysokość do 10,7, otwór atrium) i przegląd kuratora w O1.
