# ADR-0100: Minimapa z kondygnacjami, sprzedawcami i lokalami

Status: Przyjęty (23.11, polecenie użytkownika „Minimapa reaguje na piętra i pokazuje np. prawdziwych sprzedawców, POI”; decyzje a–c rekomendowane przez orkiestratora pod nieobecność użytkownika). Zmienia ADR-0035 tylko w części „Minimapa”, punkt o sklepach.

## Kontekst
Minimapa (ADR-0021, ADR-0035, ADR-0045) zna tylko wysokość gracza nad ulicą: na pomoście pokazuje „▲ n m” i rozjaśnia pomosty. Wnętrza z ADR-0061 (`INTERIORS`: pokoje jako prostokąty XZ z `bottom` i `top`) są dla niej niewidoczne. W P-2 Alchemii, na peronie metra albo w hali W-3 gracz widzi ulicę nad głową, a nie pokój, w którym stoi. Sklepy zniknęły z mapy w ADR-0035, choć typy znaczników `ripperdoc` i `vendor` z CSS i tekstami zostały w UI. Lokale z importu (`LublinBuildingData.venues`, ADR-0064 etap 4) mają nazwy 2077 i rodzaje, ale widać je tylko na szyldach.

## Wzorzec
- **Warstwy pięter** jak w grach z wielopoziomowymi wnętrzami (Hitman 2016–2021, Deus Ex: Human Revolution, Cyberpunk 2077): mapa pokazuje rzut kondygnacji, na której stoi gracz, a resztę przygasza.
- **MVVM**, który repo już stosuje (ADR-0031): `sim` liczy kondygnację z danych, `app` składa model widoku minimapy, UI tylko rysuje.

Różnice:
- Kondygnacji nie wybiera się ręcznie (Hitman i Deus Ex pozwalają przewijać piętra). Minimapa zawsze pokazuje piętro gracza, a zakładka mapy zostaje mapą miasta.
- Rzut piętra to prostokąty pokoi z `InteriorRoom`, bez ścian, drzwi i mebli. Dane już są w symulacji, nie ma osobnej grafiki mapy.
- Numer poziomu ma tylko wnętrze, którego plan nazywa kondygnacje (Alchemia: P-2, P-1, P0–P3). Pozostałe pokazują samą nazwę, a pod ulicą głębokość „▼ n m”, lustrzaną do „▲ n m”.

## Decyzja

### a) Kondygnacja
- Kondygnacja to pokój wnętrza pod graczem. `floorAt(p, interiorId)` w `sim` (`content/interior-floors.ts`) zwraca wnętrze, numer poziomu albo `null` i prostokąty pokoi tej kondygnacji. Wnętrze bierze z `session.interior` (histereza drzwi z `interiorSystem`).
- Pokoje kondygnacji:
  - we wnętrzu z numerowanymi poziomami (`storeys` w `InteriorDef`: wysokości podłóg z planu i numer najniższej) to pokoje o tym samym najbliższym poziomie (L1 frontu Alchemii leży przy P1);
  - w pozostałych to pokoje o tym samym `bottom` w granicach 0,5 m.
  - Rodzina wnętrza (to, w którym stoi, i te `within` w nim) liczy się razem, więc w sklepie galerii widać całe piętro galerii.
- `MapPlayerVm.floor`: klucz nazwy wnętrza, numer poziomu albo głębokość pod ulicą i prostokąty pokoi. Minimapa zamiast „▲ n m” pisze nazwę i poziom (`map.floor.level`: „Level n” i „Poziom n”), rysuje pokoje wyraźnie, a ulicę i bloki przygasza. Na powierzchni i na pomostach nic się nie zmienia.

### b) Sprzedawcy
- Na mapie są sprzedawcy, którzy handlują teraz (`interactable.kind === "shop"`, czyli otwarci według harmonogramu):
  - Mori jako `ripperdoc`;
  - Oyaji i Fumiko jako `vendor`.
- Zamknięty sprzedawca ma interakcję `dialogue` (`oyaji_closed`, `fumiko_closed`), więc znika z mapy.
- Figury i pozostali mieszkańcy nadal nie są na mapie.
- Ustawienie „bez znaczników” (`settings.mapMarkers`) ukrywa też sprzedawców.

### c) Lokale (POI)
- Nowy rodzaj etykiety `MapLabelKind` „venue” w `buildCityMap`, wspólny dla zakładki mapy i minimapy:
  - lokale z importu z nazwą 2077 i rodzajem (`venue.kind.*`);
  - nazwane wnętrza (`interior.*`, klucz tłumaczony w UI) bez sklepów `within`, w środku ich największego pokoju.
- Minimapa rysuje je jako małe ikony z nazwą tylko w swoim zasięgu (32 m). Zakładka mapy pokazuje je według przybliżenia jak zabytki, ale dopiero od widoku 600 m, bo jest ich kilkaset.

## Zmiana względem ADR-0035
Zdanie „Sklepy zniknęły” zastępuje reguła b). Reszta punktu „Minimapa” obowiązuje: fixerzy i cele przyjętych zleceń, cel jako obszar, zoom i wyprzedzenie.

## Etapy (jedna gałąź `feat/minimapa-pietra`, osobne commity)
1. Ten ADR.
2. Kondygnacje: `floorAt` z testem w `sim`, `floor` w modelu widoku, test sesji (P-2 Alchemii i peron metra mają poziom, ulica nie), test komponentu.
3. Sprzedawcy na minimapie i mapie (Oyaji w godzinach otwarcia ma znacznik, w nocy nie).
4. Lokale `venue` w `buildCityMap`, minimapie i zakładce mapy.

## Konsekwencje
- `MapPlayerVm` zmienia się przy przejściu z kondygnacji na kondygnację (prostokąty pokoi są w pamięci podręcznej `floorAt`, więc to ten sam obiekt), a nie co klatkę.
- Nowe wnętrze z numerowanymi poziomami deklaruje `storeys` z wysokości swojego planu. Bez tego dostaje samą nazwę.
- Polskie nazwy lokali to dane importu (nazwy 2077, ADR-0058), a nie teksty katalogu. Skan i18n ich nie liczy, bo stoją w plikach `*.generated.ts`.
