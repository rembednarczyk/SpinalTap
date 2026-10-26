# ADR-0002: ECS: miniplex

## Kontekst
Plan wskazuje `miniplex` z `bitecs` jako furtką wydajnościową.

## Decyzja
`miniplex` 2.x. Byt to obiekt TS z opcjonalnymi komponentami (`sim/src/world/components.ts`); systemy pytają o zestawy komponentów (`world.with(...)`). Komponenty w gorących ścieżkach (pozycja, cooldown) są mutowane w miejscu, stan domenowy (`DomainState`) jest niemutowalny i podmieniany w całości.

Kolejność systemów jest jawną tablicą (`createSystems()`), nigdy wynikiem iteracji po mapie.

## Konsekwencje
Czytelność dla agentów kosztem wydajności przy dziesiątkach tysięcy bytów. Jeśli profilowanie M2 (streaming dystryktów, tłumy NPC) pokaże problem, systemy można przenieść na `bitecs` za tym samym kontraktem `System`.
