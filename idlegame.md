# Browser Idle Game Notes

## Short Version

A strong browser-based idle game is not just "numbers go up." It needs a simple first loop, a deeper meta loop, fair offline progress, fast saves, predictable math, and a UI that lets players make useful decisions quickly.

Build the game around these ideas:

- Make the first loop obvious: earn currency, buy production, watch production increase.
- Add depth gradually through upgrades, milestones, achievements, builds, challenges, automation, or prestige.
- Treat active play as an accelerant, not a requirement. Players should feel rewarded for checking in, not punished for leaving.
- Model the economy in a spreadsheet or script before tuning by feel.
- Store progress reliably, autosave often, and support export/import saves.
- Separate simulation from rendering. Idle progress should depend on elapsed time and saved state, not frame rate.

## Core Design Practices

### Start With One Clear Loop

The opening loop should be learnable in seconds:

1. Player performs a simple action or waits.
2. Currency increases.
3. Player buys a generator or upgrade.
4. Production rate increases.
5. New goals unlock.

This first loop should work before adding prestige, events, quests, monetization, or elaborate lore. A low-friction core loop is repeatedly cited as one of the defining strengths of idle games.

### Give the Game a Meta Loop

A pure clicker loop gets stale quickly. Add a meta loop that gives players reasons to plan:

- Upgrade trees with mutually exclusive or delayed choices.
- Generator synergies, milestones, and breakpoints.
- Achievements that change production, automation, or unlocks.
- Challenges that temporarily change rules.
- Collections, builds, loadouts, or factions.
- Prestige layers only when they create meaningful new decisions.

The meta loop should change what the player thinks about over time. If the optimal choice is always "buy the newest generator," the economy will feel shallow.

### Make Choices Feel Meaningful

Avoid upgrades that are only linear filler. Players should periodically ask:

- Which generator gives the best return right now?
- Should I save for a milestone or buy incremental upgrades?
- Should I push farther or reset?
- Should I optimize for active, idle, or offline progress?
- Which build is better for this stage?

It is fine if many small purchases are obvious, but every few minutes there should be a decision that changes the next stretch of play.

### Active, Idle, and Offline Are Different Modes

Design and balance these separately:

- Active: the player is interacting now. Reward attention with bursts, planning, clicks, minigames, or optimization.
- Idle: the tab or game is open, but interaction is occasional. Automation should keep producing.
- Offline: the game is closed or suspended. Compute elapsed progress when the player returns.

Good active play should speed things up without making idle play feel wrong. Good offline progress should make returning satisfying without making long absences the dominant strategy.

## Economy and Balance

### Use Exponential Costs Carefully

A common idle formula is:

```text
next_cost = base_cost * growth_rate ^ owned
production = base_production * owned * multipliers
```

This works because production starts ahead of costs, then exponential cost growth eventually creates a wall. Multipliers, milestones, new generators, automation, and prestige then push the player past that wall.

Practical tuning targets:

- Track "time to next meaningful purchase" at every stage.
- Use log-scale charts; idle economies span huge ranges.
- Add milestone multipliers to revive older generators.
- Avoid letting a newly unlocked generator permanently obsolete everything before it.
- Keep early waiting times short. Long waits should come after the player understands the goal.

### Model Before You Tune

Use a spreadsheet to model:

- Income per second.
- Cost curves.
- Time to buy each generator.
- Optimal purchase order.
- Time to first reset.
- Expected progress after 5 minutes, 30 minutes, 1 day, and 1 week.
- Offline rewards under different absence durations.

Manual tuning without a model gets misleading fast because small exponent changes can create huge late-game differences.

### Useful Bulk-Buy Formulas

For simple exponential generator costs:

```text
n = number to buy
b = base price
r = growth rate
k = currently owned
c = current currency

cost_to_buy_n = b * (r^k * (r^n - 1)) / (r - 1)
max_affordable = floor(log((c * (r - 1)) / (b * r^k) + 1) / log(r))
```

These avoid slow loops when supporting buy-10, buy-100, buy-max, or offline catch-up.

## Prestige and Long-Term Progression

Prestige is useful when it creates a satisfying reset with a permanent advantage. It is harmful when it becomes a mandatory chore every few minutes for a tiny multiplier.

Good prestige systems usually:

- Arrive after the player has felt the base loop.
- Make the next run visibly faster.
- Unlock a new mechanic, strategy, or goal.
- Explain what will reset and what will persist.
- Give players a clear "reset now vs push farther" decision.

Choose the prestige formula based on desired behavior:

- Lifetime earnings: lets players gain some progress even if they reset near the same point, but gains should diminish.
- Max earnings: rewards pushing farther and discourages repeated shallow resets.
- Earnings since reset: makes each run more independent; useful when offline progress is capped or active play matters more.
- Upgrade count or stage reached: can make prestige depend on breadth of progress rather than raw currency.

Before shipping prestige, chart how much farther a player must push to double their prestige currency. That number controls the feel of the whole reset loop.

## Browser Implementation Practices

### Separate Simulation From Rendering

Do not make production depend on animation frames. Keep a deterministic simulation that advances by elapsed time, then render the current state.

Recommended shape:

```text
load save
compute offline delta from last_saved_at
start render loop with requestAnimationFrame
advance simulation using timestamps or fixed ticks
autosave on interval, important purchase, and visibility change
```

Use `requestAnimationFrame` for animation and UI rendering. It syncs with browser repaint, may pause in hidden tabs, and passes a timestamp that should be used for frame-independent animation. Because hidden tabs can pause or throttle work, save timestamps and compute offline progress explicitly.

### Use Page Visibility Events

Listen for `visibilitychange`:

- Save immediately when the page becomes hidden.
- Pause expensive rendering when hidden.
- On visible, compare current time to the last simulation/save time and apply catch-up.

This handles tab switches, minimizing the browser, mobile app switching, and other cases where timers become unreliable.

### Save Reliably

For tiny prototypes, `localStorage` is acceptable. For a serious game, prefer IndexedDB or a wrapper around it because it handles larger structured data better and does not force everything into a synchronous key-value string API.

Save data should include:

- Schema/version number.
- Last saved timestamp.
- Player currencies and generators.
- Upgrade, achievement, prestige, and settings state.
- Feature flags or migration markers.
- Optional checksum to detect accidental corruption.

Also provide:

- Manual save button.
- Export/import save text.
- Autosave indicator.
- Multiple rolling backups if the game is long-running.
- Migration code for older save versions.

Remember that browser storage is not permanent in every condition. Users can clear it, private browsing can behave differently, and browsers can evict best-effort storage under pressure.

### Offline Progress

Offline progress should be calculated from saved state and elapsed wall time:

```text
elapsed_seconds = clamp((now - last_saved_at) / 1000, 0, offline_cap)
currency += production_per_second(saved_state) * elapsed_seconds
```

For more complex systems, prefer closed-form math or coarse simulation steps instead of replaying every frame or every second. Cap extreme deltas, handle negative deltas from clock changes, and show the player what was earned while away.

Useful policies:

- Cap offline gains to preserve balance, but communicate the cap.
- Consider partial efficiency after a threshold, such as full gains for 8 hours and reduced gains after that.
- Give a return summary with earned resources, completed timers, and newly affordable actions.
- Test sleep, mobile tab suspension, DST changes, clock rollback, and week-long absences.

### Number Handling

JavaScript `Number` is fine for early prototypes, but it tops out around `1.79e308`. Many incremental games exceed that. Pick a big-number strategy early if your design needs it.

Options:

- Keep numbers in normal ranges by resetting, changing currencies, or using logarithmic representations.
- Use a decimal/big-number library.
- Use an incremental-focused library such as `break_infinity.js` when you need very large values and can trade some precision for speed.
- Format numbers consistently with scientific, engineering, or named notation.

Do not show excessive precision. Players need readable comparisons, not 14 noisy decimal places.

## UI and UX Hints

### Prioritize Scanability

Idle game UIs are mostly decision surfaces. Players repeatedly scan for what changed and what is worth buying.

Useful UI patterns:

- Show current currency, production per second, and next major goal.
- Show each purchase's cost, production gain, and affordability.
- Provide buy 1, 10, 100, and max controls.
- Use progress bars for unlocks, timers, and milestones.
- Mark newly affordable upgrades clearly.
- Keep tooltips concise and formula-aware.
- Show what a prestige will grant before asking for confirmation.
- Add settings for notation, autosave/export, reduced motion, and compact display.

### Make Returning Feel Good

On return, show a short summary:

- Time away.
- Resources earned.
- Completed timers or milestones.
- Suggested next action if something important is affordable.

Do not overwhelm the player with a modal every minute. Reserve return summaries for meaningful absences or make them dismissible.

### Theme Matters

The mechanics can be simple, so presentation and theme carry a lot of weight. A strong theme helps players remember why upgrades exist and makes repeated actions less sterile. Tie generator names, upgrade names, achievements, and visual changes to the theme.

## Performance Hints

- Batch DOM writes and avoid updating every visible number every frame.
- Render slow-changing values at 5-10 Hz instead of 60 Hz.
- Use `requestAnimationFrame` for visual updates, not `setInterval`.
- Use Web Workers for heavy simulations, optimization searches, or large offline catch-up if needed.
- Pause animations and expensive effects while the page is hidden.
- Avoid giant logs, unbounded arrays, or thousands of live DOM nodes.
- Cache formatted number strings when values have not visibly changed.
- Profile on low-end phones, not only a desktop dev machine.

## Analytics and Testing

Track design health with events such as:

- Tutorial completion.
- First generator purchase.
- First automation unlock.
- First prestige eligibility and actual prestige.
- Session length.
- Return after 1 day, 7 days, and 30 days.
- Where players stop progressing.
- Which upgrades are ignored.
- Offline duration and reward claimed.

Test these scenarios:

- Fresh start to first meaningful upgrade.
- Fresh start to first prestige.
- Save/load after every important purchase.
- Offline for 1 minute, 1 hour, 8 hours, 1 day, and 1 week.
- Browser refresh during a purchase.
- Version migration from an old save.
- Numbers near notation boundaries.
- Buy-max near exact affordability.

## Monetization Notes

If monetizing, protect retention first. Ads or purchases that interrupt the main loop can make players leave. Rewarded ads fit idle games better than forced ads because they can offer time skips, temporary multipliers, or bonus currency at natural decision points.

Avoid paywalls around basic automation, offline progress, or quality-of-life features that make the game humane to play. Monetization should feel like optional acceleration or cosmetics, not relief from deliberately bad pacing.

## Common Mistakes

- Tuning only the first hour and ignoring late-game exponent behavior.
- Letting one generator tier permanently dominate.
- Adding prestige because the genre expects it, not because the game needs it.
- Making offline progress too stingy or too generous.
- Trusting browser timers in hidden tabs.
- Saving only on a fixed timer and losing progress on tab close.
- Using `Number` until the economy unexpectedly hits infinity.
- Showing huge numbers without readable notation.
- Making active play mandatory in a game marketed as idle.
- Shipping without import/export saves.

## Practical Build Checklist

- [ ] Core loop works with one currency and one generator.
- [ ] Production is based on elapsed time, not frame count.
- [ ] Save/load includes schema version and timestamp.
- [ ] Offline catch-up works after refresh and tab close.
- [ ] `visibilitychange` saves and pauses expensive work.
- [ ] Buy-max uses formulas or efficient calculation.
- [ ] Economy model charts time-to-purchase and reset timing.
- [ ] UI shows production, affordability, and next goal.
- [ ] Import/export save is available.
- [ ] Large-number strategy is chosen before late-game content.
- [ ] First prestige, if present, is modeled and playtested.
- [ ] Performance is tested on a low-end device.

## Sources

- [GameAnalytics: How to Make an Idle Game](https://www.gameanalytics.com/blog/how-to-make-an-idle-game-adjust)
- [Machinations: How to Design Idle Games](https://machinations.io/articles/idle-games-and-how-to-design-them)
- [Kongregate: The Math of Idle Games, Part I](https://www.kongregate.com/pages/the-math-of-idle-games-part-i)
- [Kongregate: The Math of Idle Games, Part III](https://www.kongregate.com/pages/the-math-of-idle-games-part-iii)
- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- [MDN: Anatomy of a Video Game](https://developer.mozilla.org/en-US/docs/Games/Anatomy)
- [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [MDN: IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [MDN: Storage Quotas and Eviction Criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [web.dev: PWA Caching](https://web.dev/learn/pwa/caching/)
- [break_infinity.js](https://patashu.github.io/break_infinity.js/index.html)
