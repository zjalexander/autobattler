# Autobattler Design Notes: Unit Synergy

## Short Version

Autobattlers live or die on synergy design. The player is not directly controlling combat, so the main skill expression is choosing units, recognizing build paths, pivoting when the shop changes, positioning correctly, and understanding when a partial synergy is better than a deeper one.

Good unit synergy should:

- Create direction without solving the whole team for the player.
- Offer multiple viable paths, not one required final board.
- Reward adaptation to shops, items, opponents, and economy.
- Make partial, splash, and deep investments all useful at different times.
- Keep combat readable enough that players understand why the synergy worked.
- Leave room for counterplay through positioning, itemization, tech units, or pivoting.

The healthiest target is not "every trait is equally strong." It is "many different comps can succeed, and each game creates different drafting decisions."

## Key Game Elements to Build

Core systems:

- Unit roster: Define units with cost, stats, ability, traits, role, rarity/tier, upgrade path, and item slots.
- Unit shop: Offer a small randomized set of units each round, usually weighted by player level and unit rarity.
- Buying and selling: Let players purchase units, sell them for gold, and manage limited bench space.
- Rerolls: Let players spend currency to refresh the unit shop, creating a tradeoff between economy and finding upgrades.
- Leveling: Let players spend currency or XP to increase board size and improve odds for higher-tier units.
- Team board: Provide a grid or formation area where players place active units.
- Bench: Store extra units for future upgrades, pivots, and trait completion.
- Unit upgrades: Combine duplicate units into stronger versions, usually with increased stats and sometimes better abilities.
- Trait display: Show active traits, inactive traits, current counts, next breakpoints, and which units contribute.
- Trait tooltips: Explain each trait's effects at every breakpoint and highlight missing units that could complete it.
- Item system: Include item drops, an item shop, or item crafting; items should be equippable, inspectable, and movable only under clear rules.
- Item shop or armory: Offer players a small selection of items or components at controlled moments so itemization becomes a strategic choice.
- Economy rules: Define income, interest, streak rewards, reroll cost, leveling cost, round rewards, and comeback mechanics.
- Combat simulator: Resolve automatic battles deterministically enough to debug, with clear targeting, movement, attack, casting, death, summon, and overtime rules.
- Opponent system: Match players against live opponents, ghosts, bots, or asynchronous saved teams.
- Combat log or recap: Summarize damage, healing, shielding, trait impact, and key unit performance after each fight.
- Scouting UI: Let players inspect opponent boards, traits, items, economy, health, and likely threats.
- Positioning tools: Support drag-and-drop placement, swapping, lock/unlock controls, and clear valid/invalid board slots.
- Planning tools: Let players mark target units, preview trait changes, compare shop options, and see what a purchase would activate.
- Progression state: Track player health, round number, gold, level, XP, board cap, win/loss streak, owned units, items, and active effects.
- Tutorial/onboarding: Teach buying, rerolling, upgrading, traits, items, positioning, economy, and combat resolution in small steps.
- Balance/debug tools: Provide simulation controls, unit stat inspection, trait activation checks, shop odds display, and battle replay seeds.

Minimum viable loop:

```text
start round
show shop
player buys/sells/rerolls/levels/positions units
display active traits and item choices
lock board
simulate combat
show result and recap
pay rewards and apply damage
advance round
```

## Core Design Pillars

### Discovery

Autobattlers are strongest when players are still discovering what is possible. Riot's TFT design posts emphasize mastery, playful competition, and discovery as core pillars, and their set model exists largely to refresh champion and trait combinations before the metagame becomes solved.

Design implication:

- Rotate, remix, or periodically refresh units and synergies.
- Use themes to make new synergy packages memorable.
- Let old fundamentals carry forward so players feel mastery, not total reset.
- Avoid static rosters that reduce into repeated build rehearsals.

### Mastery

Mastery should come from several overlapping skills:

- Reading shops and probability.
- Knowing trait breakpoints.
- Managing economy and timing.
- Identifying carries, item holders, and transition units.
- Scouting opponents.
- Positioning against likely threats.
- Knowing when to commit, pivot, level, roll, or sell.

Synergy systems should support these skills instead of replacing them with a rigid recipe.

### Playful Competition

Autobattlers are often more forgiving than direct duel games because only one player wins, but several players can still feel successful if they placed well, hit an unusual comp, or made a clever pivot. Synergies should support expressive builds, not just the single optimal tournament comp.

## Synergy Architecture

### Think in a Synergy Graph

Model the roster as a graph:

- Nodes: units, traits, items, augments, classes, origins, keywords, positions.
- Edges: "works with," "enables," "counters," "shares trait," "needs item," "protects," "scales with."

A healthy graph has clusters, bridges, and flex nodes. An unhealthy graph has isolated cliques where one trait only plays with itself.

Useful graph goals:

- Every unit should have at least two plausible homes.
- Every major trait should have more than one carry or payoff.
- Every carry should have more than one support shell.
- Every support trait should be splashable in more than one comp.
- Some units should bridge otherwise separate traits.
- Some traits should invite pivots rather than lock the player in.

### Use Major and Minor Traits

Major traits are vertical investments: 4/6/8 units, full-team transformations, chase payoffs, or identity-defining mechanics.

Minor traits are horizontal or splash investments: 2/3 units, utility bonuses, defensive packages, tech counters, or role enablers.

Best practice:

- Make deep verticals exciting but not mandatory.
- Make minor splashes meaningfully useful.
- Let players win with a deep trait, several small traits, or a hybrid.
- Avoid traits that are "6 or bust" unless that all-in identity is intentional and balanced.

Riot's Galaxies learnings called out this exact issue: some traits supported many build shapes, while others locked players into a narrow breakpoint and reduced flexibility.

### Build Trait Types Deliberately

Common trait categories:

- Vertical combat trait: rewards many units of the same identity.
- Splash utility trait: small bonus that patches a weakness.
- Economy trait: trades short-term board strength for long-term payoff.
- Risk/cashout trait: encourages lose-streaking, greed, or delayed reward.
- Position trait: changes where units want to stand.
- Tech/counter trait: answers damage type, healing, shields, backline threats, summons, or crowd control.
- Summon/token trait: creates extra bodies or death triggers.
- Scaling trait: grows during combat, across rounds, or with investment.
- Chase trait: very hard to hit, very powerful, often needs a special emblem or rare unit.

Each trait should have a clear thesis. If two traits solve the same problem in the same way, one of them usually needs a sharper hook.

## Unit Roles

### Give Units a Drafting Job

Every unit should justify its place in the shop. Typical jobs:

- Carry: primary damage or win condition.
- Tank: buys time and shapes enemy targeting.
- Bruiser: frontliner that also threatens damage.
- Utility: crowd control, anti-heal, shred, shield, mana, repositioning.
- Enabler: makes another unit, trait, or item work.
- Bridge: connects traits and enables pivots.
- Item holder: carries early items before a late-game replacement.
- Tech unit: situational answer to a common board.
- Economy unit: converts board choices into resources.
- Flexible plug-in: useful without requiring trait commitment.

Avoid too many units whose only job is "trait count." A unit can be low-cost or transitional, but it should still do something legible.

### Respect Cost and Star Expectations

Players expect higher-cost upgraded units to usually outperform lower-cost upgraded units. You can break that rule occasionally for reroll strategies, but if low-cost units routinely beat expensive upgraded units without a clear reason, the game feels arbitrary.

Useful pattern:

- 1-cost: early direction, simple hooks, item holders, reroll seeds.
- 2-cost: bridge pieces, early carries, tempo units.
- 3-cost: midgame anchors and flexible transition carries.
- 4-cost: major carries, premium tanks, comp-defining units.
- 5-cost: rare capstones, high-impact utility, flexible legends.

Riot's TFT learnings repeatedly discuss the importance of satisfying carries across cost buckets and matching power to player expectations.

### Include Flex Units, But Budget Them Carefully

Flexible units are important because they let players survive awkward shops and pivot. TFT's "Threat" style champions are a good reference: they provided utility or damage without locking the player into a trait direction.

The risk is auto-inclusion. If a flexible unit is always correct, it compresses the meta. Flex units should be broadly useful but still context-sensitive.

Good flex constraints:

- Strong utility, moderate raw stats.
- Clear item preferences.
- Positional weaknesses.
- Counters in common trait families.
- Strong at one stage, weaker later unless upgraded.
- Competes with trait-completion slots.

## Trait Breakpoints

### Breakpoints Are the Main Synergy Lever

Breakpoint design controls commitment:

```text
2-piece: signal, splash, early direction
3/4-piece: stable midgame identity
5/6-piece: committed composition
7/8/9-piece: chase fantasy or rare capstone
```

Each breakpoint should answer:

- Is this meant to be splashable or committal?
- Can this be reached naturally at the intended stage?
- What does the player give up to reach it?
- Is the payoff visible in combat?
- Can the opponent respond?
- Does an emblem, augment, or wildcard break the timing?

### Be Careful With +1 Trait Effects

Anything that grants an extra trait count can break your balance. Trait +1s, emblems, wildcards, chosen units, augments, portals, and special shops all accelerate access to breakpoints.

Best practice:

- Budget deep trait power assuming the earliest possible +1 access.
- Gate powerful breakpoints behind cost, rarity, or opportunity cost.
- Test "early high-roll" cases, not only average cases.
- Remove or disable +1 access for traits whose chase tier cannot tolerate it.
- Prefer +1 effects that open sidegrades, not automatic best boards.

Riot's Monsters Attack! learnings specifically call out problems caused by Augments that gave early access to powerful deep trait thresholds.

### Make Partial Investment Useful

A trait that is useless until maxed creates forced play. A trait that is too strong at 2 pieces becomes a mandatory splash.

Aim for:

- Low breakpoint: useful, not defining.
- Middle breakpoint: build-around.
- High breakpoint: strong fantasy with real cost.
- Chase breakpoint: rare, dramatic, and testable.

## Composition Variety

### Avoid Single-Solution Traits

A trait is too narrow when:

- It has exactly one carry.
- It has exactly one required tank.
- It needs a specific item to function.
- It is weak until a late breakpoint.
- Its units share too many identical weaknesses.
- It cannot pivot into or out of another comp.

Fixes:

- Add a second carry with a different item profile.
- Add a bridge unit that shares a useful secondary trait.
- Add a low-cost utility piece that stabilizes early.
- Add a splash trait that patches the common weakness.
- Move some power from the final breakpoint into the middle breakpoint.
- Let the trait scale with board decisions rather than just unit count.

### Design Pivot Paths

Players should be able to start from an early signal and end in several places.

Example pattern:

```text
Early opener:
  2 Guardians + 2 Sparks

Possible pivots:
  Guardian vertical with armor scaling
  Spark caster comp
  Mixed frontline with 4-cost ranged carry
  Economy trait into legendary board
```

The key is overlap. If early units share no traits or item logic with later units, pivots feel like selling the whole board and starting over.

### Keep Items Flexible

Items should guide builds, not hard-lock them. Riot's Galaxies learnings note a goal that items should be flexible across compositions and strong in some comps without being mandatory.

Best practice:

- Give carries more than one viable item set.
- Give items more than one viable user.
- Avoid traits that only function with one specific item.
- Make early item holders a deliberate design category.
- Let defensive, utility, and economy items create alternative paths.

## Counterplay and Positioning

### Synergy Needs Weaknesses

Every strong synergy should have at least one answer:

- Burst beats slow scaling.
- Area damage beats clumped boards.
- Assassins/backline access beat unprotected carries.
- Anti-heal beats sustain.
- Shred/sunder beats resistance stacking.
- Crowd control beats single carry comps.
- Spread positioning beats splash damage.
- Tech tanks beat one damage type.

Prefer soft counters over hard counters. Hard counters can invalidate a player's whole game plan after 25 minutes of investment.

### Backline Access Is High Risk

Backline access creates exciting positioning puzzles, but it becomes frustrating when it reliably deletes the main carry immediately. Riot called this out in Monsters Attack!: backline access is interesting when it creates positioning challenges, but not when it consistently removes a 3-item carry in the first seconds.

Best practice:

- Give backline access windup, targeting rules, or counter-positioning.
- Make burst lower if access is highly reliable.
- Make access conditional on positioning or trait investment.
- Let defensive positioning, decoys, shields, or tech units answer it.
- Avoid "no-play" deaths where the player cannot learn what to change.

### Combat Must Explain the Synergy

Because combat is automatic, players need to understand why they won or lost.

Improve readability by:

- Making key casts visually distinct.
- Slowing or highlighting important projectiles.
- Showing trait activation clearly.
- Avoiding too much invisible power.
- Keeping damage/healing/shield events understandable.
- Giving post-combat summaries for major contributors.
- Avoiding simultaneous effects that hide cause and effect.

If a synergy is powerful but invisible, players may read it as random or unfair.

## Information Load

### Simple Pieces, Deep Combinations

Hearthstone Battlegrounds designers described a useful principle: individual pieces should be understandable quickly; depth should come from finding synergies between them, not from needing an encyclopedia for every piece.

Apply this to autobattlers:

- Keep unit text short.
- Use repeated keywords.
- Make trait icons and colors consistent.
- Group shop and planner information around active/potential synergies.
- Show which bench/shop units complete breakpoints.
- Reveal advanced math in tooltips, not primary text.
- Avoid too many conditional traits in the same set.

### UI Should Teach Synergy

Players need to see:

- Current active traits.
- Next breakpoints.
- Units that share each trait.
- Units missing from a planned comp.
- Whether an item or augment changes a breakpoint.
- Which units are contested by opponents.
- Combat role: frontline, carry, utility, economy, flex.

Bad synergy UI turns drafting into memorization. Good synergy UI lets players spend attention on judgment.

## Economy, RNG, and Drafting

### Randomness Should Create Adaptation

Shop RNG is valuable because it forces players to adapt. It becomes bad when:

- A player can force the same comp every game.
- A player loses because no viable pivot appeared.
- A rare early hit creates an unbeatable snowball.
- A trait has no fallback if one key unit never appears.

Best practice:

- Design multiple openers for each late-game family.
- Include item holders and bridge units.
- Tune shop odds around intended timing.
- Use shared pools or contesting to discourage everyone forcing the same build.
- Give comeback options through economy, streaks, or risk traits.

### Economy Traits Need Clear Risk/Reward

Economy and cashout traits are memorable, but they are dangerous because they distort normal board strength incentives.

Best practice:

- Make the risk visible.
- Make cashouts exciting but bounded.
- Avoid drip rewards that are always correct.
- Avoid cashouts that are impossible to balance except by being boring.
- Test both high-roll and low-roll experiences.
- Make the player choose between tempo and greed.

## Balance and Testing

### Balance for Metagame Diversity

An AAAI paper on autobattler balance frames a healthy metagame around diverse lineups with similar overall win rates. This is a good practical target.

Track:

- Win rate by comp.
- Top-4 rate by comp.
- Pick rate by unit, trait, item, and augment.
- Stage where comp stabilizes.
- Average placement after hitting key breakpoint.
- Placement delta for contested vs uncontested comps.
- Carry damage share.
- Tank effective health share.
- Trait breakpoint timing.
- Frequency of pivots.
- Frequency of dead-end openers.

Do not only inspect final boards. Many balance problems happen earlier: openers, transitions, item holders, and midgame stabilization.

### Test With Bots, Scripts, and Humans

Automated simulation is especially useful for autobattlers because combat is already automated. Use bots/scripts to find outliers, then human testing to judge fun, readability, and frustration.

Automated tests can answer:

- Does this trait win too often when uncontested?
- Is this unit an auto-include?
- Does +1 access break a breakpoint?
- Which boards dominate round-robin simulations?
- Which unit is never bought?
- Which opener has no successful transitions?

Human tests should answer:

- Did players understand why they won or lost?
- Did the comp feel forced or discovered?
- Did the synergy fantasy land?
- Did the opponent have a believable answer?
- Did the pivot decisions feel fair?

## Practical Synergy Design Checklist

- [ ] Each unit has a role beyond adding trait count.
- [ ] Each unit has at least two plausible team homes.
- [ ] Each major trait has more than one possible carry or payoff.
- [ ] Deep verticals and wide splashes are both viable somewhere.
- [ ] Partial trait breakpoints are useful but not mandatory.
- [ ] +1 trait effects are tested against earliest possible timing.
- [ ] Flexible units are not automatic inclusions.
- [ ] Carries exist across multiple cost tiers.
- [ ] Low-cost reroll strategies do not violate cost expectations too often.
- [ ] Items guide builds without making traits nonfunctional without them.
- [ ] Strong synergies have soft counters.
- [ ] Backline access creates positioning play without instant no-play deaths.
- [ ] Combat effects are readable enough to explain wins and losses.
- [ ] UI shows active traits, next breakpoints, and potential completions.
- [ ] Bots or scripts test comp diversity and outlier boards.
- [ ] Human playtests check clarity, fun, frustration, and discovery.

## Common Mistakes

- Designing traits as isolated packages with no bridge units.
- Making the deepest breakpoint the only playable version of a trait.
- Letting the best strategy become "jam expensive units with no synergy."
- Making trait count more important than unit role, items, or positioning.
- Creating one mandatory carry for a whole trait.
- Adding too many conditional traits for players to track.
- Letting +1 trait effects hit chase tiers too early.
- Making flexible units so strong they appear in every board.
- Giving backline access too much burst and too little counterplay.
- Hiding most synergy power in invisible stats.
- Balancing final boards while ignoring openers and transitions.
- Relying only on live player data after players have suffered through an unhealthy meta.

## Sources

- [Riot: Design Pillars of TFT](https://teamfighttactics.leagueoflegends.com/en-gb/news/dev/dev-design-pillars-of-tft/)
- [Riot: TFT Galaxies Learnings](https://teamfighttactics.leagueoflegends.com/en-us/news/dev/dev-teamfight-tactics-galaxies-learnings/)
- [Riot: TFT Monsters Attack! Learnings](https://teamfighttactics.leagueoflegends.com/en-us/news/dev/dev-teamfight-tactics-monsters-attack-learnings/)
- [Riot: TFT Into the Arcane Learnings](https://teamfighttactics.leagueoflegends.com/en-us/news/dev/dev-tft-into-the-arcane-learnings/)
- [Riot: Gizmos & Gadgets Hextech Augments Overview](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/gizmos-gadgets-set-mechanic-overview-hextech-augments/)
- [Game Developer: Why the Hearthstone devs wanted to make an auto battler](https://www.gamedeveloper.com/design/why-the-i-hearthstone-i-devs-wanted-to-make-an-auto-battler)
- [Dot Esports: Hearthstone Battlegrounds designers interview](https://dotesports.com/hearthstone/news/hearthstone-battlegrounds-designers-discuss-the-mode-finally-leaving-beta-improving-customization-options-and-upcoming-heroes)
- [Blizzard: Introducing Hearthstone Battlegrounds](https://news.blizzard.com/en-us/article/23156373/introducing-hearthstone-battlegrounds)
- [Pocket Tactics: GDC 2020 design lessons from Teamfight Tactics](https://www.pockettactics.com/teamfight-tactics-design)
- [AAAI: Ludus, an Optimization Framework to Balance Auto Battler Cards](https://ojs.aaai.org/index.php/AAAI/article/view/21550)
