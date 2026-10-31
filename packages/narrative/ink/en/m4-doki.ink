// Seki Senshi, M4: Nabrzeże Bystrzycy, ex Doki Tessen (ADR-0024, ADR-0042).
// Genzō runs boats on the Bystrzyca for Kaito's network. He hands out three jobs against Tessen,
// the corporation that owns the riverside warehouses and the crane: walking a defector to his boat, copying data from the
// Tessen office unseen, holding a hacked terminal. The domain decides and pays; ink only talks.

// Synced like the other factions' stances before each conversation.
VAR tessen_stance = "neutral"

=== genzo ===
{ fixers_stance == "hostile":
    GENZO: Kaito says not to talk to you. On the riverside, you listen to Kaito.
    -> END
}
{
- contract_giver == "genzo" && contract_state == "cleared": -> payday
- contract_giver == "genzo": -> running
- contract_state != "": -> busy
}
-> greeting

= greeting
{ not has_flag("met_genzo"):
    GENZO: You're Kaito's? Genzō. I run boats at night, and Tessen pays people not to see them.
    GENZO: The riverside is theirs, the Bystrzyca is mine. Sometimes I need someone on dry land.
    ~ set_flag("met_genzo")
- else:
    GENZO: Thick fog off the river tonight. Good night for work.
}
{ tessen_stance == "hostile":
    GENZO: Tessen security knows your face now. Watch the rooftops, they keep shooters up there.
}
-> offer

= offer
+ [Who needs walking out? #tone:main]
    SEKI: Who needs walking out?
    ~ offer_contract("escort")
    GENZO: Mika, a bookkeeper from the Tessen office. Knows too much and wants to disappear. She's waiting by my container.
    GENZO: Walk her to the pier, to the boat. Tessen will hunt her along the riverside, so stay close.
    -> END
+ [What do I lift from Tessen? #tone:main]
    SEKI: What do I need to lift from the Tessen office?
    ~ offer_contract("infiltrate")
    GENZO: Cargo manifests, off the terminal on the desk. The office is on the riverside, door on the crane side.
    GENZO: Nobody can see you. One alarm and the data's wiped before you get there. Stay low and behind their backs.
    -> END
+ [Which terminal do I crack? #tone:main]
    SEKI: Which terminal do I crack?
    ~ offer_contract("hack")
    GENZO: The Tessen terminal under the crane by the river. You jack in and hold out next to it until it's done.
    GENZO: Security comes straight away, and there's a shooter on the warehouse roof. Red laser means you've got a second to find cover.
    -> END
+ [Not now. #tone:leave]
    GENZO: I'll be by the container. The boat doesn't leave without a reason.
    -> END

= running
{
- contract_kind == "escort":
    GENZO: Mika's waiting for you. Don't leave her alone on the riverside.
- contract_kind == "infiltrate":
    GENZO: The data's still in the office. Remember, low and quiet.
- else:
    { contract_time_left > 0:
        GENZO: The terminal's still grinding. Get back there, {contract_time_left} seconds left.
    - else:
        GENZO: The terminal under the crane. Jack in and don't walk away.
    }
}
{ contract_variation != "":
    GENZO: The riverside folks say this. {contract_variation}
}
-> END

= payday
{
- contract_kind == "escort":
    GENZO: Mika's on board. By morning she'll be across Zalew Zemborzycki.
- contract_kind == "infiltrate":
    GENZO: Clean data and nobody saw a thing. Kaito will be pleased.
- else:
    GENZO: Terminal cracked. For a week my boats are invisible to Tessen.
}
~ complete_contract()
GENZO: {contract_reward} eddies. Counted under the lamp, it all adds up.
-> offer

= busy
GENZO: You've already got a job. Finish it, then come back to the Bystrzyca.
-> END
