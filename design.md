# Idle Autobattler Design Document

## Working Title

**Idle Formation**

## Concept

Idle Formation is a browser-based idle autobattler where the player builds a team from synergistic units, then the game continuously resolves combat rounds without requiring manual readiness or pauses. Active play is about drafting units, upgrading the roster, choosing items, tuning synergy breakpoints, and deciding when to prestige. Idle play continues the combat loop automatically, including local save persistence and offline progress.

The game should use mostly browser-native UI: panels, tables, buttons, lists, progress bars, trait chips, logs, and simple board cells. Graphics are intentionally minimal. Unit identity comes from names, icons, colors, traits, stats, and concise ability text rather than animation-heavy presentation.

## Design Goals

- Combine autobattler decision-making with idle-game continuity.
- Make unit selection and synergy building the primary active gameplay.
- Keep combat automatic, fast, and legible
- Let the game progress without pausing between rounds.
- Support local browser saves, autosave, manual save, and export/import.
- Keep balance and progression math in an external spreadsheet that tests can read.
- Avoid dependency on complex art, animation, or canvas-heavy rendering.

## Player Actions

The player is a roster optimizer. They are not piloting units directly; they are building an engine. Every check-in should offer a few meaningful decisions:

- Buy or reroll for units that complete synergies.
- Upgrade a carry, tank, or support unit.
- Swap units to hit better trait breakpoints.
- Choose items that reinforce the current composition.
- Decide whether to push deeper into the current run or prestige.

## Primary Loops

### Moment-to-Moment Loop


* combat round resolves
* rewards are paid
* shop refreshes can be purchased
* player buys, sells, rerolls, upgrades, items, or repositions
* next combat round starts automatically


There is no hard pause between rounds. The team can be changed at any point. If the player is idle, the game advances on its own. If the player team cannnot defeat the enemy team, the player team is sent back one round.

### Active Loop

During active play, the player improves the team between and during rounds:

- Select units from a  shop.
- Reroll the shop to find upgrades or new synergy paths.
- Buy duplicates to upgrade units.
- Replace weaker units with stronger or more synergistic units.
- Equip items from an item shop or reward choice.
- Reposition units on a simple board.
- See combat data to identify weak points.
- Decide when the current run has reached a good prestige point.

Active play should accelerate progression through better decisions, not become mandatory input.

### Idle In-Tab Loop

When the browser tab is open but the player is not interacting:

- Combat rounds continue automatically.
- Rewards continue to accumulate.
- Optional automation can buy marked units, equip saved item plans, or maintain a preferred formation.
- The game autosaves on a timer and on visibility changes.

The player should be able to return after several minutes and see what changed.

### Offline Loop

When the game is closed or suspended:

- Save the last timestamp and full progression state.
- On load, compute elapsed time.
- Simulate or approximate the number of rounds completed while away.
- Apply rewards, losses, stage progress, and capped offline gains.
- Show a concise return summary.

Offline progress should use deterministic math from saved state. It should not replay every visual combat frame.

### Prestige Loop

Prestige is the long-term reset system:

* reset run-specific progress
* earn prestige currency
* spend prestige currency on permanent bonuses
* start faster with more strategic options


Prestige should unlock or improve systems such as:

- Starting gold.
- Offline progress cap.
- Shop quality.
- Unit pool unlocks.
- Trait-specific bonuses.
- Automation rules.
- Item choice slots.
- Simulation speed.

Prestige should not erase local settings, discovered unit data, achievements, or permanent upgrades.

## Core Game Systems

### Combat Rounds

Combat is automatic and round-based. Each round pairs the player's team against a precalculated enemy team.

Combat should resolve quickly using simple rules:

- Units have health, attack, defense, speed, mana, ability, traits, star level, and items.
- Units pick targets using deterministic targeting rules.
- Units attack and cast abilities automatically.
- Traits and items modify stats or trigger effects.
- If the player team wins, they recieve rewards and are sent to the next round automatically.
- If the player team cannnot defeat the enemy team, the player team is sent back one round.

For the MVP, combat can be text/table driven with minimal animation:

- A board grid showing unit positions.
- Health bars or numeric health.
- Combat event log.
- End-of-round recap table.

### Unit Selection

The unit shop is the main active decision surface. Each shop roll offers a small set of units, weighted by player level, stage, and rarity.

Required shop actions:

- Buy unit.
- Sell unit.
- Lock shop.
- Reroll shop.
- Buy XP or level up.
- View unit details.
- Mark a unit as wanted for automation.

Units should support:

- Cost tier.
- Traits.
- Role.
- Base stats.
- Ability.
- Upgrade count.
- Item slots.
- Short rules text.

### Unit Upgrades

Duplicates combine into stronger versions. A simple version:

```text
3 copies of 1-star unit -> 1 copy of 2-star unit
3 copies of 2-star unit -> 1 copy of 3-star unit
```

Upgrades should increase stats and may improve ability scaling or add new abilities. The UI should clearly show how many copies are owned and how many are needed.

### Synergy Traits

Traits are the main autobattler identity system. A team earns bonuses by fielding enough units that share a trait.

Trait UI must show:

- Active traits.
- Inactive traits represented on owned units.
- Current unit count for each trait.
- Next breakpoint.
- Bonus text for each breakpoint.
- Which board and bench units contribute.
- Shop units that would activate or improve a trait.

Trait design principles:

- Partial breakpoints should be useful.
- Deep breakpoints should be powerful but costly.
- Each unit should fit more than one possible team.
- Traits should create build direction without forcing one solved composition.
- Strong traits need readable counters or weaknesses.

Example trait structure:

```text
Guardian
2: all allies gain +10 armor
4: Guardians gain +30 armor and shield lowest-health ally
6: all allies gain +40 armor; shields trigger twice
```

### Items

Items provide another active decision layer. They can come from round rewards or item shops.

MVP item rules:

- Items modify stats or add simple triggers.
- Each unit has limited item slots.
- Items can be moved freely until combat starts, then lock until the next round.
- Item shop appears every few rounds with purchasable refreshes.

Item UI should show:

- Owned items.
- Equipped items.
- Recommended eligible units.
- What stat or effect changes if equipped.
- Whether the item supports active, idle, or scaling strategies.

### Economy

Economy controls pacing and player tradeoffs.

Core currencies:

- Gold: buy units, reroll, level, and buy items.
- Stage progress: advances through combat.
- Prestige currency: permanent upgrades after reset.

Possible economy rules:

- Base gold after every round.
- Reroll cost scaling.
- Level XP cost scaling.
- Increased shop costs by item rarity.

Economy should be tuned so active players can optimize faster while idle players continue to make steady progress.

### Board and Positioning

The board should be simple: a small grid with front, middle, and back rows. Positioning matters, but should not require detailed animation.

Positioning effects:

- Frontline units are targeted earlier.
- Backline units are safer but vulnerable to backline access traits.
- Some traits or items care about row, adjacent allies, or column.
- Some enemies punish clumping or exposed carries.

UI requirements:

- Drag-and-drop or click-to-swap units.
- Clear active board limit.
- Clear bench limit.
- Trait preview while moving units.
- Invalid board states disallowed with explanation.

## Idle and Automation Design

Automation should unlock gradually through prestige or milestones. It exists to make idle play viable, not to remove all decisions.

Potential automation features:

- Auto-continue combat rounds.
- Auto-sell unwanted low-tier units.
- Auto-buy marked units.
- Auto-combine upgrades.
- Auto-equip saved item templates.
- Auto-reroll under player-defined limits.
- Auto-prestige at a target threshold.

Automation controls should always include spending caps, because uncontrolled rerolling or leveling can ruin an idle run.

Example automation rule:

```text
Buy marked units if gold remains above 20.
Reroll up to 3 times after each round if a marked unit is one copy from upgrade.
Prestige when projected prestige gain is at least 25% higher than current best.
```

## Browser and Save Requirements

### Runtime

The game should be a browser app using standard HTML, CSS, and JavaScript or TypeScript. Rendering should prioritize browser elements over canvas:

- Tables for unit stats and combat recaps.
- Buttons for shop actions.
- CSS grid for the board.
- Lists or chips for traits.
- Progress bars for rounds, levels, prestige, and offline caps.
- Dialogs for prestige, import/export, and settings.

Canvas or SVG may be used only for small optional icons or simple visual polish. The game should remain playable without animation.

### Local Saves

Save locally in IndexedDB, with localStorage acceptable only for a tiny prototype.

Save data should include:

- Save schema version.
- Last saved timestamp.
- Current run state.
- Permanent prestige state.
- Unit roster ownership.
- Board and bench state.
- Items and equipment.
- Shop state.
- Automation rules.
- Settings.
- Random seed or deterministic combat state when needed.

Required save features:

- Autosave every short interval.
- Save on important actions.
- Save on `visibilitychange`.
- Manual save button.
- Export/import save text.
- Save migration support.
- Corruption handling or backup slot.

## External Spreadsheet for Progression Math

Progression math should live outside the game code so it can be edited, reviewed, and tested independently.

Recommended file:

balance.xlsx

Recommended sheets:

- `Units`: unit id, name, cost, traits, role, base stats, ability id, scaling.
- `Traits`: trait id, name, breakpoints, effects, formulas.
- `Items`: item id, name, cost, rarity, stat changes, triggers.
- `Levels`: level, XP required, board cap, shop odds by rarity.
- `Economy`: round rewards, interest, streaks, reroll costs, item costs.
- `Stages`: enemy templates, stage scaling, rewards, unlocks.
- `Prestige`: score formula, currency formula, upgrade costs, bonuses.
- `Offline`: offline caps, efficiency curves, max simulated rounds.

Testing workflow:

* read balance.xlsx
* validate required sheets and columns
* convert rows into typed balance data
* run economy and combat simulations
* assert target timings and power bands
* export runtime balance JSON
* browser game loads generated JSON


The browser runtime should not hardcode balance constants. Tests should fail if spreadsheet edits create broken references, missing formulas, impossible costs, invalid trait breakpoints, or extreme progression spikes.

Example test targets:

- Time to first upgrade.
- Time to first trait activation.
- Time to first prestige.
- Average gold per 10 rounds.
- Expected rewards after 1 hour idle.
- Expected rewards after 8 hours offline.
- Win rate for stage templates by recommended team power.
- Trait breakpoint value compared to same-cost alternatives.

## Progression Math Principles

Use spreadsheet-driven formulas for:

- Unit cost by rarity.
- Level XP costs.
- Reroll efficiency.
- Stage difficulty.
- Gold income.
- Item pricing.
- Prestige gain.
- Offline progress cap.
- Permanent upgrade costs.

Suggested pacing goals:

- First unit purchase: immediate.
- First trait activation: within 1-3 minutes.
- First upgraded unit: within 5-10 minutes.
- First meaningful item decision: within 5-10 minutes.
- First prestige eligibility: within 30-60 minutes for initial tuning.
- Offline cap visible early, expandable through prestige.

Prestige formula should reward pushing deeper without making shallow resets optimal:

```text
prestige_gain = floor((best_stage_reached ^ stage_exponent) * run_multiplier / prestige_divisor)
```

Balance the exponent and divisor in the spreadsheet, not in code.

## Minimal UI Layout

Primary screen:

top bar: gold, level, XP, stage, round timer, prestige estimate
left panel: active traits and next breakpoints
center: board grid and bench
right panel: unit shop and item shop
bottom panel: combat log, recap, and automation controls


Important UI states:

- Unit affordable.
- Unit completes trait.
- Unit completes upgrade.
- Trait breakpoint active.
- Item can be equipped.
- Board over cap.
- Bench full.
- Automation active.
- Offline rewards available.
- Prestige available.

## MVP Scope

Build first:

- Local browser app.
- One board.
- One player team.
- Generated enemy teams.
- Continuous automatic rounds.
- Unit shop with reroll, buy, sell, bench, and board placement.
- At least 12 units.
- At least 5 traits.
- At least 8 items.
- Duplicate-based unit upgrades.
- Trait display with breakpoints.
- Basic economy.
- IndexedDB save/load.
- Offline catch-up.
- Prestige reset with one permanent upgrade tree.
- Spreadsheet-driven balance loaded by tests and exported as JSON.

Non-goals:

- Multiplayer.
- Rich animation.
- 3D or canvas combat.
- Complex pathfinding.
- Live service rotations.
- Cosmetic systems.
- Account login or cloud saves.

## Data Model Sketch

```text
GameState
  saveVersion
  lastSavedAt
  run
  prestige
  settings
  automation

RunState
  gold
  level
  xp
  stage
  round
  boardUnits
  benchUnits
  items
  shop
  currentEnemy
  rngSeed

UnitInstance
  instanceId
  unitId
  starLevel
  equippedItemIds
  boardPosition

BalanceData
  units
  traits
  items
  levels
  economy
  stages
  prestige
  offline
```

## Technical Notes

- Keep simulation logic separate from UI rendering.
- Use deterministic random seeds for combat debugging.
- Keep balance data immutable during a run except through versioned migrations.
- Represent traits and items as data-driven effects where practical.
- Use simple numeric combat first; add visual effects only after the loop works.
- Render slow-changing UI at a modest rate instead of every animation frame.
- Use `visibilitychange` to save and compute idle catch-up.
- Cap offline progress to protect economy balance.

## Risks

- Synergy complexity can overwhelm the minimal UI. Mitigation: strong trait display, concise unit text, and previews for purchases.
- Spreadsheet balance can drift from runtime behavior. Mitigation: test-generated JSON should be the only runtime source of balance constants.
- Idle rewards can trivialize active decisions. Mitigation: active play improves direction and efficiency; idle play advances but does not optimize as well.

## Resolved Design Questions

- Should items be permanent, movable between rounds, or consumed on equip? Answer: Items are normally per-run, but items that persist past prestiege might exist.
- Should prestige be based on best stage, lifetime gold, team power, or a hybrid score? Answer: The initial prestiege loop is based on best stage
- How much automation should be available before first prestige? Answer: None.
- Should offline progress simulate exact rounds or use an approximation curve? Answer: Simulate exact runs.
