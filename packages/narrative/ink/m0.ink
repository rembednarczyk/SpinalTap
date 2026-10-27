// Seki Senshi — M0: "Pierwsze zlecenie".
// Speaker prefix convention: "KAITO: ...", "SEKI: ...", "UME: ...". Lines without a prefix are narration.
// Variables below are synced from the domain before each conversation (see narrative-runtime.ts).

VAR quest_step = ""
VAR alias = ""
VAR contract_state = ""
VAR contract_site = ""
VAR contracts_done = 0
// Faction stances from the domain: "hostile", "neutral" or "friendly".
VAR fixers_stance = "neutral"
VAR hebi_stance = "neutral"
VAR civilians_stance = "neutral"
VAR clinic_stance = "neutral"

EXTERNAL set_flag(name)
EXTERNAL has_flag(name)
EXTERNAL change_rep(faction, delta)
EXTERNAL set_alias(name)
EXTERNAL unlock_memory(id)
EXTERNAL accept_contract()
EXTERNAL complete_contract()

=== fixer ===
{
- quest_step == "find_fixer": -> first_meeting
- quest_step == "eliminate_courier": -> waiting
- quest_step == "report_back": -> payday
- else: -> after
}

= first_meeting
KAITO: No proszę. Chodzący trup z wraku na Siódmej.
KAITO: Ripperdoc mówił, że nie przeżyjesz nocy. Pomylił się. Zdarza mu się.
* [Kim jesteś?]
    SEKI: Kim ty jesteś?
    KAITO: Kaito. Załatwiam sprawy. A ty, jak słyszę, nie pamiętasz nawet, jak się nazywasz.
* [Co mi się stało?]
    SEKI: Co mi się stało?
    KAITO: Wypadek. Twoje auto, czyjś dron, dużo chromu na asfalcie. Resztę musisz sobie przypomnieć sama.
- KAITO: Potrzebujesz imienia. Ulica nie lubi pustych miejsc.
KAITO: Ratownicy mówili, że w tym wraku walczyłaś z pasami jak z wrogiem. Seki Senshi. Wojowniczka z kroniki wypadków.
* [Niech będzie. Seki Senshi.]
    ~ set_alias("Seki Senshi")
    ~ change_rep("fixers", 5)
    SEKI: Niech będzie. Na razie.
* [Moje imię gdzieś jest. Odzyskam je.]
    ~ set_alias("Seki Senshi")
    SEKI: Moje imię gdzieś jest. Odzyskam je.
    KAITO: Jasne. Do tego czasu jesteś Seki.
- KAITO: Masz dług u ripperdoca i zero perspektyw. Ja mam robotę.
KAITO: Kurier gangu Hebi siedzi w zaułku za myjnią, na północnym końcu ulicy. Nosi coś, co należy do moich klientów.
KAITO: Zdejmij go. Ma ochronę, więc nie idź tam na spacer.
~ set_flag("met_fixer")
-> END

= waiting
KAITO: Kurier dalej oddycha, Seki. Zaułek za myjnią, na północ.
* [Już idę.]
    -> END
* [Co wiesz o moim wypadku?]
    SEKI: Co wiesz o moim wypadku?
    KAITO: Mniej, niż byś chciała. Więcej, niż powiem za darmo. Najpierw robota.
    -> END

= payday
KAITO: Słyszałem strzały. I ciszę po nich. Lubię taką ciszę.
KAITO: Coś ci się przypomniało, prawda? Widzę po oczach.
* [Pamiętam, jak się strzela. Nie pamiętam skąd.]
    SEKI: Pamiętam, jak się strzela. Nie pamiętam skąd.
    KAITO: Mięśnie mają lepszą pamięć niż ludzie. Trzymaj się tego.
    ~ change_rep("fixers", 5)
* [Ile mi płacisz?]
    SEKI: Ile mi płacisz?
    KAITO: Tyle, ile ustaliliśmy. Zawodowiec. Podoba mi się.
- ~ change_rep("hebi", -15)
~ set_flag("reported_back")
KAITO: Przelew poszedł. Wróć jutro, będzie więcej.
KAITO: I jeszcze jedno, Seki. Ktoś już pytał o kobietę z wraku. Nie tylko ja się tobą interesuję.
-> END

= after
{
- contract_state == "cleared": -> contract_payday
- contract_state == "active": -> contract_running
- else: -> contract_offer
}

= contract_offer
{ contracts_done == 0:
    KAITO: Hebi nie wybaczą ci kuriera. To znaczy, że będą się kręcić po dzielnicy. A ja mam klientów, którzy płacą za ciszę.
- else:
    KAITO: Hebi znowu wystawili ludzi na moją ulicę. Robota czeka, {alias}.
}
{
- hebi_stance == "hostile":
    KAITO: Hebi rozpuścili wieść, że strzelają do ciebie bez gadania. Omijaj zaułki, jeśli nie masz w nich roboty.
- hebi_stance == "friendly":
    KAITO: Podobno Hebi już do ciebie nie strzelają. Nie przyzwyczajaj się.
}
{ fixers_stance == "friendly":
    KAITO: Klienci o ciebie pytają. Dla swoich mam lepsze stawki.
}
+ [Biorę robotę.]
    SEKI: Biorę.
    ~ accept_contract()
    KAITO: Lokalizację wysłałem ci na optykę. Wróć, jak będzie po wszystkim.
    -> END
+ [Jeśli chcesz lepszego sprzętu, idź do doktora Mori.]
    SEKI: Gdzie tu się można podrasować?
    KAITO: Klinika doktora Mori, naprzeciwko baru. Bierze gotówkę i nie zadaje pytań.
    -> contract_offer
+ [Nie dziś.]
    KAITO: Twoja strata. Hebi nie biorą wolnego.
    -> END
// Unlocked by the "stół" memory (act I, m3-echo.ink).
* { has_memory("operating_table") } [Co wiesz o Kagami Biotech?]
    SEKI: Co wiesz o Kagami Biotech?
    KAITO: Kupują od ludzi wspomnienia i sprzedają je bogatym, którzy chcą coś przeżyć bez ryzyka.
    KAITO: Ich kurierzy dobrze zarabiają. Dopóki nie zaczną pytać, co wiozą.
    -> contract_offer

= contract_running
KAITO: Kontrakt dalej otwarty. Cel: {contract_site}.
-> END

= contract_payday
KAITO: Czysta robota. Klienci są zadowoleni, a ja razem z nimi.
~ complete_contract()
{ quest_step == "echo_contract":
    KAITO: Hej. Gdzie odpłynęłaś? Patrzysz przeze mnie jak przez szybę.
}
{ contracts_done >= 2:
    KAITO: Zaczynasz mieć opinię, Seki. Ludzie pytają o kobietę z wraku, która nie chybia.
}
-> contract_offer

=== ume ===
{ civilians_stance == "hostile":
    UME: Nie podchodź do mnie. Widziałam, co robisz na tej ulicy.
    -> END
}
{ has_flag("ume_memory"):
    UME: Uważaj na siebie na dachach, dziecko. Tak jak kiedyś.
    { has_memory("courier_case") && not has_flag("ume_ren"):
        -> ren
    }
    -> END
}
UME: Widziałam, jak cię wyciągali z tego auta. Myślałam, że już po tobie.
{ quest_step == "find_fixer":
    UME: Jeśli szukasz roboty, Kaito stoi pod Neon Koi. Po prawej stronie ulicy.
}
* [Znałaś mnie wcześniej?]
    SEKI: Znałaś mnie wcześniej?
    UME: Każdy cię tu znał. Biegałaś po dachach z tym chłopakiem od Hebi, aż zrobiło się o was głośno.
    UME: Potem zniknęłaś na dwa lata. Aż do wczoraj.
    Przez moment czujesz deszcz na twarzy i krawędź dachu pod stopami.
    ~ unlock_memory("street_runner")
    ~ change_rep("civilians", 5)
    ~ set_flag("ume_memory")
    -> END
* [Muszę iść.]
    -> END
* { has_memory("courier_case") && not has_flag("ume_ren") } [Pamiętasz Rena?]
    -> ren_talk

// Unlocked by the "walizka" memory (act I, m3-echo.ink).
= ren
+ [Pamiętasz Rena?]
    -> ren_talk
+ [Muszę iść.]
    -> END

= ren_talk
SEKI: Pamiętasz chłopaka, z którym biegałam po dachach? Ren.
UME: Ren Odagiri. Szukał cię, kiedy zniknęłaś. Pół roku pytał o ciebie każdego na tej ulicy.
UME: Potem przyszli ludzie w czystych butach i też o ciebie pytali. Od tamtej pory nikt Rena nie widział.
~ set_flag("ume_ren")
~ change_rep("civilians", 3)
-> END
