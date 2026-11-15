# ADR-0087: Deterministyczny generator placów budowy w wersji cyberpunk

Status: Zaakceptowany (15.11, decyzja użytkownika: z kolizjami, plac jako miejsce w grze). Wynika z prośby użytkownika z 15.11: place budowy z OSM mają dostać cyberpunkową interpretację zamiast gołej ziemi, zrobioną jako deterministyczny generator. Dotyczy ADR-0042 (topografia: miasto zgodne z Lublinem, warstwa cyberpunk na nim), ADR-0083 (odcisk wejść tablic), ADR-0084 (maska wody), ADR-0056 (teksty dla gracza), ADR-0031 (podział renderera), ADR-0046 (testy, budżety). Poprzedza go #599 (fronty ulic pieszych omijają place budowy, G-866) i G-872 (Karmelicka 7: stojący budynek z `building=construction` dostaje bryłę).

## Kontekst
- `tools/osm-import/src/structures.ts` zna rodzaj `construction` (`landuse=construction` i `building=construction`). Import pomija takie budynki (`SKIP_BUILDING`), więc obrys zostaje gołą ziemią z pierwszego przebiegu reguły nawierzchni.
- Po #599 w centrum jest 5 placów (Zielona 5A w770678456 i w1382552286, w1261814241, w1236055101, dziedzińce Muzeum Ziem Wschodnich w1362895448). Po G-872 Karmelicka 7 przestaje być placem. Poza centrum place pojawiają się przy każdym poszerzeniu mapy.
- Rodzaj rekwizytu `construction-fence` istnieje w `props-kinds.ts`, ale nic go nie stawia.
- Ortofoto pokazuje na placach wykopy, stan surowy, dźwigi i kontenery. Gra może to pokazać po swojemu, bo plac i tak wygląda inaczej co kilka miesięcy.

## Decyzja
Plac budowy to wynik generatora w `tools/osm-import` (nowy moduł `construction-site.ts`), zapisany w tablicy rozstawienia `*.generated.ts` z odciskiem wejść (ADR-0083). Ten sam obrys i te same dane dają ten sam plac. Losowość tylko z ziarna liczonego z id obrysu (mulberry32 jak `crowd-look.ts`), bez `Math.random` i czasu.

**Wejścia:** obrys i otwory z `structures.ts`, krawędzie ulic i chodników (wejścia na plac), NMT pod obrysem, maska wody (ADR-0084), budynki sąsiednie (ściany przyległe do obrysu), pole i kształt obrysu.

**Kroki generatora:**
1. **Skala.** Pole obrysu wybiera zestaw: do 150 m² sam płot z tablicą; do 600 m² płot, kontenery, wykop; powyżej pełny zestaw z dźwigiem. Wąskie obrysy (stosunek boków ponad 4) bez dźwigu.
2. **Płot** po obrysie, odsunięty 0,3 m do środka: panele 2,5 m, co n-ty panel (n z ziarna, 3–5) z holoreklamą dewelopera, wzdłuż góry taśma LED. Brama 6 m na odcinku obrysu najbliższym ulicy z wjazdem; bez wjazdu furtka 1,2 m od chodnika. Płot nie wchodzi na jezdnię ani chodnik (przycięcie do obrysu minus pas 0,3 m).
3. **Strefy.** Obrys dzielony na wykop (najniższa część NMT, 35–55% pola), plac składowy (przy bramie) i zaplecze (najdalej od wykopu, przy płocie). Wykop to obniżona nawierzchnia błota z rampą od bramy; dno z maską stojącej wody z ADR-0084 (kałuże i odbicia za darmo).
4. **Dźwig wieżowy** w punkcie, z którego wysięgnik sięga najdalszego narożnika obrysu (minimalizacja promienia, krok 1 m), poza wykopem. Wysokość z największej sąsiedniej bryły plus 8 m. Migające światło na szczycie i dron dostawczy na stałej trasie brama–wykop (animacja w engine, faza z ziarna).
5. **Rusztowanie z siatką** wzdłuż najdłuższej ściany sąsiada przylegającej do obrysu (albo bryły stanu surowego, gdy plac ma `building=construction` z wysokością z LoD1). Na siatce neonowy baner z „wizualizacją” budynku 2077 (tekstura z małej puli, wybór z ziarna).
6. **Kontenery biurowe** w zaplecze, 1–3 piętrowane, drzwiami do placu.
7. **Drukarka 3D do betonu** (rama bramowa nad wykopem) i **robot-koparka** w pozie przy rampie; tylko w pełnym zestawie.
8. **Tablica informacyjna** przy bramie: nazwa inwestycji, deweloper, termin. Teksty z puli kluczy w `i18n/{en,pl}` (ADR-0056); `tools` i tablica trzymają klucze i ziarno, nie zdania.

**Engine:** zestaw elementów (kit) w `packages/engine/src/renderer/mapcity/construction/` za fasadą `BabylonRenderer`: panele, brama, kontenery, dźwig, rusztowanie, drukarka, koparka, tablica. Instancje i scalanie jak w blokach mebli (`StreetProps`), materiały toon NPR, holoreklamy i LED przez istniejące materiały emisyjne szyldów. Na `low` bez drona i animacji, rusztowanie bez siatki.

**Sim:** płot i kontenery to bryły kolizji (gracz nie wchodzi na plac poza bramą); wykop to obniżenie terenu w siatce gruntu i w bryłach podłogi. Brama otwarta, plac dostępny, bez nowych reguł symulacji poza bryłami, więc złoty hash `determinism` zmienia się tylko przez nowe bryły w obszarze testu, świadomie.

## Testy i bramki
- Determinizm: dwa przebiegi generatora na tych samych danych dają identyczną tablicę; zmiana id obrysu zmienia układ.
- Jednostkowe: płot nie przecina jezdni, chodnika ani ściany; brama na odcinku przy ulicy; dźwig sięga każdego narożnika; skala zestawu według pola.
- Skan glitchy, nowe kontrole: `site-on-road` (element placu na jezdni lub chodniku), `site-through-wall`, `site-crane-reach` (narożnik poza zasięgiem), `site-gate-blocked`. Bazy 0.
- Budżety `tools/perf-budgets.json` bez podnoszenia; scena perf przy Zielonej 5A dochodzi do `npr-perf`. Zrzuty przed/po z modelami do akceptacji użytkownika.
- Przegląd `topography-curator`: plac w swoim obrysie, wpis T „cyberpunkowa warstwa na prawdziwym placu budowy” (odstępstwo celowe).

## Etapy (osobne PR-y)
1. Generator i tablica (płot, brama, strefy, wykop) plus kit płotu, tablicy i kontenerów; kontrole skanu.
2. Dźwig z dronem, rusztowanie z banerem.
3. Drukarka 3D i robot-koparka; wersja `low`.

## Konsekwencje
- Place budowy przestają być pustymi plamami i dostają rozpoznawalny, różny wygląd; każdy nowy plac z poszerzenia mapy dostaje go bez pracy ręcznej.
- Plac zgadza się z OSM co do miejsca i obrysu, a wygląd jest interpretacją (wpis T).
- Przy zmianie danych OSM (plac zakończony) generator przestaje go stawiać, bo obrys zmienia rodzaj.
