import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeBalance } from "../src/balance.js";
import {
  assignItemToSlot,
  buyItem,
  buyItemSlot,
  buyShopUnit,
  computeTeamPower,
  computeTraitState,
  computeUnitStats,
  createInitialState,
  estimatePrestigeGain,
  fieldUnit,
  moveBenchUnitToBoard,
  moveBoardUnit,
  moveBoardUnitToBench,
  prestigeReset,
  processElapsed,
  reorderBenchUnit,
  runCombatRound,
} from "../src/game.js";

const SHEETS = ["units", "traits", "items", "levels", "economy", "stages", "prestige", "offline"];

async function loadTestBalance() {
  const textMap = {};
  for (const sheet of SHEETS) {
    textMap[sheet] = await readFile(new URL(`../balance/${sheet}.csv`, import.meta.url), "utf8");
  }
  return normalizeBalance(textMap);
}

test("balance sheets load and validate", async () => {
  const balance = await loadTestBalance();
  assert.equal(balance.units.length, 12);
  assert.equal(balance.traits.length, 7);
  assert.equal(balance.items.length, 8);
  assert.ok(balance.economy.roundSeconds > 0);
  assert.ok(balance.prestige.minStage >= 1);
});

test("shop purchases can build active trait synergies", async () => {
  const balance = await loadTestBalance();
  const state = createInitialState(balance);
  state.run.gold = 99;
  state.run.shop = ["ember_squire", "gear_mender", "bark_guard", "spark_acolyte"];

  assert.equal(buyShopUnit(state, balance, 0).ok, true);
  assert.equal(buyShopUnit(state, balance, 1).ok, true);
  assert.equal(buyShopUnit(state, balance, 2).ok, true);
  if (state.run.bench.length > 0) fieldUnit(state, balance, 0);

  const guardian = computeTraitState(state, balance).find((entry) => entry.trait.id === "guardian");
  assert.ok(guardian.count >= 2);
  assert.equal(guardian.active.count, 2);
  assert.ok(computeTeamPower(state, balance) > 0);
});

test("continuous combat advances exact rounds from elapsed time", async () => {
  const balance = await loadTestBalance();
  const state = createInitialState(balance);
  state.run.gold = 99;
  state.run.level = 3;
  state.run.shop = ["ember_squire", "gear_mender", "bark_guard", "vine_archer"];

  for (let index = 0; index < state.run.shop.length; index += 1) {
    buyShopUnit(state, balance, index);
  }

  const beforeTotalRounds = state.run.totalRounds;
  const result = processElapsed(state, balance, balance.economy.roundSeconds * 1000 * 5);
  assert.equal(result.rounds, 5);
  assert.equal(state.run.totalRounds, beforeTotalRounds + 5);
  assert.ok(state.run.stage >= 1);
  assert.ok(state.run.gold >= 0);
});

test("combat does not start with an empty board", async () => {
  const balance = await loadTestBalance();
  const state = createInitialState(balance);
  state.run.stage = 5;
  state.run.round = 3;
  state.run.totalRounds = 8;
  state.run.roundProgressMs = balance.economy.roundSeconds * 1000 - 1;
  const beforeGold = state.run.gold;

  const result = processElapsed(state, balance, balance.economy.roundSeconds * 1000 * 3);
  assert.equal(result.rounds, 0);
  assert.equal(result.goldDelta, 0);
  assert.equal(result.stageDelta, 0);
  assert.equal(state.run.stage, 5);
  assert.equal(state.run.round, 3);
  assert.equal(state.run.totalRounds, 8);
  assert.equal(state.run.roundProgressMs, 0);
  assert.equal(state.run.gold, beforeGold);

  assert.equal(runCombatRound(state, balance), null);
  assert.equal(state.run.stage, 5);
  assert.equal(state.run.round, 3);
  assert.equal(state.run.totalRounds, 8);
});

test("stage round counter resets on stage win and stage loss", async () => {
  const balance = await loadTestBalance();
  const state = createInitialState(balance);
  state.run.gold = 99;
  state.run.level = 3;
  state.run.stage = 3;
  state.run.round = 4;
  state.run.shop = ["ember_squire", "gear_mender", "bark_guard", "vine_archer"];

  for (let index = 0; index < state.run.shop.length; index += 1) {
    buyShopUnit(state, balance, index);
  }

  const winRecap = runCombatRound(state, balance);
  assert.equal(winRecap.won, true);
  assert.equal(state.run.stage, 4);
  assert.equal(state.run.round, 1);

  state.run.stage = 15;
  state.run.round = 5;
  const lossRecap = runCombatRound(state, balance);
  assert.equal(lossRecap.won, false);
  assert.equal(state.run.stage, 14);
  assert.equal(state.run.round, 1);
});

test("drag movement helpers rearrange board and bench units", async () => {
  const balance = await loadTestBalance();
  const state = createInitialState(balance);
  state.run.gold = 99;
  state.run.shop = ["ember_squire", "gear_mender", "bark_guard", "vine_archer"];

  assert.equal(buyShopUnit(state, balance, 0).ok, true);
  assert.equal(buyShopUnit(state, balance, 1).ok, true);
  assert.equal(buyShopUnit(state, balance, 2).ok, true);

  const firstBoardId = state.run.board[0].instanceId;
  const secondBoardId = state.run.board[1].instanceId;
  const benchId = state.run.bench[0].instanceId;

  assert.equal(moveBoardUnit(state, 0, 1).ok, true);
  assert.equal(state.run.board[0].instanceId, secondBoardId);
  assert.equal(state.run.board[1].instanceId, firstBoardId);

  const cappedDrop = moveBenchUnitToBoard(state, balance, 0, 2);
  assert.equal(cappedDrop.ok, false);
  assert.equal(state.run.bench[0].instanceId, benchId);

  state.run.level = 2;
  assert.equal(moveBenchUnitToBoard(state, balance, 0, 2).ok, true);
  assert.equal(state.run.board[2].instanceId, benchId);
  assert.equal(state.run.bench.length, 0);

  assert.equal(moveBoardUnitToBench(state, balance, 0).ok, true);
  assert.equal(moveBoardUnitToBench(state, balance, 1).ok, true);
  assert.deepEqual(state.run.bench.map((unit) => unit.instanceId), [secondBoardId, firstBoardId]);

  assert.equal(reorderBenchUnit(state, 0, 1).ok, true);
  assert.deepEqual(state.run.bench.map((unit) => unit.instanceId), [firstBoardId, secondBoardId]);
});

test("items use purchased global item slots instead of unit equipment", async () => {
  const balance = await loadTestBalance();
  const state = createInitialState(balance);
  state.run.gold = 99;
  state.run.shop = ["ember_squire", "gear_mender", "bark_guard", "vine_archer"];
  state.run.itemShop = ["iron_blade", "warding_plate", "vital_seed"];

  assert.equal(buyShopUnit(state, balance, 0).ok, true);
  assert.equal(state.run.itemSlots, 0);
  assert.equal(buyItem(state, balance, 0).ok, true);
  const unit = state.run.board.find(Boolean);
  const beforeStats = computeUnitStats(unit, state, balance);
  assert.equal(beforeStats.attack, balance.unitById[unit.unitId].attack);

  assert.equal(buyItemSlot(state, balance).ok, true);
  assert.equal(state.run.itemSlots, 1);
  assert.equal(assignItemToSlot(state, state.run.items[0].instanceId, 0).ok, true);
  assert.equal(state.run.items[0].slotIndex, 0);
  const afterStats = computeUnitStats(unit, state, balance);
  assert.equal(afterStats.attack, beforeStats.attack + balance.itemById.iron_blade.value);
  assert.equal(state.run.items[0].equippedTo, undefined);
});

test("combat round records enemy layout and attack events", async () => {
  const balance = await loadTestBalance();
  const state = createInitialState(balance);
  state.run.gold = 99;
  state.run.level = 3;
  state.run.shop = ["ember_squire", "gear_mender", "vine_archer", "dusk_cutpurse"];

  for (let index = 0; index < state.run.shop.length; index += 1) {
    buyShopUnit(state, balance, index);
  }

  const recap = runCombatRound(state, balance);
  const enemyIds = new Set(recap.enemyBoard.filter(Boolean).map((unit) => unit.instanceId));
  const playerIds = new Set(state.run.board.filter(Boolean).map((unit) => unit.instanceId));
  assert.ok(recap.enemyBoard.filter(Boolean).length >= 2);
  assert.ok(recap.attackEvents.length > 0);
  for (const event of recap.attackEvents) {
    assert.ok(enemyIds.has(event.attackerId) || playerIds.has(event.attackerId));
    assert.ok(enemyIds.has(event.defenderId) || playerIds.has(event.defenderId));
    assert.ok(event.damage > 0);
    assert.ok(recap.healthByCombatId[event.attackerId].max > 0);
    assert.ok(recap.healthByCombatId[event.defenderId].max > 0);
    assert.ok(recap.healthByCombatId[event.defenderId].current >= 0);
  }
});

test("prestige math is spreadsheet driven and resets run state", async () => {
  const balance = await loadTestBalance();
  const state = createInitialState(balance);
  state.run.stage = 12;
  state.prestige.bestStage = 12;

  const gain = estimatePrestigeGain(state, balance);
  assert.ok(gain > 0);
  const result = prestigeReset(state, balance);
  assert.equal(result.ok, true);
  assert.equal(state.prestige.points, gain);
  assert.equal(state.run.stage, 1);
  assert.ok(state.run.gold > balance.economy.startingGold);
});
