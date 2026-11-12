# ADR-0079: Urządzenie docelowe, progi wydajności i APK

## Status
Zaakceptowany (12.11, decyzje użytkownika: „przygotowujemy nowe progi jako docelowe, a problem przeglądarki rozwiązujemy poprzez instalację na telefonie jako .apk”; APK przy każdym większym wydaniu).

## Kontekst
- Budżety scen (ADR-0007, `tools/perf-budgets.json`) powstały z pomiaru „kilka procent powyżej tego, co jest”, a limit miliona wierzchołków miasta w pamięci (`packages/engine/test/map-city.test.ts`, 29.10) z ostrożnego założenia. Żadna z tych liczb nie wynikała z urządzenia docelowego. ADR-0007 zapowiadał rewizję po profilowaniu na GPU, której nie było.
- Po kroku 1.1 ADR-0077 miasto ma ok. 974 tys. wierzchołków, a budżet `reference` był podnoszony czterokrotnie wyjątkami (dług w ADR-0046). Dalsze mapowanie (13 komórek, drzewa, dachy) potrzebuje zapasu.
- Gra ma manifest PWA (`packages/app/public/manifest.webmanifest`), ustawienia domyślne to grafika High na każdym urządzeniu (decyzja 1.11).

## Wzorzec
Budżet wydajności dla urządzenia docelowego (target hardware / minimum spec), jak w zaleceniach Unity i Unreal dla urządzeń mobilnych: liczby wynikają z klasy sprzętu, budżet trzyma zapas na spadek wydajności po nagrzaniu (thermal throttling). Pakowanie gry webowej w aplikację natywną przez WebView: Capacitor (Ionic), jak w wielu grach i aplikacjach HTML5 na Androida.

## Decyzja
1. **Urządzenie odniesienia:** mocny telefon z Androidem klasy Xiaomi 15T Pro (flagowy SoC z 2025 r.), jakość High. Słabsze telefony dostają jakość `low` i scenę `phone-low`.
2. **Progi docelowe:**
   - wierzchołki całego miasta w pamięci: do 2,5 mln (było 1 mln);
   - wywołania rysowania i aktywne siatki każdej sceny: +40% wobec budżetów z 12.11 (np. `reference` 199 / 85 → 279 / 119, `krakowskie-tpp` 386 / 165 → 541 / 231), zaokrąglone w górę;
   - `phone-low` bez zmian (239 / 151), bo pilnuje słabszych telefonów.
   Zmiana jest decyzją o urządzeniu, nie wyjątkiem dla jednej zmiany, więc reguła „podniesienie limitu nie jest poprawką” obowiązuje dalej wobec nowych progów.
3. **APK:** gra trafia na telefon jako aplikacja Android z WebView (Capacitor): pliki gry w paczce, pełny ekran, bez paska przeglądarki. APK buduje CI przy tagu większego wydania (`v*`) i dołącza do wydania na GitHubie. Klucz podpisu tylko jako sekret repozytorium; do czasu jego dodania APK debugowy do instalacji ręcznej.
4. **Pomiar na telefonie** (etap 3): czas klatki pięciu scen, 10 minut gry dla nagrzewania, pamięć procesu. Wynik może obniżyć albo podnieść progi z punktu 2.

## Konsekwencje
- **Zapadka słabnie.** Przy progach 40% nad pomiarem test budżetu nie łapie małych przyrostów. Zmiany rysowania podają dalej pomiar przed i po (raport `reports/perf.json`), a przegląd porównuje go z poprzednim pomiarem.
- **Co APK daje, a czego nie.** Daje pliki lokalne (szybszy start, brak pobierania modeli przy każdym uruchomieniu), pełny ekran i brak zamykania karty przez przeglądarkę. Nie usuwa kosztu WebGL po stronie procesora: Android System WebView to ten sam Chromium co przeglądarka, więc koszt wywołań rysowania i limit pamięci procesu renderującego są podobne. Budżet wywołań zostaje więc głównym ograniczeniem; wydajność natywna wymagałaby innego silnika (np. Babylon Native), czego nie planujemy.
- **Dług w ADR-0046** dotyczący budżetu `reference` (G-052, ADR-0058 etap 7, G-556, G-522) mieści się w nowych progach; przesłanianie dla kamery we wnętrzu zostaje w backlogu jako optymalizacja.
- Doładowywanie, HLOD dalekich bloków i dłuższe ładowanie na starcie to kolejne kroki, gdy pomiar albo progi tego wymagą.

## Etapy
1. Progi (ten ADR, `tools/perf-budgets.json`, `map-city.test.ts`).
2. APK: Capacitor w `packages/app`, workflow CI przy tagu `v*`, instrukcja instalacji w README.
3. Pomiar na telefonie użytkownika i rewizja progów.
