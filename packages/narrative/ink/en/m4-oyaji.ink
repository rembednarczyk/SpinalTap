// Seki Senshi, E10: Oyaji's stall on the market on Podzamcze, 8:00 to 22:00 (plan §6, ADR-0015).
// The shop panel opens first; "Porozmawiaj z Oyajim" leads here. At night the schedule swaps
// his interaction for `oyaji_closed` (day-cycle.ink). Prices live in the domain, ink only talks.

=== oyaji ===
{ not has_flag("met_oyaji"):
    OYAJI: Oyaji. That's what they call me at the market, so you call me that too.
    ~ set_flag("met_oyaji")
}
{
- civilians_stance == "hostile":
    OYAJI: I can trade with you, I don't have to like you. People say you shoot first and ask later.
    OYAJI: So you pay more, and you get less for your junk.
- civilians_stance == "friendly":
    OYAJI: {alias}! I'll always set something aside for you. Since you've been coming round, the Hebi drop by less.
- else:
    OYAJI: I buy scrap, sell ammo, patch jackets. The rest is none of my business.
}
-> talk

= talk
+ [What do you buy? #tone:optional]
    SEKI: What do you buy?
    OYAJI: Anything you can take apart. Scrap and chips at full price, the rest for a quarter.
    OYAJI: Don't sell weapon parts. Bring them in with a torn jacket and I'll knock down the repair price.
    -> talk
+ [Got a bigger backpack? #tone:optional]
    SEKI: Got a bigger backpack?
    OYAJI: I've got two. One for six hundred, one for twelve hundred. After that, it's suitcases.
    -> talk
+ { not has_flag("oyaji_hebi") } [Do the Hebi give you trouble? #tone:optional]
    SEKI: Do the Hebi give you trouble?
    ~ set_flag("oyaji_hebi")
    { civilians_stance == "friendly":
        OYAJI: Less than they used to. Hana says that's your doing. I won't argue.
    - else:
        OYAJI: Every month they want their cut. If I don't pay, they come by daylight, in front of people.
    }
    -> talk
+ [That's all for now. #tone:leave]
    OYAJI: The stall's open till ten. Then the shutter comes down.
    -> END
