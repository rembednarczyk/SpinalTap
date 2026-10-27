// Seki Senshi, M4: Targ pod estakadą.
// Hana sells parts from a handcart in the market. She hands out her own jobs (retrieve, protect)
// and takes Kaito's deliveries. The domain decides what a job is and pays for it; ink only talks.

// Synced from the running contract before each conversation (empty / 0 without one).
VAR contract_kind = ""
VAR contract_giver = ""
VAR contract_reward = 0
// Whole seconds until a delivery deadline, 0 for other jobs.
VAR contract_time_left = 0

EXTERNAL offer_contract(kind)
EXTERNAL deliver_contract()

=== hana ===
{ civilians_stance == "hostile":
    HANA: Nie sprzedam ci nawet śrubki. Na targu wszyscy wiedzą, co robisz na ulicy.
    -> END
}
{
- contract_kind == "delivery" && contract_state == "active": -> delivery
- contract_giver == "hana" && contract_state == "cleared": -> payday
- contract_giver == "hana": -> running
- contract_kind == "delivery": -> delivered
- contract_state != "": -> busy
}
-> greeting

= greeting
{ not has_flag("met_hana"):
    HANA: Nowa twarz. Jestem Hana. Handluję częściami, głównie takimi, które spadły z ciężarówki.
    ~ set_flag("met_hana")
}
{
- civilians_stance == "friendly":
    HANA: {alias}, dobrze, że jesteś. Oyaji mówi, że przy tobie Hebi omijają targ.
- fixers_stance == "friendly":
    HANA: Kaito dobrze o tobie mówi. Rzadko mu się to zdarza, więc spróbujmy.
- else:
    HANA: Jeszcze cię nie znam. Zrób dla mnie coś małego, zobaczymy, jak pójdzie.
}
-> offer

= offer
{ not has_flag("dead:oyaji") && (game_hour >= 22 || game_hour < 8):
    HANA: Oyaji już zamknął stragan. Hebi przychodzą do niego za dnia, kiedy ma utarg.
}
+ [Co trzeba odzyskać?]
    SEKI: Co trzeba odzyskać?
    ~ offer_contract("retrieve")
    HANA: Hebi zabrali mi skrzynkę z towarem. Trzymają ją pod estakadą, przy wschodniej ścianie, i pilnuje jej kilku chłopaków.
    HANA: Wróć ze skrzynką. Co zrobisz ze strażnikami, to już twoja sprawa.
    -> END
+ { not has_flag("dead:oyaji") && game_hour >= 8 && game_hour < 22 } [Ktoś potrzebuje ochrony?]
    SEKI: Ktoś potrzebuje ochrony?
    ~ offer_contract("protect")
    HANA: Oyaji nie zapłacił Hebi w tym miesiącu i właśnie po niego idą. Pilnuj go, aż padnie ostatni z nich.
    -> END
+ [Nie teraz.]
    HANA: Będę przy wózku, między straganami.
    -> END

= delivery
HANA: Od Kaito? Dawaj, zanim się nagrzeje.
~ deliver_contract()
Hana sprawdza plomby i wsuwa pudełko pod plandekę.
HANA: Zimne, w porządku. Dam znać Kaito, zapłatę odbierzesz u niego.
-> END

= delivered
HANA: Paczkę już mam. Po pieniądze idź do Kaito, to jego kurs.
-> END

= running
{ contract_kind == "retrieve":
    HANA: Skrzynka dalej jest u Hebi, pod estakadą przy wschodniej ścianie.
- else:
    HANA: Hebi są już na targu. Nie stój przy mnie, pilnuj Oyaji!
}
-> END

= payday
{ contract_kind == "retrieve":
    HANA: Jest moja skrzynka. Plomby całe, nawet nie zajrzeli do środka.
- else:
    HANA: Oyaji żyje. Już narzeka, że nikt mu nie pomoże zbierać towaru z ziemi.
}
~ complete_contract()
HANA: {contract_reward} eddies, tak jak się umawiałyśmy.
{ civilians_stance == "friendly":
    HANA: Ludzie z targu zaczynają o tobie mówić. Na razie dobrze.
}
-> offer

= busy
HANA: Robisz teraz dla Kaito. Skończ u niego, potem przyjdź do mnie.
-> END
