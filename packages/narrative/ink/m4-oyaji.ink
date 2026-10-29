// Seki Senshi, E10: Oyaji's stall on the market on Podzamcze, 8:00 to 22:00 (plan §6, ADR-0015).
// The shop panel opens first; "Porozmawiaj z Oyajim" leads here. At night the schedule swaps
// his interaction for `oyaji_closed` (day-cycle.ink). Prices live in the domain, ink only talks.

=== oyaji ===
{ not has_flag("met_oyaji"):
    OYAJI: Oyaji. Tak mnie wołają na targu, to i ty tak wołaj.
    ~ set_flag("met_oyaji")
}
{
- civilians_stance == "hostile":
    OYAJI: Handlować mogę, lubić nie muszę. Ludzie gadają, że najpierw strzelasz, potem pytasz.
    OYAJI: Dlatego płacisz więcej, a za twoje graty dostaniesz mniej.
- civilians_stance == "friendly":
    OYAJI: {alias}! Dla ciebie zawsze coś odłożę. Odkąd tu bywasz, Hebi rzadziej zaglądają.
- else:
    OYAJI: Kupuję złom, sprzedaję naboje, łatam kurtki. Reszta to nie moja sprawa.
}
-> talk

= talk
+ [Co skupujesz? #tone:optional]
    SEKI: Co skupujesz?
    OYAJI: Wszystko, co da się rozkręcić. Złom i chipy po pełnej cenie, resztę za ćwiartkę.
    OYAJI: Części broni nie sprzedawaj. Przynieś je z podartą kurtką, to zejdę z ceny naprawy.
    -> talk
+ [Masz większy plecak? #tone:optional]
    SEKI: Masz większy plecak?
    OYAJI: Mam dwa. Jeden za sześćset, drugi za tysiąc dwieście. Potem już tylko walizki.
    -> talk
+ { not has_flag("oyaji_hebi") } [Hebi ci nie dokuczają? #tone:optional]
    SEKI: Hebi ci nie dokuczają?
    ~ set_flag("oyaji_hebi")
    { civilians_stance == "friendly":
        OYAJI: Mniej niż kiedyś. Hana mówi, że to twoja zasługa. Nie będę się kłócił.
    - else:
        OYAJI: Co miesiąc chcą swoje. Jak nie zapłacę, przychodzą za dnia, przy ludziach.
    }
    -> talk
+ [Na razie wystarczy. #tone:leave]
    OYAJI: Stragan stoi do dziesiątej. Potem roleta w dół.
    -> END
