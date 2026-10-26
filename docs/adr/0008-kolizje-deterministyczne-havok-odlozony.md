# ADR-0008: Kolizje w `sim`, Havok odłożony

## Kontekst
Plan wymienia Havok (WASM) jako fizykę oraz determinizm symulacji jako cel niefunkcjonalny. Fizyka w adapterze silnika oznaczałaby, że stan gry zależy od `engine`, a testy headless wymagałyby WASM.

## Decyzja
W M0 kolizje są kinematyczne i deterministyczne, w `sim`: okrąg postaci kontra AABB geometrii statycznej i kontra inne postacie, raycast (slab test) dla strzałów i linii wzroku. Kamera TPP wykrywa ściany pickingiem Babylona (to tylko prezentacja).

## Konsekwencje
Brak skoków, grawitacji i obiektów dynamicznych w M0. Havok wejdzie w M1 za portem `PhysicsPort` (raycast, character controller), z implementacją kinematyczną jako atrapą w testach i strażnikiem replay pilnującym determinizmu.
