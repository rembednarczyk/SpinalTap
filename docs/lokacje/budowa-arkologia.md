# Plac budowy: Arkologia Lublin, etap II (`budowa-arkologia`)

Plac budowy z OSM w1236055101 (`landuse=construction`, bez nazwy, 1417 m²) przy Stanisława Staszica, w obrysie Pałacu Potockich (w69915848, Staszica 3) i jego dziedzińca, x 183–226, z 35–93,5 (`LUBLIN_CONSTRUCTION_SITES`, generator ADR-0087). W grze pełny zestaw: dźwig wieżowy na dziedzińcu, płot z bramą od alejki przy Staszica i holograficzna tablica „Arkologia Lublin, etap II / Deweloper: Lubelska Arkologia S.A. / Zakończenie: wiosna 2079” (`site.board.name.1`, `developer.4`, `term.1` w `packages/ui/src/i18n/pl/site.ts`). Stan gry na `22b1808`.

## Historia
Pałac Potockich stoi przy Staszica, między gmachem Collegium Maximum Uniwersytetu Medycznego (Staszica 4/6) a Zieloną. Obrys placu budowy w OSM obejmuje pałac i jego dziedziniec, a na ortofoto z kwietnia 2025 roku na dziedzińcu stoi żuraw wieżowy (T-321). Tuż na północ w danych stoi już budynek „Apartamenty Pałacowe” (w1134342879, Staszica 3), więc budowa wygląda na zabudowę mieszkaniową przy pałacu. Dokładnego programu inwestycji dane nie podają i karta go nie zgaduje.

W 2077 roku dziedziniec pałacu wydzierżawiła Lubelska Arkologia S.A., ta sama, która stawia tablice na budowie przy Pałacu Lubomirskich (karta `budowa-wzgorza`). Na tablicy obiecuje „etap II” arkologii, choć etapu I nikt w mieście nie widział, a na siatce dźwigu wisi wizualizacja wieżowca, który nie zmieściłby się na dziedzińcu. Konserwator wstrzymuje roboty co kilka miesięcy, więc dźwig stoi, a jego czerwone światło mruga nad dachem pałacu każdej nocy. Ludzie z Krakowskiego mówią o tym miejscu „arka bez wody”.

Przed chwilą (cel sceny, §5, w grze brak): stróż zostawił bramę uchyloną i poszedł po kawę do Halki przy Staszica 1, a na skrzynce przy bramie stygnie jego termos.

## Klimat
- **Światło:** czerwone, migające światło na głowicy dźwigu (stałe na telefonach, `site-signs.ts`), hologram tablicy nad projektorem na płocie przy bramie (panel światła z ramką i liniami skanowania, wiązka z soczewki, od 22.11), taśma LED wzdłuż góry płotu i holoreklama dewelopera na co n-tym panelu (ADR-0087 krok 2); latarnie drogowe Staszica (185,8; 43,3) i (186; 65,5). Okna pałacu z ogólnego stylu budynku historycznego.
- **Dźwięk (cel):** brzęczenie hologramu, wiatr w linach dźwigu, w dzień piła i agregat. W grze brak dźwięku ze źródła.
- **Zapach:** mokry piasek i cement, spaliny z alejki.
- **Pogoda:** otwarty dziedziniec, deszcz; wykopu i kałuż w grze nie ma (`dig: null`).
- **Kontrast (§3):** hologram arkologii przyszłości na płocie przy zabytkowym pałacu; czerwone światło dźwigu nad jego dachem.
- **Ruch i życie:** migające światło dźwigu. Ludzi na placu brak; najbliżej ławka z koszem przy Staszica (193,6; 44,6), bez miejsc tłumu.

## Przeznaczenie
- Miejsce tła przy Staszica i Zielonej, punkt orientacyjny (dźwig ok. 26 m nad dziedzińcem, wyższy od dachu pałacu). Brama otwarta, plac dostępny (ADR-0087).
- **Wejścia:** brama (200,7; 41,1) od alejki serwisowej w232805962 przy Staszica; tablica (202,4; 39,9) obok niej.
- **Osłony:** płot (trzy panele po 2,5 m przy bramie), maszt dźwigu (204; 64), ściany pałacu.
- **Ucieczka:** alejką na Staszica, dalej na Krakowskie Przedmieście albo Zieloną.
- **Punkt widokowy:** z bramy widać dziedziniec z masztem dźwigu; dźwig jest niedostępny.

## Topografia
- Prawdziwe miejsce: w1236055101 (`landuse=construction`) obejmujący Pałac Potockich w69915848 (OSM `historic=castle`, Staszica 3); teren według NMT −2,7…−1,2. Sąsiedzi: Collegium Maximum w67499318 (Staszica 4/6), Apartamenty Pałacowe w1134342879, Zielona 5 (w69915878, mural „Izmus”), restauracja Halka (Staszica 1).
- W grze: obrys i miejsce z OSM, wygląd z generatora i ziarna id (`seed` 2704903470); dźwig 26,4 m z wysięgnikiem 31 m na dziedzińcu, zgodny z żurawiem na ortofoto 2025-04 co do 1–2 m (T-321, przegląd kuratora etapu 2).
- Odstępstwo celowe: cyberpunkowa warstwa na prawdziwym placu budowy (T-321, ADR-0087). Pełny zestaw bez wykopu, kontenerów, rusztowania i drona: wykop dostaje tylko najniższa część NMT, a dron lata tylko na placu z wykopem (`site-drones.ts`).

## Inwentarz docelowy
- **Architektura:** płot z panelami 2,5 m, taśmą LED i holoreklamami (jest, trzy panele), brama 6 m (jest); docelowo płot na całym wolnym boku dziedzińca od alejki i od Zielonej, rusztowanie z siatką i banerem wizualizacji przy ścianie pałacu od dziedzińca (ADR-0087 krok 5), pas wykopu pod fundament.
- **Duże obiekty:** dźwig wieżowy z hakiem (jest), tablica-hologram (jest); do zrobienia kontener biurowy stróża przy bramie (`site-cabin`), stos palet i kręgów kabla, betoniarka albo drukarka 3D do betonu (ADR-0087 etap 3).
- **Drobiazg w skupiskach (§14):** przy bramie termos stróża, kubki, niedopałki, kask na skrzynce; przy maszcie zwoje taśmy, worki cementu, kanister (generator `clutter` placów, ADR-0096).

## Frakcja i zasady
Frakcja: korporacja (Lubelska Arkologia S.A. na dziedzińcu zabytku).
- §12 częściowo: z wąskiej alejki przy Staszica wchodzi się przez bramę na otwarty dziedziniec zamknięty ścianami pałacu (ciasno, potem szeroko). Próg to brama i zmiana nawierzchni.
- §13 częściowo: światła mają oprawy (projektor tablicy, głowica dźwigu, taśma płotu), czerwień dźwigu to ostrzeżenie (§4). Na dziedzińcu poza dźwigiem jest ciemno. Pomiar 60-30-10 nie istnieje.
- §14 dług: makro (dźwig, płot), mezo i mikro brak.
- §15 dług: brak kałuż i błota na dziedzińcu, choć to plac budowy pod deszczem; połysk tylko w hologramie.
- §16 częściowo: korporacja przez szyld i hologram, ale bez jej materiałów (czarne szkło, stal) i bez ochrony.
- §17 dług: skalę daje tylko brama; brak dźwięku i ludzi.

## Dług sceny
- Płot: trzy panele (7,5 m z 156,5 m obwodu) zostawiają dziedziniec otwarty od reszty wolnych boków. Sprawdzić w generatorze, które boki odpadły jako ściana, chodnik albo jezdnia, i domknąć wolne odcinki: `tools/osm-import/src/construction-site.ts`, tablica w `packages/sim/src/content/lublin/construction.generated.ts` (`pnpm osm:props`), z przeglądem `topography-curator`.
- Kontener stróża przy bramie, drobiazg przy bramie i maszcie, robotnik albo stróż (postać z gry w dzień): generator w `tools/osm-import/src/construction-site.ts`, miejsca tłumu w `packages/sim/src/content/crowd.ts`.
- Rusztowanie z banerem przy ścianie pałacu od dziedzińca i drukarka 3D z robotem-koparką (ADR-0087 krok 5 i etap 3, niezrobione): generator (`construction-site.ts`, `construction-crane.ts`) i kit `packages/engine/src/renderer/mapcity/construction/`.
- Błoto i kałuże na dziedzińcu: rysunek gruntu placu w `packages/engine/src/renderer/mapcity/construction/site-yard.ts` albo maska wody ADR-0084.
- Dźwięk (hologram, agregat w dzień, liny dźwigu): emitery na zewnątrz w `packages/engine/src/audio/`.
- Tablica „etap II” bez etapu I w mieście: zostaje jako żart świata, bez zmiany (decyzja do potwierdzenia przy kolejnej puli tablic w `packages/ui/src/i18n/{en,pl}/site.ts`).
- Pomiar §13: ujęcie nocne z alejki na bramę i dźwig (ok. (196; 44)) w `tools/shots/room-spots.json`.
