const SAVE_VERSION = 1;
const BOARD_SIZE = 6;

export function createInitialState(balance) {
  const prestige = {
    points: 0,
    totalPrestiges: 0,
    bestStage: 1,
  };
  const state = {
    saveVersion: SAVE_VERSION,
    lastSavedAt: Date.now(),
    rngSeed: 123456789,
    prestige,
    settings: {
      autoSave: true,
    },
    automation: {
      enabled: false,
      wantedUnitIds: [],
    },
    run: createRun(balance, prestige),
  };
  rollShop(state, balance, { free: true });
  refreshItemShop(state, balance, { free: true });
  return state;
}

export function migrateState(saved, balance) {
  const state = structuredCloneSafe(saved);
  state.saveVersion = SAVE_VERSION;
  state.lastSavedAt = Number(state.lastSavedAt) || Date.now();
  state.rngSeed = Number(state.rngSeed) || 123456789;
  state.prestige ??= { points: 0, totalPrestiges: 0, bestStage: 1 };
  state.prestige.points = Number(state.prestige.points) || 0;
  state.prestige.totalPrestiges = Number(state.prestige.totalPrestiges) || 0;
  state.prestige.bestStage = Number(state.prestige.bestStage) || 1;
  state.settings ??= { autoSave: true };
  state.automation ??= { enabled: false, wantedUnitIds: [] };
  state.run ??= createRun(balance, state.prestige);
  state.run.board = normalizeBoard(state.run.board);
  state.run.bench ??= [];
  state.run.items ??= [];
  state.run.itemSlots = clamp(Number(state.run.itemSlots) || 0, 0, balance.economy.maxItemSlots);
  state.run.items = state.run.items.map((item) => {
    const slotIndex = Number.isInteger(item.slotIndex) && item.slotIndex >= 0 && item.slotIndex < state.run.itemSlots ? item.slotIndex : null;
    return {
      instanceId: item.instanceId,
      itemId: item.itemId,
      slotIndex,
    };
  });
  state.run.shop ??= [];
  state.run.itemShop ??= [];
  state.run.combatLog ??= [];
  state.run.recap ??= null;
  state.run.enemyBoard = normalizeBoard(state.run.enemyBoard ?? []);
  state.run.roundProgressMs = Number(state.run.roundProgressMs) || 0;
  state.run.gold = Number(state.run.gold) || 0;
  state.run.level = clamp(Number(state.run.level) || 1, 1, balance.levels.at(-1).level);
  state.run.xp = Number(state.run.xp) || 0;
  state.run.stage = Math.max(1, Number(state.run.stage) || 1);
  if (!("totalRounds" in state.run)) {
    state.run.totalRounds = Math.max(1, Number(state.run.round) || 1);
    state.run.round = 1;
  } else {
    state.run.totalRounds = Math.max(1, Number(state.run.totalRounds) || 1);
    state.run.round = Math.max(1, Number(state.run.round) || 1);
  }
  if (state.run.shop.length === 0) rollShop(state, balance, { free: true });
  if (state.run.itemShop.length === 0) refreshItemShop(state, balance, { free: true });
  return state;
}

export function rollShop(state, balance, options = {}) {
  if (!options.free && state.run.shopLocked) {
    state.run.shopLocked = false;
    return { ok: true, message: "Unlocked shop without rerolling." };
  }
  const cost = balance.economy.rerollCost;
  if (!options.free && state.run.gold < cost) return { ok: false, message: "Not enough gold to reroll." };
  if (!options.free) state.run.gold -= cost;
  const size = balance.economy.shopSize;
  state.run.shop = Array.from({ length: size }, () => pickShopUnit(state, balance));
  return { ok: true, message: "Shop refreshed." };
}

export function toggleShopLock(state) {
  state.run.shopLocked = !state.run.shopLocked;
}

export function buyShopUnit(state, balance, shopIndex) {
  const unitId = state.run.shop[shopIndex];
  const unit = balance.unitById[unitId];
  if (!unit) return { ok: false, message: "That shop slot is empty." };
  if (state.run.gold < unit.cost) return { ok: false, message: "Not enough gold." };
  if (countUnits(state) >= BOARD_SIZE + balance.economy.benchCap) return { ok: false, message: "Board and bench are full." };

  state.run.gold -= unit.cost;
  const instance = createUnitInstance(unit.id);
  const emptySlot = firstEmptyBoardSlot(state);
  if (emptySlot >= 0 && boardUnitCount(state) < getCurrentLevel(balance, state).boardCap) {
    state.run.board[emptySlot] = instance;
  } else {
    state.run.bench.push(instance);
  }
  state.run.shop[shopIndex] = null;
  combineDuplicates(state);
  return { ok: true, message: `Bought ${unit.name}.` };
}

export function buyXp(state, balance) {
  const cost = balance.economy.xpBuyCost;
  if (state.run.gold < cost) return { ok: false, message: "Not enough gold for XP." };
  if (state.run.level >= balance.levels.at(-1).level) return { ok: false, message: "Already at max level." };
  state.run.gold -= cost;
  gainXp(state, balance, balance.economy.xpPerBuy);
  return { ok: true, message: `Bought ${balance.economy.xpPerBuy} XP.` };
}

export function fieldUnit(state, balance, benchIndex, slotIndex = firstEmptyBoardSlot(state)) {
  if (slotIndex < 0 || slotIndex >= BOARD_SIZE) return { ok: false, message: "No board slot available." };
  if (state.run.board[slotIndex]) return { ok: false, message: "That board slot is occupied." };
  if (boardUnitCount(state) >= getCurrentLevel(balance, state).boardCap) return { ok: false, message: "Board cap reached. Level up to field more units." };
  const [unit] = state.run.bench.splice(benchIndex, 1);
  if (!unit) return { ok: false, message: "Bench unit not found." };
  state.run.board[slotIndex] = unit;
  return { ok: true, message: "Unit moved to board." };
}

export function benchUnit(state, balance, slotIndex) {
  const unit = state.run.board[slotIndex];
  if (!unit) return { ok: false, message: "No unit in that slot." };
  if (state.run.bench.length >= balance.economy.benchCap) return { ok: false, message: "Bench is full." };
  state.run.board[slotIndex] = null;
  unit.boardPosition = null;
  state.run.bench.push(unit);
  return { ok: true, message: "Unit moved to bench." };
}

export function swapBoardUnits(state, firstSlot, secondSlot) {
  const first = state.run.board[firstSlot];
  state.run.board[firstSlot] = state.run.board[secondSlot];
  state.run.board[secondSlot] = first;
}

export function sellUnit(state, balance, location, index) {
  const unit = location === "board" ? state.run.board[index] : state.run.bench[index];
  if (!unit) return { ok: false, message: "Unit not found." };
  const base = balance.unitById[unit.unitId].cost;
  const refund = Math.max(1, Math.floor(base * unit.starLevel * balance.economy.sellRefundRate));
  if (location === "board") state.run.board[index] = null;
  else state.run.bench.splice(index, 1);
  state.run.gold += refund;
  return { ok: true, message: `Sold unit for ${refund} gold.` };
}

export function refreshItemShop(state, balance, options = {}) {
  const cost = balance.economy.itemRefreshCost;
  if (!options.free && state.run.gold < cost) return { ok: false, message: "Not enough gold to refresh items." };
  if (!options.free) state.run.gold -= cost;
  state.run.itemShop = Array.from({ length: balance.economy.itemShopSize }, () => pickItem(state, balance));
  return { ok: true, message: "Item shop refreshed." };
}

export function buyItem(state, balance, itemShopIndex) {
  const itemId = state.run.itemShop[itemShopIndex];
  const item = balance.itemById[itemId];
  if (!item) return { ok: false, message: "That item slot is empty." };
  if (state.run.gold < item.cost) return { ok: false, message: "Not enough gold." };
  state.run.gold -= item.cost;
  state.run.items.push(createItemInstance(item.id));
  state.run.itemShop[itemShopIndex] = null;
  return { ok: true, message: `Bought ${item.name}.` };
}

export function buyItemSlot(state, balance) {
  if (state.run.itemSlots >= balance.economy.maxItemSlots) return { ok: false, message: "Item slots are already maxed." };
  const cost = getItemSlotCost(state, balance);
  if (state.run.gold < cost) return { ok: false, message: "Not enough gold for an item slot." };
  state.run.gold -= cost;
  state.run.itemSlots += 1;
  return { ok: true, message: `Bought item slot ${state.run.itemSlots}.` };
}

export function assignItemToSlot(state, itemInstanceId, slotIndex) {
  const item = state.run.items.find((candidate) => candidate.instanceId === itemInstanceId);
  if (!item) return { ok: false, message: "Item not found." };
  if (slotIndex === null || slotIndex === "") {
    item.slotIndex = null;
    return { ok: true, message: "Item removed from slot." };
  }
  const parsedSlot = Number(slotIndex);
  if (!Number.isInteger(parsedSlot) || parsedSlot < 0 || parsedSlot >= state.run.itemSlots) return { ok: false, message: "Invalid item slot." };
  const occupyingItem = state.run.items.find((candidate) => candidate.slotIndex === parsedSlot && candidate.instanceId !== itemInstanceId);
  if (occupyingItem) occupyingItem.slotIndex = null;
  item.slotIndex = parsedSlot;
  return { ok: true, message: `Item assigned to slot ${parsedSlot + 1}.` };
}

export function getItemSlotCost(state, balance) {
  return Math.ceil(balance.economy.itemSlotBaseCost * Math.pow(balance.economy.itemSlotCostGrowth, state.run.itemSlots));
}

export function getActiveItems(state) {
  return state.run.items
    .filter((item) => Number.isInteger(item.slotIndex) && item.slotIndex >= 0 && item.slotIndex < state.run.itemSlots)
    .sort((a, b) => a.slotIndex - b.slotIndex);
}

export function getItemInSlot(state, slotIndex) {
  return state.run.items.find((item) => item.slotIndex === slotIndex) ?? null;
}

export function equipItem(state, itemInstanceId, slotIndex) {
  return assignItemToSlot(state, itemInstanceId, slotIndex);
}

export function getItemEffectText(item) {
  const value = item.mode === "percent" ? `+${item.value}%` : `+${item.value}`;
  return `${value} ${item.stat} to all units`;
}

export function applyActiveItemStats(stats, state, balance) {
  for (const itemInstance of getActiveItems(state)) {
    const item = balance.itemById[itemInstance.itemId];
    if (!item) continue;
    applyStat(stats, item.stat, item.value, item.mode);
  }
  return stats;
}

export function processElapsed(state, balance, elapsedMs, options = {}) {
  const before = snapshotProgress(state);
  const roundMs = balance.economy.roundSeconds * 1000;
  const maxRounds = options.maxRounds ?? Infinity;
  let rounds = 0;
  state.run.roundProgressMs += Math.max(0, elapsedMs) * simulationSpeed(state, balance);
  while (state.run.roundProgressMs >= roundMs && rounds < maxRounds) {
    state.run.roundProgressMs -= roundMs;
    runCombatRound(state, balance);
    rounds += 1;
  }
  if (rounds >= maxRounds) state.run.roundProgressMs = Math.min(state.run.roundProgressMs, roundMs - 1);
  return {
    rounds,
    goldDelta: state.run.gold - before.gold,
    stageDelta: state.run.stage - before.stage,
    itemDelta: state.run.items.length - before.items,
  };
}

export function processOffline(state, balance, now = Date.now()) {
  const elapsedSeconds = Math.max(0, Math.floor((now - state.lastSavedAt) / 1000));
  const capSeconds = getOfflineCapSeconds(state, balance);
  const appliedSeconds = Math.min(elapsedSeconds, capSeconds);
  const maxRounds = balance.offline.maxCatchupRounds;
  const result = processElapsed(state, balance, appliedSeconds * 1000, { maxRounds });
  state.lastSavedAt = now;
  return {
    ...result,
    elapsedSeconds,
    appliedSeconds,
    capped: elapsedSeconds > appliedSeconds,
  };
}

export function runCombatRound(state, balance) {
  const teamPower = computeTeamPower(state, balance);
  const stage = getStage(balance, state.run.stage);
  const enemyBoard = createEnemyBoard(state, balance, stage);
  const attackEvents = createAttackEvents(state, balance, enemyBoard);
  const healthByCombatId = createHealthByCombatId(state, balance, enemyBoard, attackEvents);
  const variance = 0.92 + nextRandom(state) * 0.16;
  const adjustedPower = teamPower * variance;
  const won = adjustedPower >= stage.enemyPower && boardUnitCount(state) > 0;
  const previousStage = state.run.stage;
  const round = state.run.round;
  const totalRound = state.run.totalRounds;

  if (won) {
    state.run.stage += 1;
    state.run.gold += balance.economy.baseWinGold + stage.goldReward;
  } else {
    state.run.stage = Math.max(1, state.run.stage - 1);
    state.run.gold += balance.economy.lossGold;
  }

  gainXp(state, balance, balance.economy.xpPerRound);
  maybeAwardItem(state, balance, won, totalRound, stage);
  combineDuplicates(state);
  state.prestige.bestStage = Math.max(state.prestige.bestStage, state.run.stage);
  state.run.round = state.run.stage === previousStage ? state.run.round + 1 : 1;
  state.run.totalRounds += 1;
  if (!state.run.shopLocked && state.run.shop.every((slot) => slot === null)) rollShop(state, balance, { free: true });

  state.run.recap = {
    combatId: totalRound,
    round,
    totalRound,
    won,
    previousStage,
    nextStage: state.run.stage,
    teamPower,
    adjustedPower,
    enemyPower: stage.enemyPower,
    variance,
    enemyBoard,
    attackEvents,
    healthByCombatId,
  };
  state.run.enemyBoard = enemyBoard;
  addLog(state, `${won ? "Won" : "Lost"} stage ${previousStage} round ${round}: power ${formatNumber(teamPower)} vs ${formatNumber(stage.enemyPower)}.`);
  return state.run.recap;
}

export function computeTraitState(state, balance) {
  const counts = {};
  for (const instance of state.run.board.filter(Boolean)) {
    const unit = balance.unitById[instance.unitId];
    for (const traitId of unit.traits) {
      counts[traitId] = (counts[traitId] ?? 0) + 1;
    }
  }

  return balance.traits.map((trait) => {
    const count = counts[trait.id] ?? 0;
    const active = trait.breakpoints.filter((breakpoint) => breakpoint.count <= count).at(-1) ?? null;
    const next = trait.breakpoints.find((breakpoint) => breakpoint.count > count) ?? null;
    return { trait, count, active, next };
  }).sort((a, b) => {
    if (Boolean(b.active) !== Boolean(a.active)) return Number(Boolean(b.active)) - Number(Boolean(a.active));
    return b.count - a.count || a.trait.name.localeCompare(b.trait.name);
  });
}

export function computeUnitStats(instance, state, balance, traitState = computeTraitState(state, balance)) {
  const unit = balance.unitById[instance.unitId];
  const starMultiplier = [0, 1, 1.85, 3.25][instance.starLevel] ?? Math.pow(1.85, instance.starLevel - 1);
  const stats = {
    health: unit.health * starMultiplier,
    attack: unit.attack * starMultiplier,
    defense: unit.defense * starMultiplier,
    speed: unit.speed,
    abilityPower: unit.abilityPower * starMultiplier,
  };

  applyActiveItemStats(stats, state, balance);

  for (const entry of traitState) {
    if (!entry.active) continue;
    if (entry.trait.target === "trait" && !unit.traits.includes(entry.trait.id)) continue;
    applyStat(stats, entry.trait.stat, entry.active.value, entry.trait.mode);
  }

  return stats;
}

export function computeTeamPower(state, balance) {
  const traitState = computeTraitState(state, balance);
  const base = state.run.board.filter(Boolean).reduce((total, instance) => {
    const stats = computeUnitStats(instance, state, balance, traitState);
    return total + stats.health / 8 + stats.attack * stats.speed * 4 + stats.defense * 3 + stats.abilityPower * 1.65;
  }, 0);
  const prestigeBonus = 1 + (state.prestige.points * balance.prestige.powerPercentPerPoint) / 100;
  return base * prestigeBonus;
}

export function estimatePrestigeGain(state, balance) {
  const bestStage = Math.max(state.run.stage, state.prestige.bestStage);
  if (bestStage < balance.prestige.minStage) return 0;
  return Math.floor(Math.pow(bestStage, balance.prestige.stageExponent) / balance.prestige.prestigeDivisor);
}

export function prestigeReset(state, balance) {
  const gain = estimatePrestigeGain(state, balance);
  if (gain <= 0) return { ok: false, message: `Reach stage ${balance.prestige.minStage} to prestige.` };
  state.prestige.points += gain;
  state.prestige.totalPrestiges += 1;
  state.prestige.bestStage = 1;
  state.run = createRun(balance, state.prestige);
  rollShop(state, balance, { free: true });
  refreshItemShop(state, balance, { free: true });
  addLog(state, `Prestiged for ${gain} points.`);
  return { ok: true, message: `Prestiged for ${gain} points.` };
}

export function getCurrentLevel(balance, state) {
  return balance.levelByNumber[state.run.level] ?? balance.levels[0];
}

export function getNextLevel(balance, state) {
  return balance.levelByNumber[state.run.level + 1] ?? null;
}

export function getOfflineCapSeconds(state, balance) {
  return balance.prestige.offlineCapSecondsBase + state.prestige.points * balance.prestige.offlineCapSecondsPerPoint;
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1000000) return value.toExponential(2);
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString();
  if (Math.abs(value) >= 100) return Math.round(value).toString();
  if (Math.abs(value) >= 10) return value.toFixed(1).replace(/\.0$/, "");
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function allUnits(state) {
  return [...state.run.board.filter(Boolean), ...state.run.bench];
}

export function getPreviewEnemyBoard(state, balance) {
  if (state.run.recap?.enemyBoard?.some(Boolean)) return state.run.recap.enemyBoard;
  if (state.run.enemyBoard?.some(Boolean)) return state.run.enemyBoard;
  return createEnemyBoard({ ...state, rngSeed: state.rngSeed }, balance, getStage(balance, state.run.stage));
}

function createRun(balance, prestige) {
  const startingGold = balance.economy.startingGold + prestige.points * balance.prestige.startingGoldPerPoint;
  return {
    gold: startingGold,
    level: 1,
    xp: 0,
    stage: 1,
    round: 1,
    totalRounds: 1,
    roundProgressMs: 0,
    board: normalizeBoard([]),
    bench: [],
    items: [],
    itemSlots: 0,
    shop: [],
    itemShop: [],
    shopLocked: false,
    enemyBoard: normalizeBoard([]),
    combatLog: [],
    recap: null,
  };
}

function gainXp(state, balance, amount) {
  if (state.run.level >= balance.levels.at(-1).level) return;
  state.run.xp += amount;
  let next = getNextLevel(balance, state);
  while (next && state.run.xp >= next.xpRequired) {
    state.run.xp -= next.xpRequired;
    state.run.level += 1;
    next = getNextLevel(balance, state);
  }
}

function pickShopUnit(state, balance) {
  const level = getCurrentLevel(balance, state);
  const roll = nextRandom(state) * 100;
  let cumulative = 0;
  let tier = 1;
  for (const [tierKey, odds] of Object.entries(level.odds)) {
    cumulative += odds;
    if (roll <= cumulative) {
      tier = Number(tierKey);
      break;
    }
  }
  const pool = balance.units.filter((unit) => unit.tier === tier);
  return pool[Math.floor(nextRandom(state) * pool.length)]?.id ?? balance.units[0].id;
}

function pickItem(state, balance) {
  return balance.items[Math.floor(nextRandom(state) * balance.items.length)].id;
}

function maybeAwardItem(state, balance, won, round, stage) {
  if (!won || round % stage.itemEvery !== 0) return;
  state.run.items.push(createItemInstance(pickItem(state, balance)));
  addLog(state, "Won an item from the stage reward.");
}

function createEnemyBoard(state, balance, stage) {
  const count = clamp(2 + Math.floor(stage.stage / 3), 2, BOARD_SIZE);
  const slotsByPriority = [0, 1, 2, 3, 4, 5];
  const board = normalizeBoard([]);
  const unitPower = stage.enemyPower / count;
  const names = ["Scout", "Guard", "Ravager", "Channeler", "Marksman", "Captain"];

  for (let index = 0; index < count; index += 1) {
    const slot = slotsByPriority[index];
    const role = index < 2 ? "Frontline" : index === count - 1 ? "Carry" : "Striker";
    const health = Math.round(52 + unitPower * (role === "Frontline" ? 1.35 : 0.95));
    const defense = Math.round(3 + stage.stage * (role === "Frontline" ? 0.8 : 0.45));
    const attack = Math.round(7 + unitPower / (role === "Carry" ? 8 : 10));
    board[slot] = {
      instanceId: `enemy-${stage.stage}-${index}`,
      name: `Stage ${stage.stage} ${names[index]}`,
      role,
      health,
      attack,
      defense,
      speed: role === "Carry" ? 1.15 : 0.95,
    };
  }
  return board;
}

function createAttackEvents(state, balance, enemyBoard) {
  const playerUnits = state.run.board
    .map((unit, slot) => unit ? { side: "player", slot, unit, combatId: unit.instanceId } : null)
    .filter(Boolean);
  const enemyUnits = enemyBoard
    .map((unit, slot) => unit ? { side: "enemy", slot, unit, combatId: unit.instanceId } : null)
    .filter(Boolean);
  const traitState = computeTraitState(state, balance);
  const events = [];
  const maxPairs = Math.min(8, Math.max(playerUnits.length, enemyUnits.length) * 2);

  for (let index = 0; index < maxPairs; index += 1) {
    const player = playerUnits[index % Math.max(1, playerUnits.length)];
    const enemy = enemyUnits[index % Math.max(1, enemyUnits.length)];
    if (!player || !enemy) break;

    const playerStats = computeUnitStats(player.unit, state, balance, traitState);
    events.push({
      attackerId: player.combatId,
      defenderId: enemy.combatId,
      damage: Math.max(1, Math.round(playerStats.attack * playerStats.speed + playerStats.abilityPower * 0.18 - enemy.unit.defense * 0.55)),
      source: "player",
    });

    if (events.length >= maxPairs) break;
    events.push({
      attackerId: enemy.combatId,
      defenderId: player.combatId,
      damage: Math.max(1, Math.round(enemy.unit.attack * enemy.unit.speed - playerStats.defense * 0.45)),
      source: "enemy",
    });
  }

  return events;
}

function createHealthByCombatId(state, balance, enemyBoard, attackEvents) {
  const traitState = computeTraitState(state, balance);
  const healthByCombatId = {};

  for (const instance of state.run.board.filter(Boolean)) {
    const stats = computeUnitStats(instance, state, balance, traitState);
    healthByCombatId[instance.instanceId] = {
      current: Math.round(stats.health),
      max: Math.round(stats.health),
    };
  }

  for (const enemy of enemyBoard.filter(Boolean)) {
    healthByCombatId[enemy.instanceId] = {
      current: Math.round(enemy.health),
      max: Math.round(enemy.health),
    };
  }

  for (const event of attackEvents) {
    const defender = healthByCombatId[event.defenderId];
    if (!defender) continue;
    defender.current = Math.max(0, defender.current - event.damage);
  }

  return healthByCombatId;
}

function combineDuplicates(state) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const starLevel of [1, 2]) {
      const groups = new Map();
      for (const location of unitLocations(state)) {
        const key = `${location.unit.unitId}:${location.unit.starLevel}`;
        if (location.unit.starLevel !== starLevel) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(location);
      }
      for (const group of groups.values()) {
        if (group.length < 3) continue;
        const consumed = group.slice(0, 3);
        const anchor = consumed.find((entry) => entry.location === "board") ?? consumed[0];
        const upgraded = {
          ...createUnitInstance(anchor.unit.unitId),
          starLevel: starLevel + 1,
        };
        removeUnitLocations(state, consumed);
        placeUpgradedUnit(state, anchor, upgraded);
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
}

function removeUnitLocations(state, locations) {
  const boardIndexes = locations.filter((entry) => entry.location === "board").map((entry) => entry.index);
  for (const index of boardIndexes) state.run.board[index] = null;
  const benchIndexes = locations.filter((entry) => entry.location === "bench").map((entry) => entry.index).sort((a, b) => b - a);
  for (const index of benchIndexes) state.run.bench.splice(index, 1);
}

function placeUpgradedUnit(state, anchor, upgraded) {
  if (anchor.location === "board") {
    state.run.board[anchor.index] = upgraded;
  } else {
    state.run.bench.push(upgraded);
  }
}

function unitLocations(state) {
  const board = state.run.board.map((unit, index) => unit ? { location: "board", index, unit } : null).filter(Boolean);
  const bench = state.run.bench.map((unit, index) => ({ location: "bench", index, unit }));
  return [...board, ...bench];
}

function applyStat(stats, stat, value, mode) {
  if (!(stat in stats)) return;
  if (mode === "percent") stats[stat] *= 1 + value / 100;
  else stats[stat] += value;
}

function getStage(balance, stageNumber) {
  const known = balance.stageByNumber[stageNumber];
  if (known) return known;
  const last = balance.stages.at(-1);
  const extra = stageNumber - last.stage;
  return {
    ...last,
    stage: stageNumber,
    enemyPower: Math.round(last.enemyPower * Math.pow(1.16, extra)),
    goldReward: last.goldReward + Math.floor(extra / 2),
  };
}

function boardUnitCount(state) {
  return state.run.board.filter(Boolean).length;
}

function countUnits(state) {
  return boardUnitCount(state) + state.run.bench.length;
}

function firstEmptyBoardSlot(state) {
  return state.run.board.findIndex((slot) => slot === null);
}

function normalizeBoard(board) {
  const normalized = Array.isArray(board) ? board.slice(0, BOARD_SIZE) : [];
  while (normalized.length < BOARD_SIZE) normalized.push(null);
  return normalized;
}

function createUnitInstance(unitId) {
  return {
    instanceId: `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    unitId,
    starLevel: 1,
  };
}

function createItemInstance(itemId) {
  return {
    instanceId: `i_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    itemId,
    slotIndex: null,
  };
}

function addLog(state, message) {
  state.run.combatLog.unshift(message);
  state.run.combatLog = state.run.combatLog.slice(0, 8);
}

function snapshotProgress(state) {
  return {
    gold: state.run.gold,
    stage: state.run.stage,
    items: state.run.items.length,
  };
}

function simulationSpeed() {
  return 1;
}

function nextRandom(state) {
  state.rngSeed = (state.rngSeed + 0x6D2B79F5) >>> 0;
  let value = state.rngSeed;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
