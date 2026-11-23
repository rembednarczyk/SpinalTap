# Plac budowy: Plac Koziołka (`budowa-plac-koziolka`)

Plac budowy Zielona 5A (OSM w770678456, `landuse=construction`, `construction=residential`, 1465 m²) przy Zielonej, między cerkwią greckokatolicką św. Jozafata (Zielona 3) a kamienicą Zielona 5 z muralem „Izmus”, x 228–284, z −0,3…57,5 (`LUBLIN_CONSTRUCTION_SITES`, generator ADR-0087). W grze to jedyny z trzech placów z pełnym zestawem w ruchu: wykop, dźwig, kontenery, płot na większości obwodu, dron dostawczy i holograficzna tablica „Plac Koziołka / Deweloper: Sakura-Wisła Development / Zakończenie: termin w weryfikacji” (`site.board.name.5`, `developer.0`, `term.2` w `packages/ui/src/i18n/pl/site.ts`). Ma własną scenę budżetu `zielona-budowa-tpp` w `e2e/npr-perf.spec.ts`. Stan gry na `22b1808`.

## Historia
Zielona to krótka uliczka (w OSM strefa zamieszkania) za Krakowskim Przedmieściem. Pod numerem 3 stoi cerkiew greckokatolicka św. Jozafata, a obok placówka pomocy Bractwa Miłosierdzia im. św. Brata Alberta (w OSM `amenity=social_facility`), patrona ubogich i bezdomnych. Na ścianie Zielonej 5 jest mural „Izmus”, a w parterach okolicznych kamienic zakład kaletniczo-rymarski, kosmetyczki i fryzjer. Na działce 5A trwa budowa mieszkań: na ortofoto z kwietnia 2025 roku stoi tu żuraw wieżowy (T-321). Nazwa z tablicy gry nawiązuje do herbu Lublina z kozłem wspinającym się na krzew winorośli i do figurek Koziołków rozstawionych po mieście (w danych mapy m.in. Koziołek Onufry przy Placu Łokietka).

W 2077 roku Sakura-Wisła Development buduje tu „Plac Koziołka”, apartamenty z prywatnym dziedzińcem, a termin zakończenia jest „w weryfikacji”, odkąd w wykopie znaleziono stare piwnice. Po jednej stronie płotu pod bramą Bractwa ustawia się wieczorem kolejka po zupę, po drugiej holoreklamy dewelopera obiecują ogród na dachu i windę z dronem do każdego mieszkania. Dron dostawczy krąży między bramą a wykopem nawet w nocy, a mieszkańcy kamienicy obok liczą jego przeloty zamiast owiec.

Przed chwilą (cel sceny, §5, częściowo w grze): ktoś zostawił przy płocie od Zielonej worki i kartony (`clutter` placu wzdłuż płotu), a w oknie górnego kontenera biurowego ktoś nie zgasił światła.

## Klimat
- **Światło:** czerwone, migające światło na głowicy dźwigu (259; 19), hologram tablicy na płocie przy bramie (251,0; 1,6), taśma LED wzdłuż góry płotu i holoreklamy na co n-tym panelu, zimne okna dwóch kontenerów biurowych postawionych jeden na drugim (280,2; 48,1), światło drona; latarnie drogowe Zielonej (224,7; 11,3) i (248,8; −6,7). Od Krakowskiego szyldy lokali Zielonej (BAR KAMIENICZNIKA, PĘDZELEK I PUDER).
- **Dźwięk (cel):** brzęczenie hologramu, silniki drona, w dzień koparka w wykopie i agregat, dzwony cerkwi św. Jozafata. W grze brak dźwięku ze źródła.
- **Zapach:** mokra glina z wykopu, spaliny, zupa z kuchni Bractwa.
- **Pogoda:** otwarty plac; wykop obniżony do y −3,04 (dno 1,2–1,6 m pod NMT) z maską stojącej wody ADR-0084 na dnie.
- **Kontrast (§3):** holoreklamy apartamentów nad płotem i kolejka po zupę pod bramą placówki Brata Alberta po drugiej stronie uliczki.
- **Ruch i życie:** dron na stałej trasie brama–wykop (`site-drones.ts`, poza telefonami), migające światło dźwigu. Ludzi na placu brak.

## Przeznaczenie
- Miejsce tła przy deptaku Krakowskiego, punkt orientacyjny (dźwig 24,6 m z wysięgnikiem 41,5 m). Brama otwarta, plac dostępny (ADR-0087).
- **Wejścia:** brama (247,6; 4,5) od Zielonej; płot 51 paneli (127,5 m z 175 m obwodu).
- **Osłony:** kontenery (bryły), płot, krawędź wykopu, maszt dźwigu.
- **Ucieczka:** bramą na Zieloną i dalej na Krakowskie Przedmieście albo Staszica; wykop jako zagłębienie do ukrycia.
- **Punkt widokowy:** z Zielonej przy bramie widać wykop i dźwig; z górnego kontenera (niedostępny) cały plac.

## Topografia
- Prawdziwe miejsce: w770678456 (`landuse=construction`, `construction=residential`, nazwa „Zielona 5A”) i budynek w1382552286 (Zielona 5a, `building=construction`); sąsiedzi: cerkiew św. Jozafata w69916021 (Zielona 3), Bractwo Miłosierdzia im. św. Brata Alberta w232805913, Zielona 5 w69915878 z muralem. Teren według NMT −3,3…−0,6.
- W grze: obrys i miejsce z OSM, wygląd z generatora (`seed` 1952248392); dźwig 24,6/41,5 m zgodny z żurawiem na ortofoto 2025-04 (wysięgnik ok. 9 m od masztu gry, T-321); wykop w najniższej części NMT; rusztowanie przy szczycie Zielonej 5 zdjęte, bo zasłaniało szyld lokalu (G-893 naprawione).
- Odstępstwo celowe: cyberpunkowa warstwa na prawdziwym placu budowy (T-321, ADR-0087).

## Inwentarz docelowy
- **Architektura:** płot z panelami, taśmą i holoreklamami (jest), brama (jest), wykop z rampą od bramy i wodą na dnie (jest); docelowo rusztowanie z banerem na ścianie, która nie zasłania szyldów (np. ściana szczytowa od podwórza), stan surowy pierwszej kondygnacji w wykopie.
- **Duże obiekty:** dźwig z hakiem (jest), dwa kontenery biurowe jeden na drugim (są), tablica-hologram (jest), dron (jest); do zrobienia drukarka 3D do betonu nad wykopem i robot-koparka przy rampie (ADR-0087 etap 3), kontener na gruz, schody na górny kontener.
- **Drobiazg w skupiskach (§14):** 13 elementów `clutter` wzdłuż płotu od Zielonej (są); do zrobienia przy kontenerach kaski, kubki, kanistry, przy wykopie szalunki i pręty.

## Frakcja i zasady
Frakcja: korporacja, ulica (deweloper za płotem, Bractwo i Zielona przed nim).
- §12 zgodne: wąska Zielona (strefa zamieszkania) otwiera się za bramą na szeroki plac z wykopem w dół. Próg to brama, zmiana nawierzchni (kostka i glina) i spadek terenu do wykopu.
- §13 częściowo: wszystkie światła mają oprawy (dźwig, projektor, taśma, okna kontenerów, dron). Pomiar 60-30-10 nie istnieje, mimo sceny `zielona-budowa-tpp`.
- §14 częściowo: makro i mezo są (dźwig, kontenery, płot), mikro tylko przy płocie.
- §15 zgodne: woda w wykopie odbija światło (ADR-0084), szkło okien kontenerów; mat gliny i płyt płotu.
- §16 zgodne: czysta reklama dewelopera i prowizorka ulicy po dwóch stronach płotu.
- §17 częściowo: skalę dają drzwi kontenerów (2,1 m) i brama. Ruch: dron i światło dźwigu. Dźwięku i ludzi brak.

## Scenariusz tła
- Kto tu bywa: robotnicy i kierownik budowy Sakura-Wisła w kontenerach biurowych; kolejka po zupę pod bramą Bractwa wieczorem; mieszkańcy kamienicy obok, którzy liczą przeloty drona; dron dostawczy między bramą a wykopem.
- Co się dzieje: w dzień dźwig pracuje nad wykopem, w którym znaleziono stare piwnice, a holoreklamy obiecują ogród na dachu; wieczorem po jednej stronie płotu ustawia się kolejka po zupę, a dron krąży nad wykopem także nocą.
- Ślad obecności: worki i kartony przy płocie od Zielonej, zapalone światło w oknie górnego kontenera biurowego, kubki po zupie pod bramą Bractwa.

## Dług sceny
- Drukarka 3D do betonu i robot-koparka (ADR-0087 etap 3, niezrobiony): generator `tools/osm-import/src/construction-site.ts`, kit `packages/engine/src/renderer/mapcity/construction/`, wersja `low`; pomiar sceny `zielona-budowa-tpp` przed i po (budżet 172/80, dziś 157/72).
- Robotnicy w dzień i stróż w nocy (postacie z gry przy kontenerach, przy bramie): generator albo miejsca tłumu w `packages/sim/src/content/crowd.ts`.
- Rusztowanie z banerem na ścianie bez szyldów (po G-893): reguła ściany w `tools/osm-import/src/construction-scaffold.ts`.
- Drobiazg przy kontenerach i wykopie: generator `clutter` placów w `construction-site.ts`.
- Kolejka pod Bractwem Brata Alberta wieczorem (miejsca tłumu przy w232805913) jako kontrast sceny: `packages/sim/src/content/crowd.ts`, przegląd `topography-curator` (chodnik Zielonej).
- Dźwięk drona, budowy w dzień i hologramu: emitery na zewnątrz w `packages/engine/src/audio/`.
- Pomiar §13: ujęcie nocne z punktu sceny `zielona-budowa-tpp` (238,8; −6,5) w `tools/shots/room-spots.json` i `pnpm shots:palette`.
