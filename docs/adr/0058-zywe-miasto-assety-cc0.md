# ADR-0058: Żywe miasto: rekwizyty, pojazdy i szyldy z paczek CC0

## Kontekst
Użytkownik chce, żeby nocny Lublin był gęstszy i bardziej kolorowy, z dużo większą liczbą assetów pobranych z internetu. Dziś miasto ma:
- budynki i auta z city kitu (ADR-0022);
- meble uliczne z ADR-0050, w większości proceduralne;
- nadbudowy, kable i reklamy z ADR-0051, też proceduralne.

Rozpoznanie (31.10) pobrało 33 paczki CC0, razem ok. 2 tys. modeli:
- Kenney przez wpisy na OpenGameArt: Roads, Modular Buildings, Retro Urban, Mini Market, Factory, Survival, Food, Train, Industrial, Suburban, Nature, Car Kit;
- Quaternius: Cyberpunk Game Kit, Zombie Apocalypse, Toon Shooter, Sushi Restaurant, Public Transport, Cars, Posed Humans, Modular Men/Women;
- pojedyncze paczki z OpenGameArt: automaty, bankomaty, motorower, billboard, pojazdy;
- decale z ambientCG: graffiti, wlepki, tabliczki.

Modele są low-poly i mają kolory w palecie albo w płaskich materiałach, czyli tak jak obecny kit. Wymagania:
- budżety wywołań rysowania i aktywnych siatek (`tools/perf-budgets.json`);
- telefon;
- migawka NPR;
- determinizm symulacji (ADR-0008).

## Decyzja
- **Tylko CC0.**
  - Każde źródło ma w `packages/app/public/city/README.md` wiersz z URL-em pobrania, autorem i cytatem licencji z paczki albo strony.
  - Paczki na innych licencjach (CC-BY, płatne) i modele z cudzym brandingiem odpadają. Wyjątek: napis da się wyciąć, a bierzemy samą geometrię.
  - Zipy źródłowe nie trafiają do repo. `tools/assets/sources.json` trzyma URL i sha256 każdej paczki, a skrypt `tools/assets/fetch.mjs` je pobiera, dzięki czemu wynik da się odtworzyć.
- **Osobny plik `city-props.glb`.**
  - Piecze go `tools/city_kit.py` z nowymi wejściami: `--props` (Kenney GLB z `colormap.png`) i `--quaternius` (glTF z płaskimi materiałami).
  - Paczki z atlasem lub teksturami pikselowymi przechodzą przez uśredniony kolor teksela trójkąta. OBJ/MTL czyta prosty czytnik, a FBX jest wcześniej konwertowany offline do GLB.
  - Paleta próbek jest wspólna z kitem (ADR-0022). Dochodzą role `fabric-teal`, `fabric-magenta`, `fabric-amber` (markizy, noreny, płótna) i `plant`.
  - Każdy model to jedna siatka z kluczem (`pr-*`, `veh-*`), frontem na +Z, w metrach i z `extras.size`.
  - City kit dalej ładuje się pierwszy. Rekwizyty dochodzą po nim i są osobnym etapem ekranu ładowania (ADR-0057).
- **Bez nowych wywołań rysowania.**
  - Rekwizyty piecze się do istniejących siatek:
    - meble i drobiazgi do siatki bloku 256 m (ADR-0050);
    - elementy fasad (klimatyzatory, anteny, markizy, rury, balkony, szyldy) do komórek kitu 64 m i komórek mapcity (ADR-0051);
    - pojazdy do wspólnych siatek ruchu i parkingu.
  - Jedyny wyjątek to drony nad ulicą: jedna wspólna, ruchoma siatka, +1 wywołanie (+2 z G-buforem).
  - Na sztukę do ok. 1,5 tys. trójkątów; cięższe modele upraszczamy albo pomijamy.
  - Drobiazgi (jedzenie, puszki, worki) trafiają tylko do bliskiej siatki bloku i nie pojawiają się na jakości `low`.
- **Rozstawienie w rendererze.**
  - Rekwizyty bez kolizji (drobiazgi, fasady, szyldy, rośliny w donicach przy ścianie) stawia renderer. Robi to deterministycznie, z ziarna pozycji i z danych dzielnicy (`clutter`, rodzaj ulicy), jak meble z ADR-0050. Symulacja i złote hashe się nie zmieniają.
  - Rzeczy, o które gracz może się potknąć lub schować (automaty, lady, kontenery), stoją tylko tam, gdzie `sim` ma już bryłę mebla albo straganu. Nowe bryły w `sim` to osobna zmiana, ze świadomą aktualizacją hasha.
  - Charakter dzielnic:
    - deptak Krakowskie: automaty, bankomaty, donice z bambusem i sakurą, markizy w pasy, szyldy-flagi, ekrany nad barami, skutery i rowery przy krawężniku, budki yatai z norenami i lampionami;
    - targ pod wiaduktem (Podzamcze): lady, palety, beczki, kartony, płócienne zadaszenia, graffiti na filarach;
    - Nabrzeże: kontenery, zbiorniki, wieże ciśnień, rury, ciężarówki;
    - dachy i nadbudowy: klimatyzatory, anteny i czasze, panele, zbiorniki, rusztowania, schody przeciwpożarowe;
    - Rynek i Stare Miasto: oszczędnie, czyli donice, ławki i latarnie, bez neonów i kabli.
- **Szyldy z teksturą** (Quaternius Cyberpunk, Sushi).
  - Obraz szyldu przechodzi do atlasu napisów pod paletą, a UV szyldu wskazuje kafel atlasu. Glow czyta go przez `emissiveTexture` (ADR-0022).
  - Napisy są generyczne, bez prawdziwych marek.
- **Etapy (osobne PR-y), w każdym pomiar budżetów, migawka NPR obejrzana przed commitem i wpis źródeł:**
  1. Potok: `sources.json`, `fetch.mjs`, wejścia `--props` i `--quaternius`, plik `city-props.glb` i jego ładowanie. Pierwsze rekwizyty fasad: klimatyzatory, anteny i czasze, rury, markizy.
  2. Meble deptaka: automaty, bankomaty, hydranty, donice i rośliny, skutery i rowery.
  3. Targ i budki z jedzeniem: lady, stołki, noreny, lampiony, palety, beczki, kartony, płótna, drobiazgi na ladach.
  4. Pojazdy: ciężarówki, śmieciarka, SUV-y, tramwaj lub trolejbus z autobusu, dalekie LOD-y.
  5. Szyldy z teksturą i ekrany na wysięgnikach (atlas).
  6. Decale: graffiti, wlepki, tabliczki, kratki ściekowe.
  7. Drony nad kanionami ulic.
  8. Tłum: statyczne pozy (Posed Humans) na ławkach i w kolejkach. Riggowane Modular Men/Women tylko dla nazwanych NPC, bo bez LOD są za ciężkie na wspólną siatkę tłumu.
  9. **Drzwi automatyczne i rozsuwane** (dodane 31.10): modele skrzydeł, ram, paneli z kodem i podświetlenia zamiast proceduralnych skrzydeł z ADR-0038, dla kliniki, Neon Koi, biura Tessen i kolejnych wnętrz.
     - Źródła CC0, np. `Door` z Quaternius Cyberpunk Game Kit (pobrany, 324 trójkąty) i elementy sci-fi z paczek Kenneya.
     - Warianty: przeszklone dwuskrzydłowe drzwi sklepu, stalowe drzwi pancerne na kod, roleta.
     - Model pasuje do istniejącej bryły kolizji skrzydła, a renderer tylko podmienia wygląd. Ruch dalej idzie przez `updateTransform` z `door-system.ts`, więc symulacja się nie zmienia.
     - Stan zamka widać po kolorze diody panelu (zamknięte, otwarte, wyłamane).
     - Do tego dźwięk otwierania z ADR-0060.

## Konsekwencje
- Miasto będzie gęstsze i bardziej kolorowe bez nowych wywołań rysowania (poza dronami). Rośnie liczba trójkątów i wierzchołków w siatkach bloków i komórek, co mierzy `npr-perf` na scenach Lublina i telefonie.
- Plik rekwizytów to szacunkowo 1–1,5 MB po kwantyzacji. Ekran ładowania pokazuje go jako osobny etap.
- Migawka NPR zmienia się na każdym etapie, świadomie.
- Brakuje w CC0: hulajnóg, trolejbusu i parasoli ogródkowych w lekkiej wersji. Trolejbus powstaje z autobusu i proceduralnych odbieraków, parasole z płótna Survival Kit. Cięższe paczki (Downtown City MegaKit 223 MB, loafbrr Park Furniture 88 MB) są do ręcznego pobrania później.
