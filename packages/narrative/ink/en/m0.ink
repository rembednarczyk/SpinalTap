// Seki Senshi, M0: "Pierwsze zlecenie".
// Speaker prefix convention: "KAITO: ...", "SEKI: ...", "UME: ...". Lines without a prefix are narration.
// Variables below are synced from the domain before each conversation (see narrative-runtime.ts).

VAR quest_step = ""
VAR alias = ""
VAR contract_state = ""
VAR contract_site = ""
// The rolled variation of the running contract as one or two sentences (ADR-0032), "" without one.
VAR contract_variation = ""
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
- quest_step == "kaito_job" && not has_flag("kagami_job"): -> ren_job
- else: -> after
}

// The opening (ADR-0038, G-034): Seki comes round in Mori's clinic and finds Kaito at the Neon Koi counter.
= first_meeting
KAITO: Well, look at that. The walking corpse from the wreck on Krakowskie.
The pink neon over the bar buzzes like a fly. It smells of rice beer and burnt chrome. Kaito hooks a stool out for you with his foot.
KAITO: The ripperdoc said you wouldn't last the night. He was wrong. It happens.
KAITO: He pulled half a meter of someone else's cable out of you. Makes you wonder whose.
* [Who are you? #tone:main]
    SEKI: Who are you?
    KAITO: Kaito. I fix things. And you, I hear, don't even remember your own name.
* [What happened to me? #tone:main]
    SEKI: What happened to me?
    KAITO: An accident. Your car, somebody's drone, a lot of chrome on the asphalt. The rest you'll have to remember yourself.
    KAITO: I'm Kaito, since you didn't ask. I fix things.
- KAITO: You need a name. The street doesn't like empty spaces.
KAITO: The medics said you fought those seat belts like they owed you money. Seki Senshi. The warrior from the crash reports.
* [Fine. Seki Senshi. #tone:main]
    ~ set_alias("Seki Senshi")
    ~ change_rep("fixers", 5)
    SEKI: Fine. For now.
* [My name's out there. I'll get it back. #tone:main]
    ~ set_alias("Seki Senshi")
    SEKI: My name's out there somewhere. I'll get it back.
    KAITO: Sure. Until then, you're Seki.
- KAITO: I paid for your patch-up, so you owe me. And you've got zero prospects. I've got work.
KAITO: A Hebi courier's holed up in the yard behind the car wash, past Plac Łokietka, off Przystankowa. He's carrying something that belongs to my clients.
KAITO: Take him out. He's got protection, so don't treat it like a stroll. Then come back here, to the Neon Koi. I'll be at the bar.
~ set_flag("met_fixer")
-> END

= waiting
KAITO: The courier's still breathing, Seki. The yard behind the car wash, past Plac Łokietka.
* [On my way. #tone:leave]
    -> END
* [What do you know about my crash? #tone:optional]
    SEKI: What do you know about my crash?
    KAITO: Less than you'd like. More than I'll say for free. Job first.
    -> END

= payday
KAITO: I heard shots. And the quiet after. I like that kind of quiet.
KAITO: Something came back to you, didn't it? I can see it in your eyes.
* [I remember how to shoot. Not where from. #tone:main]
    SEKI: I remember how to shoot. I don't remember where I learned.
    KAITO: Muscles have better memories than people. Hold on to that.
    ~ change_rep("fixers", 5)
* [How much are you paying me? #tone:main]
    SEKI: How much are you paying me?
    KAITO: Whatever a Hebi courier is worth. You'd rather talk money than memories? A professional. I like it.
- ~ change_rep("hebi", -15)
~ set_flag("reported_back")
KAITO: Transfer's gone through. Come back tomorrow, there'll be more.
KAITO: One more thing, Seki. Someone's already been asking about the woman from the wreck. I'm not the only one interested in you.
-> END

= after
{
- contract_giver == "hana": -> busy_for_hana
- contract_state == "cleared": -> contract_payday
- contract_kind == "delivery": -> delivery_running
- contract_state == "active": -> contract_running
- else: -> contract_offer
}

= contract_offer
{ contracts_done == 0:
    KAITO: The Hebi won't forgive you that courier. Means they'll be prowling Krakowskie. And I've got clients who pay for quiet.
- else:
    KAITO: The Hebi put people on my street again. Work's waiting, {alias}.
}
{
- hebi_stance == "hostile":
    KAITO: The Hebi have put the word out: they shoot you on sight. Stay out of the alleys unless you've got business there.
- hebi_stance == "friendly":
    KAITO: I hear the Hebi don't shoot at you anymore. Don't get used to it.
}
{ fixers_stance == "friendly":
    KAITO: Clients ask about you. I've got better rates for my own.
}
{
- act2_ending == "kagami" && not has_flag("kaito_after_act2"):
    KAITO: Kagami paid for Ren down to the last eddie. I won't ask how you feel about it.
    ~ set_flag("kaito_after_act2")
- (act2_ending == "street" || act2_ending == "hebi") && not has_flag("kaito_after_act2"):
    KAITO: Kagami tore up my contract over your stunt on the viaduct. Lucky the Hebi and the street pay cash.
    ~ set_flag("kaito_after_act2")
}
{ contracts_done >= 1 && not has_flag("met_hana"):
    KAITO: Hana trades on Podzamcze, at Nowy Plac Targowy. She takes stock from me, and sometimes she's after someone who can shoot.
}
-> contract_menu

// The choices alone: side questions come back here without repeating Kaito's opening lines.
= contract_menu
+ [I'll take the job. #tone:main]
    SEKI: I'm in.
    ~ accept_contract()
    KAITO: Location's on your optics. Come back when it's done.
    -> END
+ { contracts_done >= 1 } [Got anything to haul? #tone:main]
    SEKI: Got anything that needs hauling?
    ~ offer_contract("delivery")
    KAITO: Cooled modules for Hana, at the market on Podzamcze. If they warm up, nobody pays for them.
    KAITO: The clock's on your optics. Hand the package to Hana and come back to me for the money.
    -> END
+ [Where can I get upgraded? #tone:optional]
    SEKI: Where can a girl get upgraded around here?
    KAITO: If you want better hardware, go see Doc Mori. Clinic across from the bar. Takes cash and asks no questions.
    -> contract_menu
+ [Not today. #tone:leave]
    KAITO: Your loss. The Hebi don't take days off.
    -> END
// Unlocked by the "stół" memory (act I, m3-echo.ink).
* { has_memory("operating_table") } [What about Kagami Biotech? #tone:lifepath]
    SEKI: What do you know about Kagami Biotech?
    KAITO: They buy memories off people and sell them to the rich, who want to live a little without the risk.
    KAITO: Their couriers make good money. Until they start asking what they're carrying.
    -> contract_menu

= contract_running
KAITO: The contract's still open. Target: {contract_site}.
{ contract_variation != "":
    KAITO: One more thing before you go. {contract_variation}
}
-> END

// Act II (m3-lustro.ink): the hook from a fixer job into the main thread.
= ren_job
KAITO: Sit down, {alias}. I've got a job you won't like.
KAITO: A client in clean shoes is paying five grand for Ren Odagiri and the case of chips he's sitting on. Alive or not, as long as the case comes too.
{ choice_rooftop == "together":
    Five grand. Almost what Kagami promised the two of you for that run.
}
KAITO: Listen, it's their message. Came in yesterday.
Kaito plays the recording. It's Ren, calm and a little too even: a handover tonight, on the viaduct over aleja Tysiąclecia, by the market.
KAITO: Your boy's setting up meets with Kagami himself. Or someone's talking with his voice.
* [I'm not hunting Ren. #tone:main]
    ~ choice_job = "refused"
    ~ story_choice("job", "refused")
    SEKI: I'm not hunting Ren. Find someone else.
    KAITO: I will. So will Kagami. Their man, Kurosawa, is waiting on the viaduct tonight.
    ~ change_rep("fixers", -3)
* [I'm in. I want to see this client. #tone:main]
    ~ choice_job = "taken"
    ~ story_choice("job", "taken")
    SEKI: I'm in. I want to see this client.
    KAITO: Sensible. His name's Kurosawa and he's waiting on the viaduct. Just don't turn it into a war, he's my client.
    ~ change_rep("fixers", 3)
- ~ set_flag("kagami_job")
-> END

= delivery_running
KAITO: Those modules should be with Hana by now. The market on Podzamcze, down through Stare Miasto and Brama Grodzka.
{ contract_time_left > 0:
    KAITO: You've got {contract_time_left} s left. Don't stand around.
}
{ contract_variation != "":
    KAITO: And remember. {contract_variation}
}
-> END

= busy_for_hana
KAITO: I hear you're doing something for Hana. Finish with her, then we'll talk.
-> END

= contract_payday
{ contract_kind == "delivery":
    KAITO: Hana says the modules arrived cold. That's how every run should look.
- else:
    KAITO: Clean work. The clients are happy, and so am I.
}
~ complete_contract()
{ quest_step == "echo_contract":
    KAITO: Hey. Where'd you drift off to? You're looking through me like a window.
}
{ contracts_done >= 2:
    KAITO: You're getting a reputation, Seki. People ask about the woman from the wreck who never misses.
}
-> contract_offer

=== ume ===
{ civilians_stance == "hostile":
    UME: Don't come near me. I've seen what you do on this street.
    -> END
}
// After 23:00 she stands in her doorway (daily schedule, ADR-0017).
{ game_hour >= 23 || game_hour < 6:
    UME: Can't sleep, child? Me neither. At my age the night's too long.
}
{ quest_step == "ren_trail":
    -> ren_trail
}
{ act2_ending == "street" && not has_flag("ume_archive"):
    UME: Mrs. Sato got a chip with her husband's voice. She listens to it every evening by the open window.
    UME: I don't know if it helps her. But at least that voice belongs to her.
    ~ set_flag("ume_archive")
    -> END
}
{ has_flag("ume_memory"):
    UME: Mind yourself on those rooftops, child. Like you used to.
    { has_memory("courier_case") && not has_flag("ume_ren"):
        -> ren
    }
    -> END
}
UME: I saw them pull you out of that car. I thought you were gone.
{ quest_step == "find_fixer":
    UME: Kaito sat up all night at Doctor Mori's, by your chair. Now he's waiting for you at the Neon Koi, across the promenade.
}
* [Did you know me before? #tone:main]
    SEKI: Did you know me before?
    UME: Everyone knew you here. You ran the rooftops with that Hebi boy until the whole street talked about you two.
    UME: Then you vanished for two years. Until yesterday.
    For a moment you feel rain on your face and the edge of a roof under your feet.
    ~ unlock_memory("street_runner")
    ~ change_rep("civilians", 5)
    ~ set_flag("ume_memory")
    -> END
* [I have to go. #tone:leave]
    -> END
* { has_memory("courier_case") && not has_flag("ume_ren") } [Do you remember Ren? #tone:lifepath]
    -> ren_talk

// Unlocked by the "walizka" memory (act I, m3-echo.ink).
= ren
+ [Do you remember Ren? #tone:lifepath]
    -> ren_talk
+ [I have to go. #tone:leave]
    -> END

// Act II (m3-lustro.ink): Ren is back and hiding.
= ren_trail
{ story_ending == "aya":
    UME: You heard him, didn't you? It's written all over your face.
- else:
    UME: You're looking for someone. I see the way you watch the rooftops.
}
+ [Where do I find Ren Odagiri? #tone:main]
    SEKI: Where do I find Ren Odagiri?
    UME: He came back a week ago. Thin, unshaven, nothing like the boy from two years back.
    UME: He sleeps on the roof over the market on Podzamcze, by the viaduct. You go up the fire stairs from the stalls.
    { has_flag("ume_ren"):
        UME: I told you he looked for you for half a year. Now he's the one hiding.
    }
    ~ set_flag("ren_trail")
    ~ change_rep("civilians", 2)
    -> END
+ [Never mind. #tone:leave]
    UME: When you want to talk, you know where I stand.
    -> END

= ren_talk
SEKI: Do you remember a boy called Ren? I see him in my memories. We used to haul things together.
UME: Ren Odagiri, the Hebi boy you ran the rooftops with. He looked for you when you vanished. Half a year he asked everyone on this street about you.
UME: Then people in clean shoes came asking about you too. Nobody's seen Ren since.
~ set_flag("ume_ren")
~ change_rep("civilians", 3)
-> END

// Neon Koi (ADR-0038): the barman behind the counter and the regulars at the tables.
=== koi_barman ===
{ quest_step == "find_fixer":
    BARMAN: Kaito? He's at the bar. Gone all night, waiting at Mori's for some girl from a wreck. I'd guess you.
    -> END
}
BARMAN: Neon Koi. You drink or you listen, both count.
{ hebi_stance == "hostile":
    BARMAN: And don't shoot Hebi in here. I clean up after them more than after the customers.
}
* [What do you recommend? #tone:optional]
    SEKI: What do you recommend?
    BARMAN: Synthetic sake. Tastes like the real thing, if you've never had the real thing.
    -> END
* [Nothing, thanks. #tone:leave]
    -> END

=== koi_regular ===
{ civilians_stance == "hostile":
    BYWALEC: Back off. I've heard what you do on this street.
    -> END
}
{ has_flag("reported_back"):
    BYWALEC: You're the one who took down that courier by the car wash? I'd buy you a drink, but the Hebi have ears in here.
- else:
    BYWALEC: The jukebox plays three songs on rotation and a Motor chant. That last one's the loudest, especially after a match.
}
-> END
