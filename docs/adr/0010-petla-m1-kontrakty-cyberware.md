# ADR-0010: Pętla M1: kontrakty, klinika, zdolność aktywna

## Kontekst
M1 (§14): gracz wykonuje zlecenie, zdobywa eddies, kupuje i instaluje cyberware, a zmiana wpływa na walkę. Wszystko musi zostać deterministyczne i przetrwać zapis.

## Decyzja
- **Kontrakty fixera** są proceduralne: `generateContract` w `core` zużywa dokładnie dwie liczby z `RandomPort` (miejsce, liczba celów). Stan kontraktu leży w domenie (`contracts.active`, `contracts.completed`); cele to gangerzy z tagiem `contract:<id>` i kluczami `<id>-g<n>`. Po wczytaniu fabryka świata odtwarza tylko żyjące cele (flagi `dead:<key>`). Ink decyduje o rozmowie (`accept_contract()`, `complete_contract()`), struktura i wypłata należą do domeny.
- **Klinika doktora Mori** to interakcja typu `shop` (bez ink). Zakup to komenda `buy-cyberware` / `buy-item` stosowana w kroku symulacji; reguły (`buyCyberware`, `buyItem`) są czystymi funkcjami w `core`.
- **Zdolność aktywna** (Akcelerator Kairos, Q) nie spowalnia czasu gry, tylko skaluje `dt` wszystkiego poza graczem (ruch, obrót i przeładowanie wrogów). Pętla fixed-step zostaje nietknięta, więc replay i zapis działają bez zmian.
- **Trafienia w głowę**: punkt trafienia powyżej 83% wysokości ciała mnoży obrażenia ×1,6.
- **Kolejność iteracji**: miniplex przestawia byty przy usuwaniu, więc systemy wrażliwe na kolejność (AI, ruch, śmierć) iterują w kolejności tworzenia (`inCreationOrder`), a snapshot jest sortowany po kluczu. Test w `sim/test/m1.test.ts` sprawdza, że wczytana gra po śmierciach i spawnach liczy dalej identycznie.
- Schemat zapisu v3 (ekwipunek, kontrakty, stan zdolności) z migracją v2→v3.

## Konsekwencje
Akceptację M1 sprawdza `packages/app/test/m1-loop.test.ts`: po wszczepieniu stabilizatora chwytu ten sam pistolet zadaje 26 zamiast 22 obrażeń za zwykłe trafienie w korpus.
