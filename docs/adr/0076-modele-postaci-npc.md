# ADR-0076: Modele postaci NPC: obsada nazwanych, pula tła i warianty

Status: Zaakceptowany (7.11, decyzje użytkownika w sekcji „Decyzje użytkownika”). Wynika z prośby użytkownika z 7.11 (backlog, sekcja „Następne”: „Podmiana wszystkich NPC na modele z assetów i różnorodność”). Dotyczy ADR-0058 (assety CC0, etap 8: tłum w pozach), ADR-0063 (licencje, ekran „Autorzy”), ADR-0057 (ekran ładowania i wczytywanie modeli) i ADR-0031 (podział renderera). Stan kodu: `origin/main` b8ffc81. G-474 (czarny Kaito) ma osobny PR na gałęzi `ccr-ec2c4269-ilh8k8-g474`.

## Kontekst

**Jak jest dziś.**
- Obsada to pięć plików VRM w `packages/app/public/models` (próbki VRoid z OpenGameArt, „VRoid Studio CC0 models”), razem 31,3 MiB (rozmiary w MiB):

  | Plik | Źródło | Baza VRoid | Rola w `manifest.json` | Kto go nosi |
  |---|---|---|---|---|
  | `seki.vrm` (6,7) | AvatarSample_D | kobieca (F00) | `heroine` | Seki |
  | `kaito.vrm` (7,7) | Sakurada Fumiriya | męska (M00) | `fixer` | Kaito **i Kurosawa** (`preset: "fixer"`) |
  | `mori.vrm` (5,5) | AvatarSample_F (Vita) | **kobieca** (F00) | `ripperdoc` | Mori (mężczyzna w dialogach) |
  | `civilian.vrm` (6,0) | Sendagaya Shino | kobieca (F00), nastolatka | `civilian` | Ume, Oyaji, Hana, Genzō, Ren, Fumiko, Kenta, Goro, Sachiko, sprzedawcy, przechodnie z symulacji |
  | `ganger.vrm` (5,4) | Base_Male | męska (M00) | `ganger` | Hebi i ochrona Tessen (`corpo`) |

- Renderer wybiera model tylko z rodzaju widoku: `ViewDescriptor` NPC ma `preset: "fixer" | "civilian" | "ripperdoc"`, wróg `preset: "ganger" | "corpo"` (`packages/core/src/ports/types.ts`), a `modelKeyOf` w `character-views.ts` mapuje to na pięć kluczy `CharacterModelKey`. Widok nie wie, kim jest postać, więc babcia Ume, Oyaji i Ren to ta sama dziewczyna.
- Tłum chodników (`kind: "crowd"`, ADR-0041) i postacie w pozach (ADR-0058 etap 8) są proceduralne albo pieczone do siatki bloku; mają już deterministyczny wygląd z ziarna (`crowd-look.ts`: płeć, wzrost, fryzura, kolory skóry, włosów i ubrań). Tego ADR-u nie dotyczą, poza wspólną paletą.
- Modele VRM są wczytywane raz na plik (`ModelLibrary`), instancje mają własny szkielet i pulę po zwolnieniu (`CharacterModels`). Ekran ładowania wczytuje wszystkie pliki manifestu (`preload`, ADR-0057). Retarget (`model-rig.ts`) zna nazwy kości VRoid, Mixamo i Blendera; spring bones czyta z rozszerzenia VRM (`vrm-meta.ts`). Odcień ubrań z przebrania (ADR-0036) przemalowuje materiały `Tops` i `Bottoms` (`loadout.ts`).
- Budżet `e2e/models.spec.ts`: 495 wywołań rysowania przy 12 ubranych postaciach (pomiar 480 i 483).
- Pamięć: plik VRM to 5,4–7,7 MB, z czego PNG 3,9–5,0 MB. Po zdekodowaniu tekstury jednego modelu zajmują ok. 60–71 MiB pamięci GPU (RGBA8 z mipmapami, liczone z wymiarów tekstur w plikach, 7.11), z czego ok. jedną trzecią biorą mapy normalnych, których shader toon nie czyta. Pięć modeli to ok. 330 MiB.

**Kto jest kim w dialogach** (`packages/narrative/ink/en`, obsada głosów w ADR-0060):

| Postać | Płeć | Wiek i wygląd z tekstu | Gdzie stoi | Dziś |
|---|---|---|---|---|
| Kaito | M | dorosły, „weathered” (głos), fixer w barze Neon Koi | Neon Koi | `kaito.vrm` |
| Mori | M | dorosły, ripperdoc („he”, „Mori's chair”) | klinika | `mori.vrm` (kobieta) |
| Ume | K | stara („Grandma Ume”, „at my age the night's too long”) | ulica przy Koi | `civilian.vrm` |
| Hana | K | młoda, handlarka części z wózka, zleceniodawczyni | targ | `civilian.vrm` |
| Genzō | M | starszy, przewoźnik łodzi na Bystrzycy (głos „Gravel Midnight”) | doki | `civilian.vrm` |
| Ren Odagiri | M | młody („Hebi boy”, „skinny boy”), tatuaż węża Hebi na karku, nieogolony | dach Alchemii | `civilian.vrm` |
| Kurosawa | M | dorosły, człowiek Kagami, chłodny | za Alchemią | `kaito.vrm` |
| Fumiko | K | dorosła, prowadzi ramen 16–4 | Alchemia | `civilian.vrm` |
| Kenta | M | dorosły, smaży okonomiyaki | Alchemia | `civilian.vrm` |
| Goro | M | starszy (30 lat handlu obok Oyajiego), parasole | Alchemia | `civilian.vrm` |
| Oyaji | M | stary („the old man”, 30 lat na targu), naprawia | targ | `civilian.vrm` |
| Sachiko | K | dorosła albo starsza („sweetheart”), kiosk z gazetami | Alchemia | `civilian.vrm` |

W ink mówią też postacie drugiego planu z kilkoma kwestiami: Tetsu, Hideo, Sabu, Mei, Hina, Takumi, Shiro, Tomo, Nobu, Koji, Daigo, Yuki, Riko, Kiku i strażnicy Tessen.

## Inwentarz modeli postaci

Pliki z paczek leżą poza repo (scratchpad sesji, `tools/assets/fetch.mjs` pobiera je ponownie); sprawdzone skryptem bez wykonywania ich treści.

| Źródło | Licencja | Co zawiera | Szkielet i animacje | Rozmiar i trójkąty | Uwagi |
|---|---|---|---|---|---|
| VRoid Studio CC0 models (OpenGameArt, użyte 5) | VRoid Hub 1.0 w metadanych, strona OGA: CC0 | AvatarSample_D, F, Sakurada Fumiriya, Sendagaya Shino, Base_Male | VRM 0.x, kości `J_Bip_*`, spring bones, bez animacji (retarget z riga) | 5,4–7,7 MB po `shrink_glb`, 15–40 tys. tr. | styl anime jak Seki; dziś w grze |
| VRoid Studio CC0 models, **jeszcze nieużyte** | jak wyżej | AvatarSample_D_Darkness (17,2 MB zip), AvatarSample_E (15 MB), AvatarSample_G (12,2 MB), Base_Female (13,1 MB), HairSample_Female (14,3 MB), HairSample_Male (15,5 MB) | jak wyżej | po `shrink_glb` ok. 5–8 MB każdy | sześć dalszych twarzy w stylu obsady; większość to młode postacie anime, brak starszych |
| Quaternius Ultimate Modular Men (`quaternius-modular-men`) | CC0 (`License.txt`) | 11 postaci: Adventurer, Beach, Casual_2, Casual_Hoodie, Farmer, King, Punk, Spacesuit, Suit, Swat, Worker | glTF, 62 kości (`Hips`, `UpperArm.L`…), 24 animacje (Idle, Walk, Run, Death, Gun_Shoot, Punch, Interact, Wave…) | 2,9–3,7 MB glTF z base64 (ok. 2,2–2,8 MB jako GLB), 5,2–11,1 tys. tr. | bez tekstur: 5–11 materiałów o płaskich kolorach (Skin, Hair, Suit…), więc warianty to zmiana koloru materiału; COLOR_0 biały |
| Quaternius Ultimate Modular Women (`quaternius-modular-women`) | CC0 | 10 postaci: Adventurer, Casual, Formal, Medieval, Punk, SciFi, Soldier, Suit, Witch, Worker | jak wyżej | 3,0–3,3 MB glTF, 6,1–8,0 tys. tr. | jak wyżej |
| Quaternius Zombie Apocalypse (`quaternius-zombie-kit`, w `sources.json`) | CC0 | ocaleni Lis (K), Matt, Sam, Shaun (M), wersje z jedną bronią; zombie, pies, mops | glTF, 43 kości, 20 animacji | 1,7–2,9 MB, 8,9–28 tys. tr. | jedna tekstura atlasu na postać; styl low-poly |
| Quaternius Cyberpunk Game Kit (`sources.json`) | CC0 | jeden bohater, roboty-wrogowie | 25 kości, 22 animacje | 1,5 MB, 7,5 tys. tr. | bohater w stroju sci-fi, roboty jako tło |
| Quaternius Background Posed Humans (w grze, ADR-0058 etap 8) | CC0 | mężczyzna i kobieta w pozach, fryzury | bez szkieletu (OBJ) | 1,1 tys. tr. | tylko tło nieruchome, zostaje |
| Paczki użytkownika (`assets2`, Sketchfab, CC-BY 4.0, ADR-0063) | CC-BY 4.0 | rekwizyty, `cyberpunk_robot` | — | — | brak postaci ludzkich |
| Quaternius, do pobrania: Ultimate Animated Character Pack, Animated Men/Women Pack, Universal Animation Library | CC0 (strony paczek, 7.11) | 52 postacie / po 4 / 120+ animacji na wspólnym szkielecie | FBX, OBJ, Blend (glTF tylko w części paczek) | — | potrzebny konwerter FBX→glTF w `tools` (Blender) |
| Kenney Animated Characters (Protagonists, Retro…) | CC0 (strona paczki, 7.11) | postacie blokowe ze skórkami | wspólny szkielet | małe | styl blokowy, za daleko od obsady |

Inne źródła odpadają: modele z VRoid Hub z innymi warunkami niż próbki (każdy model ma własną licencję, często bez redystrybucji), Mixamo (licencja Adobe zakazuje redystrybucji samych modeli), CC-BY-SA i NC (ADR-0063).

**Wniosek.** W stylu obecnej obsady (anime, VRoid) zostało sześć nieużytych próbek, za mało na 12 nazwanych postaci, a starszych (Ume, Oyaji, Goro, Genzō) wśród nich nie ma. Quaternius daje 21 riggowanych postaci CC0 z animacjami, lekkich (5–11 tys. trójkątów, bez tekstur, więc ułamek pamięci GPU modelu VRoid), ale w innym stylu (stylizowane low-poly, płaskie kolory zamiast rysunku anime). Trzecia droga to postacie zrobione w VRoid Studio na bazach Base_Male i Base_Female: prawa do wyniku ma według warunków VRoid Studio jego autor, więc nie trzeba licencji z zewnątrz, ale wymaga pracy ręcznej w programie z interfejsem graficznym.

## Decyzje użytkownika (7.11)
Nadrzędny cel: **maksymalna różnorodność** postaci przy jednym, spójnym stylu.
1. **Postacie nazwane: spójny styl VRoid.** Bez mieszania z low-poly w jednej scenie. Teraz A (próbki VRoid: sześć nieużytych i obecne, z wariantami), a B (postacie z VRoid Studio) wchodzi plik po pliku, gdy takie pliki się pojawią; manifest obsady przyjmie je bez zmian w kodzie.
2. **Pula tła: warianty obecnych modeli albo inne modele.** Etap 2 robi warianty VRoid; inne źródła (w tym nowe próbki VRoid, a Quaternius tylko tam, gdzie nie psuje spójności, np. na telefonie po pomiarze) są dozwolone w etapie 4.
3. **Mori: poprawić** w etapie 2 na model męski (baza M00) z fartuchem i okularami.
4. **Kurosawa: osobny model** w etapie 3 (do tego czasu wariant zapasowy różny od Kaito).
5. **Rozmiar: zgoda** na obsadę do 80 MiB i wczytywanie postaci w tle.
6. **Drugi plan: wszyscy dostają własny wygląd.** Każda postać z ink (Tetsu, Mei, Shiro i inne) ma własny wpis w `cast`: osobny plik, gdy jest dostępny, inaczej unikalna, stała kombinacja bazy, fryzury, kolorów, tekstur ubrań i akcesoriów, której nie dzieli z nikim innym. Test pilnuje, że żadne dwie postacie nazwane nie mają tego samego wyglądu.

## Decyzja

### 1. Tożsamość postaci w widoku (zmiana kontraktu, Architekt)
- `ViewDescriptor` NPC i wroga dostaje dwa opcjonalne pola: `cast?: CastKey` (klucz postaci nazwanej, np. `"ume"`, `"kurosawa"`; typ w `core`, lista z treści) i `look?: number` (ziarno wyglądu postaci tła). `preset` zostaje jako rola zachowania i zapasowy wygląd.
- Symulacja wypełnia `cast` z klucza spawnu postaci nazwanej (`ActorDef.spawn.key`) przez tabelę w treści `sim`, a `look` z hasha klucza spawnu (postacie treści) albo z ziarna mieszkańca (przechodnie symulacji), więc jest stały między zapisami; bez `Math.random`. Zapis gry, symulacja i złote hashe bez zmian: to pole widoku, nie stan.
- Renderer: `modelKeyOf` wybiera model po `cast`, potem po puli dla roli i `look`, na końcu po `preset`.

### 2. Manifest obsady
- `manifest.json` dostaje sekcje `cast` (klucz postaci → plik, skala, wariant) i `pools` (rola tła → lista plików z wagami): `civilian`, `vendor`, `ganger`, `corpo`. Stare klucze (`heroine`, `fixer`, `civilian`, `ripperdoc`, `ganger`) zostają jako zapas, więc brak pliku zostawia dzisiejszy wygląd. `parseModelManifest` odrzuca nieznane klucze jak dziś.
- Postacie drugiego planu z ink (Tetsu, Mei, Shiro…) biorą model z puli swojej roli ze stałym `look` z klucza, więc wyglądają zawsze tak samo, choć nie mają własnego pliku.

### 3. Warianty z jednego modelu
- **VRoid:** modele na tej samej bazie (F00 albo M00) mają ten sam układ UV ubrań (`*_Tops_01`, `*_Bottoms_01`, `*_Shoes_01`, tekstury Seki i Kaito różnią się tylko kolorem), więc wariant to: odcień tekstury ubrań (ścieżka `tint` z `loadout.ts`, dziś dla przebrań), odcień włosów (materiały `HAIR` mają kolor bazowy mnożony przez szarą teksturę: wystarczy zmienić kolor), odcień skóry (mnożnik na materiałach `SKIN`) i podmiana tekstury góry albo spodni na teksturę innego modelu tej samej bazy.
- **Quaternius:** materiały są płaskimi kolorami z nazwami (`Skin`, `Hair`, `Eyebrows`, `Suit`, `Tie`, `Worker_Vest`, `Purple`, `LightBlue`…), więc wariant to tabela nazwa materiału → rola (skóra, włosy, góra, dół, buty) → paleta, spisana raz na plik. Kolory bazowe w plikach są liniowe i bardzo ciemne (np. `Suit` 0,02): loader musi je przeliczyć do przestrzeni, w której shader toon czyta kolor, inaczej wróci czarna sylwetka jak w G-474. Test z G-474 (`model-cast-colours.test.ts`) obejmie nowe pliki.
- **Akcesoria:** doczepki na kościach głowy i klatki jak w `garment-addons.ts` (dziś wizjer, hełm i płyta kamizelki z ADR-0036), z nowymi prostymi bryłami (okulary, czapka, torba, maska), wybierane z `look`.
- **Determinizm:** wariant liczy renderer z `look` (jak `crowdLook`, mulberry32, bez innych źródeł losowości). Palety skóry, włosów i ubrań wspólne z `crowd-look.ts`, żeby tło i tłum pasowały do siebie.
- **Koszt:** odcień to osobny materiał toon na wariant (klucz w pamięci podręcznej materiałów), więc wywołania rysowania się nie zmieniają, a liczba materiałów i shaderów rośnie z liczbą wariantów na ekranie. Limit: 4 warianty na plik naraz w kadrze, dalsze postacie dzielą najbliższy.

### 4. Pamięć i rozmiar (telefon)
- Ładowanie: ekran ładowania wczytuje tylko obsadę startu (Seki i postacie w promieniu dzielnicy startu); reszta w tle przy wejściu w promień 120 m od postaci (strumień jak miasto), a zwolniona pula po wyjściu z dzielnicy. Do czasu wczytania postać stoi w modelu zapasowym roli, bez przerwy w grze.
- Pamięć GPU: po konwersji materiałów loader zwalnia tekstury, których shader toon nie czyta (mapy normalnych, matcapy): ok. −1/3 na model. Tekstury tła 512 px zamiast 1024 px (`shrink_glb.py` z osobnym rozmiarem), postacie nazwane 1024 px.
- Limity naraz (do potwierdzenia pomiarem w etapie 1): komputer do 12 różnych plików VRoid w pamięci (ok. 500 MiB tekstur po zwolnieniu normalnych), telefon (`low`) do 6 plików VRoid albo dowolnie wiele plików Quaternius (bez tekstur, ok. 2 MiB na plik); ponad limit najdawniej użyty plik bez instancji na scenie jest zwalniany.
- Rozmiar paczki: każdy nowy VRoid ok. 5–8 MB, Quaternius szacunkowo 0,6–1 MB jako GLB po wycięciu zbędnych animacji (do sprawdzenia w etapie 4). Cel: obsada razem do 80 MiB (dziś 31,3 MiB). `shrink_glb.py` dostaje usuwanie COLOR_0 z VRM (G-474: zbędne 0,5 MB w `kaito.vrm`) i nieużywanych obrazów (miniatura `Thumbnail` 0,8 MB na plik).

### 5. Wywołania rysowania i siatki
- Bramka `npr-perf` i `models.spec` bez podnoszenia budżetów: model VRoid to 10–15 wywołań (materiał na wywołanie po scaleniu prymitywów), Quaternius 4–11. Pula tła z Quaterniusa obniża koszt sceny z wieloma sprzedawcami; postacie nazwane z VRoid kosztują jak dziś.
- Retarget: aliasy kości Quaterniusa (`Wrist.L` jako dłoń, `UpperLeg.L`, `LowerLeg.L`) dopisane w `model-rig.ts` z testem na pliku; animacje z pliku nie są odtwarzane (rig gry jest źródłem ruchu, jak dla VRM).
- Spring bones tylko dla VRM; Quaternius bez wtórnego ruchu.

### 6. Licencje
- Każdy nowy plik: wiersz w `models/README.md` (plik, źródło z linkiem, autor, licencja, zmiany), źródło z sha256 w `tools/assets/sources.json` i wpis na ekranie „Autorzy” (`packages/ui/src/credits/credits.ts`, sekcja `characters`); test `credits.test.ts` pilnuje, że każdy plik w `public/models` ma wpis.
- Próbki VRoid zostają pod licencją `VRoid-Hub-1.0` (metadane plików), z odnośnikiem do strony OGA (CC0) i warunków VRoid; postacie z VRoid Studio zrobione przez użytkownika: licencja użytkownika zapisana w metadanych VRM i README.

## Etapy (osobne PR-y)
0. **G-474** (osobny PR, gotowy): loader zdejmuje kolory wierzchołków z VRM, test na każdym pliku manifestu.
1. **Kontrakt i manifest:** `cast` i `look` w `ViewDescriptor`, tabela obsady w `sim`, sekcje `cast` i `pools` w manifeście, zapas na dzisiejsze klucze; pomiar pamięci GPU i budżetów przed zmianą modeli; zwalnianie nieczytanych tekstur. Bez nowych plików.
2. **Warianty:** odcienie skóry, włosów i ubrań z `look` na obecnych pięciu modelach i akcesoria; od razu różni sprzedawcy i przechodnie. Migawka NPR świadomie.
3. **Postacie nazwane:** pliki według wyboru użytkownika (pytanie 1), po jednym albo dwóch na PR, ze zrzutami z dialogu i z ulicy.
4. **Pula tła:** cywile, sprzedawcy tła, gangerzy Hebi, ochrona Tessen, wczytywanie w tle według dzielnic, limity na telefonie.
5. **Porządki:** `shrink_glb.py` (COLOR_0, miniatury, tekstury 512 px tła), pomiar rozmiaru paczki i pamięci na telefonie.

## Pytania do użytkownika
1. **Skąd modele postaci nazwanych?**
   - A: tylko próbki VRoid (sześć nieużytych + obecne), z wariantami kolorów i fryzur; spójny styl, ale starsze postacie (Ume, Oyaji, Goro, Genzō) dalej wyglądają młodo.
   - B: postacie zrobione w VRoid Studio na bazach Base_Male i Base_Female, według opisów z dialogów (wiek, sylwetka, ubiór); spójny styl i zgodność z opisami, wymaga pracy w programie (użytkownik albo osoba z zewnątrz) i zgody na licencję autora.
   - C: mieszane źródła (VRoid dla głównych: Kaito, Mori, Ren, Hana, Kurosawa; Quaternius dla sprzedawców: Ume, Oyaji, Goro, Sachiko, Fumiko, Kenta, Genzō), bliżej opisów wiekiem i ubiorem, kosztem dwóch stylów w jednej scenie (anime obok low-poly).
   - Propozycja: B dla dwunastu nazwanych, A jako zapas do czasu, aż będą gotowe.
2. **Pula tła:** A: warianty pięciu obecnych modeli VRoid (spójnie, cięższe na telefonie); B: Quaternius Modular Men/Women z paletą (lżejsze, inny styl); C: VRoid na komputerze, Quaternius na telefonie. Propozycja: A w etapie 2, decyzja o B po pomiarze w etapie 1.
3. **Mori jako mężczyzna:** dziś nosi model kobiety (AvatarSample_F). Zmienić od razu w etapie 2 na wariant `ganger.vrm` (Base_Male) w fartuchu i okularach, czy czekać na etap 3?
4. **Kurosawa** dzieli dziś model z Kaito: osobny model w etapie 3 czy wariant `kaito.vrm` (inne kolory, garnitur) już w etapie 2?
5. **Rozmiar gry:** zgoda na obsadę do 80 MiB (dziś 31,3 MiB) i wczytywanie postaci w tle, czy trzymać się dzisiejszego rozmiaru (warianty zamiast nowych plików)?
6. **Postacie drugiego planu** (Tetsu, Mei, Shiro i inne): stały wariant z puli wystarczy, czy któraś ma dostać własny model?

## Konsekwencje
- Zmiana kontraktu `ViewDescriptor` (dwa pola opcjonalne) wymaga zgody Architekta; symulacja, zapis i złote hashe bez zmian.
- Więcej materiałów toon (warianty) i plików do wczytania; budżety pilnują wywołań i siatek, pamięć mierzy nowy pomiar w `npr-perf` (liczba i rozmiar tekstur).
- Migawka NPR zmienia się w etapach 2–4; każda zmiana obejrzana i opisana w commicie.
- Każdy nowy model przechodzi test z G-474 (kolor bazowy nie czarny, tekstura, bez koloru wierzchołków na VRM).
