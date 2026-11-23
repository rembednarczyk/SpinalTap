# ADR-0101: Sprzedawcy Alchemii jako postacie z luźną rozmową

Status: Przyjęty (23.11, polecenie użytkownika: „Możliwe są luźne interakcje z każdym sprzedawcą. Napisz i zastosuj scenariusze. Każdy sprzedawca dostaje model.”). Zmienia ADR-0093 w punkcie o sprzedawcach jako nieruchomych figurach. Etap 1 w tym PR, etap 2 osobno.

## Kontekst
- ADR-0093 (O2, O5) postawił w każdym otwartym sklepie galerii i frontu figurę sprzedawcy: model `figure` z `crowd-props.glb`, wypieczony w siatkę mebli. Nie kosztuje wywołań rysowania, ale nie da się z nim rozmawiać. Lady food hallu bez postaci fabularnej (KAWA, THAI, GYROS, WOK) nie miały nikogo.
- Rozmawiać i handlować można było tylko z postaciami fabuły: Mori, Oyaji, Fumiko, Sachiko, Kenta, Goro i barmanem Neon Koi.
- Pełna postać (NPC z modelem VRM i szkieletem) kosztuje kilka siatek w każdym przebiegu. Silnik rysuje postać do 60 m bez względu na ściany i stropy (ADR-0040), więc w galerii widać by było naraz wszystkich 44 sprzedawców.

## Wzorzec
- **Barki i luźne rozmowy z NPC.** System odpowiedzi Left 4 Dead i Team Fortress 2 (Elan Ruskin, „AI-driven Dynamic Dialog through Fuzzy Pattern Matching”, GDC 2012): kwestia wybierana regułami z kontekstu (kto, gdzie, kiedy, co już padło). Do tego sprzedawcy w Cyberpunk 2077 i sklepikarze w serii Yakuza: krótkie powitanie zależne od sytuacji, kilka zdań o towarze i okolicy, potem handel albo pożegnanie.
- **Wybór wariantu deterministycznym ziarnem.** Wariant zależy od identyfikatora miejsca, a nie od losowania w chwili rozmowy, tak jak rozstawienie w `docs/zasady-lokacji.md` §5.
- **LOD postaci z histerezą.** Dyskretne poziomy szczegółu (Luebke i in., „Level of Detail for 3D Graphics”, 2002). Do tego tłum z tanich „marionetek” i pełna postać tylko z bliska, jak w „Massive Crowd on Assassin's Creed Unity” (F. Cournoyer, A. Fortier, GDC 2015).

Czym się różnimy:
- Nie ma bazy reguł dopasowywanej w czasie gry. Kryteria (pora dnia, stały klient, reputacja ulicy) są warunkami w ink.
- Wariant wybieramy raz, przy budowie treści. Sklepy jednej branży biorą kolejne głosy według skrótu `shopHash(id, 94)`, więc żadne dwa nie mówią tego samego. U Ruskina remis między regułami rozstrzyga losowanie przy każdej kwestii.
- To krótka rozmowa z wyborem tematów, a nie same barki. Kwestie przy podejściu (ADR-0060 etap 4) zostają na etap 2.
- Marionetką z daleka jest figura tłumu z ADR-0041: jedna wspólna siatka dla wszystkich mieszkańców. O przełączeniu decyduje warstwa prezentacji symulacji (`RenderSync`), bo deskryptor widoku w `core/src/ports` zostaje bez zmian.

## Decyzja
1. **Kto.** Sprzedawca stoi za ladą każdego otwartego sklepu galerii i frontu (`ShopBuild.seller`, 40 sklepów) i każdej otwartej lady food hallu bez postaci fabularnej (4 lady). Razem 44 postacie. Sklep zamknięty, zakratowany albo pusty i zamknięta lada nie mają nikogo. Figura `figure` w tym miejscu znika (karty pomieszczeń: `model: figure × 1` mniej, `pnpm rooms:write`).
2. **Postać.** NPC `civilian` frakcji `civilians` z kluczem `seller-<id>` (lady: `seller-fh-<id>`). Wygląd daje pula tła po kluczu (ADR-0076: `look = fnv1a(klucz)`), więc jest stały w każdej grze. Sprzedawcy są na końcu `GAME_ACTORS`, dzięki czemu identyfikatory wcześniejszych postaci się nie zmieniają. Stoją za ladą bez AI przechodnia i bez ruchomego ciała, tak jak stały figury.
3. **Rozmowa.** `Interactable` typu `dialogue` z węzłem `seller_<scenariusz>.v<głos>`, podpowiedź `prompt.talk.seller` („Chat at the counter” / „Zagadaj przy ladzie”).
   - W sklepie zasięg wynosi 2,4 m i działa tylko z wnętrza sklepu. Nowe pole `Interactable.from` to prostokąt, w którym musi stać gracz. Bez niego sprzedawca przy bocznej ścianie odpowiadał przez ścianę z sąsiedniego sklepu i przez szybę z galerii.
   - Przy ladzie food hallu zasięg wynosi 3 m, jak u Kenty i Goro.
4. **Scenariusze** (`packages/narrative/ink/{pl,en}/sellers.ink`, mówi postać `LADA`: „Za ladą” / „Behind the counter”):
   - powitanie według pory dnia (noc, świt, dzień, zmierzch), inne dla stałego klienta. Stałym klientem jest się po pierwszej rozmowie: flaga `met_seller_<scenariusz>_<głos>`, jedna na sklep;
   - zdanie głosu, czyli kim jest ten sprzedawca;
   - trzy tematy, każdy raz w rozmowie: towar, plotka z okolicy (Lublin 2077, Hebi, Tessen, Kagami, Neon Koi, bez treści aktów) i pytanie o samego sprzedawcę;
   - pożegnanie głosu;
   - przy wrogiej ulicy (`civilians_tier == "hostile"`) jedno zdanie i koniec.
5. **Rysowanie (LOD).** Sprzedawca ma składnik `standIn`, czyli widok figury tłumu z tym samym `look`. `RenderSync` wysyła pełny widok NPC tylko wtedy, gdy gracz stoi na tym samym piętrze (|dy| < 2 m) w promieniu 6 m. Wraca do figury po przekroczeniu 8 m albo 2,5 m w pionie. Zmianę obrazu robi `despawn(id, "unloaded")` i ponowny `spawn`, bez animacji upadku. Symulacja tego nie czyta, więc złoty hash się nie zmienia.

## Spis scenariuszy
| Scenariusz (węzeł) | Głosy | Sklepy (głos) |
|---|---|---|
| apteka (`seller_pharmacy`) | 4 | MEDIX p2-s1 (1), APTEKA NOVA p0-w3 (2), FARMA PLUS l1-3 (3), MEDIFARM p1-w1 (4) |
| tatuaż (`seller_tattoo`) | 4 | SUMI INK p0-s1 (1), IREZUMI p1-w2 (2), INKSPOT p2-s3 (3), BLACK LOTUS l1-4 (4) |
| lombard (`seller_pawn`) | 2 | LOMBARD p1-w3 (1), SKUP p0-n2 (2) |
| syntetyczne jedzenie (`seller_synth_food`) | 4 | KONBINI l1e-1 (1), SOYA MAX p0-n1 (2), NOODLE BOX l3-w1 (3), SYNTHMART p1-n1 (4) |
| elektronika (`seller_electronics`) | 3 | VOLTAGE p1-s2 (1), CYBERDECK l2-s1 (2), OMNIBYTE p2-e0 (3) |
| kwiaciarnia (`seller_florist`) | 2 | PLASTIFLORA p1-n3 (1), BONSAI l2-n3 (2) |
| serwis (`seller_repair`) | 4 | REBOOT p2-n3 (1), CHIPFIX p0-w1 (2), DATAFIX l2-n6 (3), FIXPOINT p1-e1 (4) |
| wszczepy (`seller_implants`) | 3 | CHROMEDOC p2-n1 (1), NEUROTEK p1-e3 (2), SYNAPSE l2-s3 (3) |
| kantor (`seller_crypto`) | 4 | BITBANK l2-s4 (1), BITKANTOR p1-s1 (2), KOINEX p2-e2 (3), KANTOR p0-e3 (4) |
| odzież (`seller_clothing`) | 4 | NEONSKIN p0-w2 (1), NIGHT SILK l1-1 (2), KAWAII WEAR p2-w2 (3), SHIBUYA l2-n1 (4) |
| VR i automaty (`seller_vr`) | 3 | HOLODROM p0-e1 (1), DREAMDECK p2-w1 (2), ARCADIA l3-w2 (3) |
| broń (`seller_arms`) | 3 | TETSU p0-e0 (1), OKAMI ARMS l2-n5 (2), HAGANE ARMS p2-w3 (3) |
| kawa (`seller_coffee`) | 1 | KAWA, food hall |
| kuchnia tajska (`seller_thai`) | 1 | THAI, food hall |
| gyros (`seller_greek`) | 1 | GYROS, food hall |
| wok (`seller_wok`) | 1 | WOK, food hall |

Razem 16 scenariuszy i 44 głosy. Przydział głosów liczy `SELLERS` w `packages/sim/src/content/alchemia/sellers.ts`; tabela pokazuje stan z 23.11. Nowy sklep danej branży potrzebuje nowego głosu w ink, a test `alchemia-sellers` pilnuje, żeby głosów nie zabrakło.

## Koszt wydajności
Pomiar z 23.11, Playwright i SwiftShader, `seed=3`, kamera TPP. Trzy ujęcia: galeria P1 przy schodach ruchomych (patrząc na zachód), wnętrze apteki p1-w1 przed ladą i food hall P3. Liczby to wywołania rysowania / aktywne siatki.

| Ujęcie | main (figury) | wszyscy jako pełne NPC | etap 1 (LOD 8/10 m) | etap 1 (LOD 6/8 m, przyjęty) |
|---|---|---|---|---|
| galeria P1, `models=off` | 198 / 80 | 376 / 109 | 212 / 83 | 204 / 81 |
| apteka p1-w1, `models=off` | 177 / 70 | 277 / 74 | 193 / 74 | 193 / 74 |
| food hall P3, `models=off` | 223 / 89 | 341 / 99 | 223 / 89 | 223 / 89 |
| galeria P1, modele VRM | 355 / 99 | 1386 / 339 | 417 / 123 | 383 / 105 |
| apteka p1-w1, modele VRM | 326 / 84 | 1035 / 116 | 407 / 116 | 407 / 116 |
| food hall P3, modele VRM | 458 / 160 | 1243 / 237 | 458 / 160 | 458 / 160 |

- Sprzedawcy jako zwykłe NPC z modelami VRM dają od 1035 do 1386 wywołań rysowania, czyli od 1,6 do 2,1 raza więcej niż budżet sceny `models` (651 / 222). Bez modeli dają od 277 do 376 wywołań, na granicy budżetu `alchemia-tpp` (380 / 146). Dlatego etap 1 rysuje ich jako figury tłumu, a pełną postać tylko z bliska.
- Przyjęty LOD 6/8 m dokłada w galerii P1 6 wywołań i 1 siatkę bez modeli, a 28 wywołań i 6 siatek z modelami (1 pełny sprzedawca w kadrze, 15 ubranych postaci zamiast 14). W aptece przed ladą dokłada 16 / 4 bez modeli i 81 / 32 z modelami (2 pełne postacie). W food hallu nie zmienia nic. Wszystkie ujęcia mieszczą się w budżetach scen Alchemii i sceny `models`.
- Pełny sprzedawca z modelem VRM kosztuje od 30 do 40 wywołań rysowania. Figura tłumu nie kosztuje żadnego, bo trafia do istniejącej siatki tłumu (około 1,1 tys. trójkątów na figurę).
- Ilu sprzedawców jest naraz pełnymi postaciami, liczone na komórkach 0,5 m, do których dochodzi gracz na P0, P1 i P2. Przy 6 m na tym samym piętrze: najwyżej 3, średnio od 0,6 do 0,8. Przy 8 m: najwyżej 4, średnio od 1,2 do 1,4.
- Symulacja: nieruchomi sprzedawcy nie dodają zapytań indeksu brył (fala w `level-chase-cost.test.ts`: 295,7 na krok z nimi i bez nich). Jako przechodnie z AI dawali 339,7, ponad limit 320.

## Etapy
1. **Ten PR.** ADR, 16 scenariuszy w obu językach, 44 sprzedawców w sklepach galerii i frontu oraz przy ladach food hallu, LOD figura/postać, zasięg rozmowy z wnętrza sklepu, testy symulacji, narracji i sesji.
2. **Osobno.**
   - Figury kiosków i straganów deptaku oraz placu przed Alchemią (`deptak-stalls.ts`, `deptak-night.ts`, `front-plaza-cafe.ts`) stają się sprzedawcami według tej samej mechaniki, ze scenariuszami swoich branż.
   - Wygląd zgodny z branżą (fartuch w kuchni, kitel w aptece) przez pulę `vendor` manifestu. To wymaga roli tła w deskryptorze widoku, czyli zmiany kontraktu w `core/src/ports` z osobnym ADR-em.
   - Kwestie przy podejściu (wyzwalacze ADR-0060 etap 4).
   - Godziny pracy sprzedawców (harmonogram jak u Oyajiego) i handel przez panel sklepu u wybranych.

## Konsekwencje
- Gracz może zagadać do każdego otwartego sklepu i lady. Teksty są w katalogach ink obu języków, a symulacja trzyma tylko klucze (ADR-0056).
- Ryzyko widocznej zmiany obrazu w odległości 6 m: figura tłumu i model VRM mają ten sam `look`, ale różne generatory wyglądu, więc kolory i sylwetka się różnią. Przy przejściu wzdłuż galerii sprzedawca „wskakuje” w pełną postać. Etap 2 (wygląd według branży) może zbliżyć oba obrazy.
- Sprzedawcy nie uciekają przed strzelaniną i nie dostają obrażeń, tak jak figury, które zastępują.
- W 40 kartach sklepów (`docs/pomieszczenia/alchemia-shop-*.md`) zmienia się generowany inwentarz (bez figury, mezo o 1 mniej). Inne części kart zostają.
