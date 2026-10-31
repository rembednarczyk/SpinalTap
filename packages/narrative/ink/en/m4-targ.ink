// Seki Senshi, M4: the market on Podzamcze (Nowy Plac Targowy, ex Targ pod estakadą, ADR-0042).
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
    HANA: I won't sell you so much as a screw. Everyone at the market knows what you do on the street.
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
    HANA: New face. I'm Hana. I deal in parts, mostly the kind that fell off a truck.
    ~ set_flag("met_hana")
}
{
- civilians_stance == "friendly":
    HANA: {alias}, good to see you. Oyaji says with you around, the Hebi steer clear of the market.
- fixers_stance == "friendly":
    HANA: Kaito speaks well of you. He rarely does, so let's give it a go.
- else:
    HANA: I don't know you yet. Do something small for me, we'll see how it goes.
}
-> offer

= offer
{ not has_flag("dead:oyaji") && (game_hour >= 22 || game_hour < 8):
    HANA: Oyaji's already closed his stall. The Hebi come for him by day, when he's got the takings.
}
+ [What needs recovering? #tone:main]
    SEKI: What needs recovering?
    ~ offer_contract("retrieve")
    HANA: The Hebi took a crate of my stock. They keep it under the viaduct, by the east wall of the hall, and a few boys guard it.
    HANA: Come back with the crate. What you do about the guards is your business.
    -> END
+ { not has_flag("dead:oyaji") && game_hour >= 8 && game_hour < 22 } [Anyone need protecting? #tone:main]
    SEKI: Anyone need protecting?
    ~ offer_contract("protect")
    HANA: Oyaji didn't pay the Hebi this month and they're coming for him right now. Watch him until the last of them drops.
    -> END
+ [Not now. #tone:leave]
    HANA: I'll be by my cart, between the stalls.
    -> END

= delivery
HANA: From Kaito? Hand it over before it warms up.
~ deliver_contract()
Hana checks the seals and slides the box under the tarp.
HANA: Cold, all good. I'll let Kaito know, collect your pay from him.
-> END

= delivered
HANA: I've got the package already. Go to Kaito for the money, it's his run.
-> END

= running
{ contract_kind == "retrieve":
    HANA: The crate's still with the Hebi, under the viaduct by the east wall.
- else:
    HANA: The Hebi are in the market already. Don't stand by me, watch Oyaji!
}
{ contract_variation != "":
    HANA: I heard something else between the stalls. {contract_variation}
}
-> END

= payday
{ contract_kind == "retrieve":
    HANA: There's my crate. Seals intact, they didn't even look inside.
- else:
    HANA: Oyaji's alive. Already moaning that nobody will help him pick his stock up off the ground.
}
~ complete_contract()
HANA: {contract_reward} eddies, like we agreed.
{ civilians_stance == "friendly":
    HANA: The market people are starting to talk about you. So far, the good kind.
}
-> offer

= busy
HANA: You're working for Kaito right now. Finish with him, then come to me.
-> END
