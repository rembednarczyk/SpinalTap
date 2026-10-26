// Seki Senshi — M0: "Pierwsze zlecenie".
// Speaker prefix convention: "KAITO: ...", "SEKI: ...", "UME: ...". Lines without a prefix are narration.
// Variables below are synced from the domain before each conversation (see narrative-runtime.ts).

VAR quest_step = ""
VAR alias = ""

EXTERNAL set_flag(name)
EXTERNAL has_flag(name)
EXTERNAL change_rep(faction, delta)
EXTERNAL set_alias(name)
EXTERNAL unlock_memory(id)

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
KAITO: Na dziś koniec, {alias}. Odpocznij, póki możesz.
-> END

=== ume ===
{ has_flag("ume_memory"):
    UME: Uważaj na siebie na dachach, dziecko. Tak jak kiedyś.
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
