# ADR-0084: Woda na ulicach: gdzie leży, jak moczy, jak odbija

Status: przyjęty (15.11, decyzja użytkownika: „Tak zapisz”; kierunek: realistyczne zachowanie wody malowane w kresce NPR, nie fotorealizm). Etapy w osobnych PR-ach, każdy ze zrzutami przed/po z modelami do akceptacji użytkownika. Rozwija ADR-0030 (wizualia fali 1) i ADR-0036 (jakość renderu).

## Kontekst
Użytkownik 15.11: „przeprojektować na ulicach wodę tak, żeby wyglądała realistycznie i bardziej AAA; na razie wygląda średnio”. Stan na main 9c36d5e:
1. **Gdzie leży woda.** Maska kałuż to szum wartości z progiem: `step(0.5, vnoise(vWorldPos.xz * 0.45))` w `npr/toon-shader.ts` (blok `ENV_REFLECT`), ta sama w pasach odbić (`renderer/atmosphere.ts` `puddles`, `renderer/signage.ts`, `mapcity/map-signs.ts`), plus dyski `puddle` w `renderer/dressing-plan.ts`. Plamy o ostrych brzegach pokrywają ok. połowę asfaltu i nie zależą od spadku, krawężnika ani pory dnia (zrzut łowcy 15.11 z Krakowskiego: jasnoniebieskie plamy w południe).
2. **Brak stanu „mokro”.** Powierzchnia jest sucha albo lustrzana (`wetFlag`, `gloss` 1.8). Ciemnienie i połysk zmoczonego asfaltu, najmocniejszy znak deszczu, nie istnieje.
3. **Odbicia nie trafiają w źródła.** Statyczna sonda 128 px (`quality.ts`, `wetProbe`) bez korekcji paralaksy, kwantowana na 6 stopni; neon odbija się w przypadkowym miejscu. SSR Babylona nie czyta materiałów toon (opisane w `quality.ts`).

## Decyzja
Woda zachowuje się jak prawdziwa (miejsce, ciemnienie, odbicie, deszcz), a jest malowana płasko, w stopniach, z konturem, jak reszta gry.

### 1. Maska fizyczna (pieczona, deterministyczna)
- Liczona przy budowie kawałka miasta w `packages/engine/src/renderer/mapcity` z geometrii, którą już mamy; wynik w kanale wierzchołka siatki gruntu (bez nowych tekstur i wywołań rysowania). Bez `Math.random`: ziarno z położenia.
- Źródła wody, od najsilniejszego:
  - rynsztok: pas 0,3–0,6 m wzdłuż krawężnika (spadek poprzeczny jezdni do krawędzi);
  - lokalne dołki i płaskie miejsca terenu NMT (siatka gruntu);
  - koleiny na osi pasów ruchu (z przekroju ADR-0080);
  - spoiny bruku na Starym Mieście i placach;
  - przy wpustach i u stóp ramp.
- Środek jezdni z daszkiem prawie suchy, chodnik tylko w zagłębieniach; zebry, pokłady mostów nad wodą, dachy i ściany bez stojącej wody.
- Rozkład: dużo małych kałuż, kilka dużych, wydłużonych wzdłuż krawężnika; pokrycie stojącą wodą 5–12% jezdni w deszczu (dziś ok. 50%).
- Ta sama maska zastępuje szum we wszystkich miejscach z punktu 1 kontekstu (shader toon, pasy odbić, szyldy, dyski `puddle`).

### 2. Trzy strefy
- **Sucho:** jak dziś.
- **Mokro** (cała ulica w deszczu i chwilę po nim): kolor ciemniejszy o 30–40%, wyższy połysk, rozmyte odbicie świateł; bruk błyszczy na wierzchu kostek.
- **Stojąca woda:** prawie czarna, płaska, odbicie z Fresnelem (Schlick, mocniej przy krawędzi kadru); miękkie przejście 10–20 cm do strefy „mokro” zamiast ostrej krawędzi.
- Wszystko w stopniach (cel), kontur bez zmian.

### 3. Odbicia według jakości (ADR-0036)
- **low (telefon):** bez sondy; strefa „mokro” i pasy odbić neonów przycięte do maski. Zero nowych wywołań rysowania i siatek.
- **medium:** sonda z korekcją paralaksy (rzut na prostopadłościan ulicy), więc neon odbija się pod szyldem; Fresnel w stojącej wodzie.
- **high:** dodatkowo własne odbicie w przestrzeni ekranu na buforze głębi, tylko w masce stojącej wody, w połowie rozdzielczości, ze sondą jako zapasem.

### 4. Deszcz i czas
- Kręgi od kropli (animowana mapa normalnych z atlasu klatek) tylko w stojącej wodzie i tylko w deszczu; bez deszczu lekka zmarszczka.
- Rozbryzg i fala pod stopą gracza i przechodnia w kałuży; na high mgiełka spod opon.
- Po deszczu najpierw znika „mokro”, potem kurczą się kałuże (próg maski w czasie). Stan pogody czytany z symulacji przez istniejący port, bez zmian w `core` i `sim` w etapach 1–3.

## Etapy (osobne PR-y)
1. **Maska i strefa „mokro”.** Testy bez przeglądarki: pokrycie jezdni 5–12%, przy krawężniku więcej niż na osi, zero na zebrach, dachach i ścianach, ta sama maska przy każdym uruchomieniu; migawka NPR aktualizowana świadomie; budżety npr-perf i phone-low bez wzrostu.
2. **Sonda z paralaksą i Fresnel** (medium, high).
3. **Kręgi deszczu, rozbryzgi pod stopą, wysychanie.**
4. **Własne SSR wody na high** z pomiarem czasu klatki (raport) i bramką wywołań rysowania.

Przed etapem 1: plansza „przed / cel” z obecnego zrzutu do akceptacji kierunku przez użytkownika.

## Konsekwencje
- Etap 1 daje największą zmianę wyglądu najmniejszym kosztem i działa na telefonie.
- Maska w kanale wierzchołka gruntu: siatki gruntu rosną o jeden atrybut; `map-ground-golden` zmienia się świadomie (opis w commicie).
- Ryzyko etapu 4: koszt na słabszych kartach; zostaje wyłącznie na high, z możliwością wyłączenia w opcjach.
- Kolorystyka dzielnic (`district-palette.ts`) dostaje odcień wody „mokro” na dzielnicę.
